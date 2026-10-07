"""Resumable, conservative executor for Codex-authored Vibes plans."""

from __future__ import annotations

import json
import re
import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .auth import authenticated_client
from .storage import JobStore, utc_now, write_json_atomic
from .validation import load_plan, probe_and_decode_video, validate_plan


PROVIDER = "VibesAI-api"
PROVIDER_VERSION = "1.5.0"
SCHEMA_VERSION = 1
IMAGE_GENERATION_CONFIG = {
    "resolution": "480p",
    "image_model": "midjen-base",
    "prompt_model": "gemini-2.5-flash",
    "ingredients": [],
    "create_ingredients": [],
    "moodboard": None,
}


class PendingReconciliation(RuntimeError):
    pass


def _safe_error(exc: BaseException) -> str:
    # Do not persist arbitrary service/HTTP exception bodies: even a misbehaving remote error
    # could echo request data. Keep only the status and exception class for network clients.
    module = type(exc).__module__
    status = getattr(exc, "status", None)
    if module.startswith(("vibes_api", "requests", "urllib3")):
        detail = f"HTTP {status}" if isinstance(status, int) else "fallo de petición al servicio"
        return f"{type(exc).__name__}: {detail}"
    message = str(exc).replace("\r", " ").replace("\n", " ")[:500]
    message = re.sub(r"(?i)(meta_session|cookie|authorization)\s*[:=]\s*[^,; ]+", r"\1=[REDACTED]", message)
    return f"{type(exc).__name__}: {message}" if message else type(exc).__name__


def _status_is_definitive_rejection(exc: BaseException) -> bool:
    status = getattr(exc, "status", None)
    return isinstance(status, int) and 400 <= status < 500 and status not in (408, 425, 429)


def _extract_id(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    for key in ("id", "projectId", "batchId"):
        candidate = value.get(key)
        if isinstance(candidate, (str, int)) and str(candidate):
            return str(candidate)
    return None


def _collect_dicts(value: Any, preferred: tuple[str, ...]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, list):
        for child in value:
            found.extend(_collect_dicts(child, preferred))
    elif isinstance(value, dict):
        if any(key in value for key in preferred):
            found.append(value)
        for child in value.values():
            if isinstance(child, (dict, list)):
                found.extend(_collect_dicts(child, preferred))
    # Preserve first-seen API order while discarding repeated recursive paths.
    unique: list[dict[str, Any]] = []
    seen: set[int] = set()
    for item in found:
        if id(item) not in seen:
            seen.add(id(item))
            unique.append(item)
    return unique


def _extract_batch_id(response: Any) -> str | None:
    if not isinstance(response, dict):
        return None
    for key in ("updatedBatch", "batch"):
        value = response.get(key)
        batch_id = _extract_id(value)
        if batch_id:
            return batch_id
    return _extract_id(response)


def _extract_timestamp(batch: dict[str, Any]) -> float | None:
    for key in ("generationStartTime", "timestamp", "createdAt", "created_at", "updatedAt"):
        value = batch.get(key)
        if isinstance(value, (int, float)):
            return float(value) / (1000 if value > 10_000_000_000 else 1)
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
            except ValueError:
                pass
    return None


def _collection_from(value: Any, preferred: tuple[str, ...]) -> list[dict[str, Any]]:
    collection_keys = ("projects", "batches", "generationBatches", "items", "results", "data")
    def walk(node: Any) -> list[dict[str, Any]]:
        if isinstance(node, list):
            entries = [entry for entry in node if isinstance(entry, dict)]
            if entries:
                return entries
            for entry in node:
                result = walk(entry)
                if result:
                    return result
        elif isinstance(node, dict):
            for key in collection_keys:
                nested = node.get(key)
                if isinstance(nested, list):
                    entries = [entry for entry in nested if isinstance(entry, dict)]
                    if entries:
                        return entries
            for nested in node.values():
                if isinstance(nested, (dict, list)):
                    result = walk(nested)
                    if result:
                        return result
        return []
    return walk(value)


def _find_projects(client: Any, project_name: str) -> list[dict[str, Any]]:
    response = client.list_projects(limit=100, search=project_name)
    return [project for project in _collection_from(response, ("projects", "name", "projectId")) if project.get("name") == project_name and _extract_id(project)]


def _ensure_project(store: JobStore, client: Any) -> str:
    manifest = store.manifest
    if manifest.get("remoteProjectId"):
        return manifest["remoteProjectId"]
    name = manifest["remoteProjectName"]
    # A process can stop after persisting "creating" but before saving the remote ID.
    # Treat that same window as uncertain and never issue a second create request blindly.
    pending = manifest.get("projectStatus") in ("creating", "pending_reconciliation")
    existing = _find_projects(client, name)
    if len(existing) == 1:
        project_id = _extract_id(existing[0])
        store.update_root("project_reconciled", remoteProjectId=project_id, projectStatus="ready")
        return project_id
    if len(existing) > 1 or pending:
        store.update_root("project_reconciliation_required", projectStatus="pending_reconciliation")
        raise PendingReconciliation("No se puede determinar con seguridad si Vibes aceptó la creación del proyecto.")
    store.update_root("project_create_started", projectStatus="creating")
    try:
        response = client.create_project(name=name)
    except Exception as exc:
        # Creation may have succeeded despite a lost response. Reconcile by the unique job name.
        try:
            matches = _find_projects(client, name)
        except Exception:
            matches = []
        if len(matches) == 1:
            project_id = _extract_id(matches[0])
            store.update_root("project_reconciled", remoteProjectId=project_id, projectStatus="ready")
            return project_id
        store.update_root("project_create_uncertain", projectStatus="pending_reconciliation", projectError=_safe_error(exc))
        raise PendingReconciliation("La creación del proyecto requiere reconciliación; no se volverá a crear automáticamente.") from None
    project_id = _extract_id(response)
    if not project_id:
        candidates = _collect_dicts(response, ("id", "projectId"))
        project_id = next((_extract_id(item) for item in candidates if _extract_id(item)), None)
    if not project_id:
        store.update_root("project_create_uncertain", projectStatus="pending_reconciliation")
        raise PendingReconciliation("Vibes respondió sin un identificador de proyecto; queda pendiente de reconciliación.")
    store.update_root("project_created", remoteProjectId=project_id, projectStatus="ready")
    return project_id


def _batch_matches(batch: dict[str, Any], prompt: str, batch_type: str, started_at: float, source_id: str | None) -> bool:
    if batch.get("prompt") != prompt:
        return False
    actual_type = str(batch.get("type", "")).lower()
    accepted_types = {"images", "image"} if batch_type == "images" else {"videos", "video", "image2video"}
    if actual_type not in accepted_types:
        return False
    timestamp = _extract_timestamp(batch)
    if timestamp is not None and timestamp < started_at - 60:
        return False
    if source_id:
        config = batch.get("config") or {}
        sources = config.get("sourceContentItemIds") or []
        if not any(str(entry.get("id")) == source_id for entry in sources if isinstance(entry, dict)):
            return False
    return True


def _find_recent_batches(client: Any, project_id: str, prompt: str, batch_type: str, started_at: float, source_id: str | None = None) -> list[dict[str, Any]]:
    response = client.list_project_batches(project_id, limit=100, offset=0)
    candidates = _collection_from(response, ("batches", "generationBatches", "id", "batchId"))
    return [batch for batch in candidates if _batch_matches(batch, prompt, batch_type, started_at, source_id) and _extract_id(batch)]


def _get_batch(client: Any, batch_id: str) -> dict[str, Any]:
    batch = client.get_batch(batch_id)
    if isinstance(batch, dict) and isinstance(batch.get("batch"), dict):
        return batch["batch"]
    return batch if isinstance(batch, dict) else {}


def _wait_batch(client: Any, batch_id: str, timeout: float, interval: float = 3.0) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    last_error: BaseException | None = None
    while time.monotonic() < deadline:
        try:
            batch = _get_batch(client, batch_id)
            last_error = None
            # The API's global hasError flag is not sufficient: wait for completion and inspect
            # every content item separately, because mixed-success batches have been observed.
            if batch.get("isComplete"):
                return batch
        except Exception as exc:
            last_error = exc
            if _status_is_definitive_rejection(exc):
                raise
        time.sleep(min(interval, max(0.0, deadline - time.monotonic())))
    if last_error:
        raise TimeoutError(f"No se pudo consultar el lote hasta el plazo límite: {type(last_error).__name__}.") from None
    raise TimeoutError("El lote no terminó dentro del plazo configurado.")


def _valid_items(batch: dict[str, Any], url_key: str) -> list[dict[str, Any]]:
    content = batch.get("content")
    if not isinstance(content, list):
        return []
    return [item for item in content if isinstance(item, dict) and item.get(url_key) and not item.get("error")]


def _scene_filename(scene: dict[str, Any]) -> str:
    return f"{int(scene['sceneNumber']):03d}_{scene['sceneId']}.mp4"


def _scene_image_filename(scene: dict[str, Any]) -> str:
    attempt = int(scene.get("attempts", 1))
    suffix = "" if attempt <= 1 else f"_attempt-{attempt:02d}"
    return f"{int(scene['sceneNumber']):03d}_{scene['sceneId']}{suffix}.png"


def _download_image_preview(client: Any, store: JobStore, scene_id: str, chosen: dict[str, Any]) -> None:
    scene = store.scene(scene_id)
    destination = store.root / "images" / _scene_image_filename(scene)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.unlink(missing_ok=True)
    try:
        client.download_image(str(chosen["id"]), str(destination))
        data = destination.read_bytes()
        if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
            raise ValueError("La vista previa descargada no es un PNG válido.")
        width = int.from_bytes(data[16:20], "big")
        height = int.from_bytes(data[20:24], "big")
        if width <= 0 or height <= 0:
            raise ValueError("La vista previa no informa dimensiones válidas.")
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    store.update_scene(
        scene_id,
        "image_preview_downloaded_for_visual_review",
        imagePreview={
            "absolutePath": str(destination.resolve()),
            "width": width,
            "height": height,
            "sizeBytes": len(data),
            "remoteContentItemId": str(chosen.get("id")),
            "format": "png",
        },
        stage=None,
    )


def _save_batch_id(store: JobStore, scene_id: str, kind: str, batch_id: str) -> None:
    scene = store.scene(scene_id)
    key = f"{kind}BatchIds"
    ids = list(scene.get(key) or [])
    if batch_id not in ids:
        ids.append(batch_id)
    updates = {key: ids, f"current{kind.title()}BatchId": batch_id}
    store.update_scene(scene_id, f"{kind}_batch_id_saved", **updates)


def _record_stage_error(store: JobStore, scene_id: str, stage: str, exc: BaseException, *, uncertain: bool) -> None:
    status = "pending_reconciliation" if uncertain else "failed"
    store.update_scene(
        scene_id,
        "scene_stage_error",
        status=status,
        stage=stage,
        reconcileStage=stage if uncertain else None,
        error=_safe_error(exc),
        warning=None,
    )


def _reconcile_batch(client: Any, store: JobStore, scene: dict[str, Any], stage: str, batch_type: str, source_id: str | None = None) -> str | None:
    started = scene.get("stageStartedAt") or scene.get("createdAt")
    try:
        started_at = datetime.fromisoformat(str(started).replace("Z", "+00:00")).timestamp()
    except ValueError:
        started_at = time.time() - 300
    try:
        matches = _find_recent_batches(
            client,
            store.manifest["remoteProjectId"],
            scene["imagePrompt"] if batch_type == "images" else scene["motionPrompt"],
            batch_type,
            started_at,
            source_id,
        )
    except Exception:
        store.update_scene(scene["sceneId"], "batch_reconciliation_unresolved", status="pending_reconciliation", reconcileStage=stage)
        return None
    if len(matches) != 1:
        store.update_scene(scene["sceneId"], "batch_reconciliation_unresolved", status="pending_reconciliation", reconcileStage=stage)
        return None
    batch_id = _extract_id(matches[0])
    kind = "image" if batch_type == "images" else "video"
    _save_batch_id(store, scene["sceneId"], kind, batch_id)
    return batch_id


def _reset_failed_scene(store: JobStore, scene_id: str) -> None:
    scene = store.scene(scene_id)
    if scene.get("status") != "failed":
        raise ValueError(f"Solo una escena fallida se puede repetir explícitamente: {scene_id} está en {scene.get('status')}.")
    attempts = int(scene.get("attempts", 1)) + 1
    review_required = bool(store.manifest.get("imageReviewRequired"))
    # A failed image download is a transport failure after generation. Keep the remote batch
    # and selected content IDs so retrying the download can never submit a second image request.
    download_retry = (
        review_required
        and scene.get("stage") == "image_preview"
        and bool(scene.get("currentImageBatchId"))
        and bool(scene.get("imageContentItemId"))
    )
    video_download_retry = (
        scene.get("stage") == "download"
        and bool(scene.get("currentVideoBatchId"))
        and bool(scene.get("videoContentItemId"))
        and bool(scene.get("imageContentItemId"))
        and bool(scene.get("animationApproved"))
    )
    if video_download_retry:
        store.update_scene(
            scene_id,
            "video_download_retry_authorized",
            status="video_generating",
            attempts=attempts,
            stage="video_poll",
            reconcileStage=None,
            error=None,
            warning=None,
            file=None,
        )
        return
    if download_retry:
        store.update_scene(
            scene_id,
            "image_preview_retry_authorized",
            status="image_generating",
            attempts=attempts,
            stage="image_poll",
            reconcileStage=None,
            error=None,
            warning=None,
            currentVideoBatchId=None,
            selectedImageTechnicalValid=True,
            visualReview="pending_review",
            compositionReview="pending",
            compositionReviewNote=None,
            animationApproved=False,
            imagePreview=None,
            file=None,
        )
        return
    store.update_scene(
        scene_id,
        "scene_retry_authorized",
        status="queued",
        attempts=attempts,
        stage=None,
        reconcileStage=None,
        error=None,
        warning=None,
        currentImageBatchId=None,
        currentVideoBatchId=None,
        imageContentItemId=None,
        videoContentItemId=None,
        selectedImageTechnicalValid=None,
        visualReview="pending_review",
        compositionReview="pending" if review_required else "not_required",
        compositionReviewNote=None,
        animationApproved=not review_required,
        imagePreview=None,
        file=None,
    )


def _prepare_source_image(client: Any, store: JobStore, scene: dict[str, Any]) -> dict[str, Any]:
    batch_id = scene.get("currentImageBatchId")
    if not batch_id:
        raise ValueError("Falta el identificador del lote de imagen.")
    batch = _get_batch(client, batch_id)
    selected_id = scene.get("imageContentItemId")
    for item in batch.get("content", []) if isinstance(batch.get("content"), list) else []:
        if isinstance(item, dict) and item.get("id") == selected_id and item.get("imageUrl") and not item.get("error"):
            return item
    raise ValueError("La imagen remota elegida ya no está disponible o dejó de ser válida.")


def _process_scene(client: Any, store: JobStore, scene_id: str, poll_timeout: float, *, images_only: bool = False) -> None:
    scene = store.scene(scene_id)
    if scene.get("status") == "complete":
        return
    if scene.get("status") == "failed":
        return

    # Recover interruptions between the durable "request started" marker and saving a remote
    # batch ID. Search Vibes first; if the result is ambiguous or missing, stop without duplicating.
    if scene.get("status") == "image_generating" and scene.get("stage") == "image_generation" and not scene.get("currentImageBatchId"):
        batch_id = _reconcile_batch(client, store, scene, "image_generation", "images")
        if not batch_id:
            return
        store.update_scene(scene_id, "image_generation_recovered", status="image_generating", stage="image_poll")
        scene = store.scene(scene_id)
    if scene.get("status") == "video_generating" and scene.get("stage") == "video_generation" and not scene.get("currentVideoBatchId"):
        batch_id = _reconcile_batch(client, store, scene, "video_generation", "videos", scene.get("imageContentItemId"))
        if not batch_id:
            return
        store.update_scene(scene_id, "video_generation_recovered", status="video_generating", stage="video_poll")
        scene = store.scene(scene_id)

    try:
        if scene.get("status") == "pending_reconciliation":
            stage = scene.get("reconcileStage")
            if stage == "image_generation":
                batch_id = _reconcile_batch(client, store, scene, stage, "images")
                if not batch_id:
                    return
                store.update_scene(scene_id, "image_generation_reconciled", status="image_generating", reconcileStage=None)
                scene = store.scene(scene_id)
            elif stage == "video_generation":
                batch_id = _reconcile_batch(client, store, scene, stage, "videos", scene.get("imageContentItemId"))
                if not batch_id:
                    return
                store.update_scene(scene_id, "video_generation_reconciled", status="video_generating", reconcileStage=None)
                scene = store.scene(scene_id)
            elif stage in ("image_poll", "video_poll"):
                store.update_scene(scene_id, f"{stage}_resumed", status="image_generating" if stage == "image_poll" else "video_generating", reconcileStage=None)
                scene = store.scene(scene_id)
            else:
                return

        if not scene.get("currentImageBatchId"):
            started = utc_now()
            store.update_scene(scene_id, "image_generation_started", status="image_generating", stage="image_generation", stageStartedAt=started)
            try:
                response = client.generate_image(
                    project_id=store.manifest["remoteProjectId"],
                    prompt=scene["imagePrompt"],
                    aspect_ratio=scene["aspectRatio"],
                    variations=store.manifest["variations"],
                    **IMAGE_GENERATION_CONFIG,
                )
            except Exception as exc:
                uncertain = not _status_is_definitive_rejection(exc)
                _record_stage_error(store, scene_id, "image_generation", exc, uncertain=uncertain)
                return
            image_batch_id = _extract_batch_id(response)
            if not image_batch_id:
                scene = store.scene(scene_id)
                image_batch_id = _reconcile_batch(client, store, scene, "image_generation", "images")
                if not image_batch_id:
                    return
            _save_batch_id(store, scene_id, "image", image_batch_id)

        scene = store.scene(scene_id)
        store.update_scene(scene_id, "image_results_check_started", status="image_generating", stage="image_poll")
        try:
            image_batch = _wait_batch(client, scene["currentImageBatchId"], timeout=poll_timeout)
        except Exception as exc:
            _record_stage_error(store, scene_id, "image_poll", exc, uncertain=True)
            return
        valid_images = _valid_items(image_batch, "imageUrl")
        if not valid_images:
            errors = [item.get("error") for item in image_batch.get("content", []) if isinstance(item, dict) and item.get("error")]
            detail = "; ".join(str(item) for item in errors[:3]) or "el lote terminó sin imágenes válidas"
            store.update_scene(
                scene_id,
                "image_generation_failed",
                status="failed",
                stage="image_generation",
                error=f"Ningún elemento del lote de imagen fue válido: {detail}"[:500],
                imageBatchState={"isComplete": bool(image_batch.get("isComplete")), "hasError": bool(image_batch.get("hasError")), "contentCount": len(image_batch.get("content", []))},
            )
            return
        # Reuse the exact selected image when resuming an image-only job for animation.
        # Never silently swap it for another variant from the same batch.
        selected_image_id = scene.get("imageContentItemId")
        chosen = next((item for item in valid_images if str(item.get("id")) == str(selected_image_id)), None) if selected_image_id else valid_images[0]
        if chosen is None:
            store.update_scene(
                scene_id,
                "selected_source_image_missing",
                status="failed",
                stage="image_generation",
                error="La imagen remota seleccionada ya no está disponible; no se sustituirá por otra variante.",
            )
            return
        store.update_scene(
            scene_id,
            "image_selected_technical_validity_only",
            status="image_ready",
            imageContentItemId=str(chosen.get("id")),
            selectedImageTechnicalValid=True,
            visualReview="pending_review",
            imageBatchState={"isComplete": bool(image_batch.get("isComplete")), "hasError": bool(image_batch.get("hasError")), "contentCount": len(image_batch.get("content", [])), "validContentCount": len(valid_images)},
            stage=None,
        )
        scene = store.scene(scene_id)

        if store.manifest.get("imageReviewRequired"):
            preview = scene.get("imagePreview")
            if not preview or not Path(str(preview.get("absolutePath", ""))).is_file():
                try:
                    store.update_scene(scene_id, "image_preview_download_started", status="image_ready", stage="image_preview")
                    _download_image_preview(client, store, scene_id, chosen)
                except Exception as exc:
                    store.update_scene(scene_id, "image_preview_download_failed", status="failed", stage="image_preview", error=_safe_error(exc))
                    return
            scene = store.scene(scene_id)
            if images_only or not scene.get("animationApproved"):
                return

        if not scene.get("currentVideoBatchId"):
            source_image = _prepare_source_image(client, store, scene)
            started = utc_now()
            store.update_scene(scene_id, "video_generation_started", status="video_generating", stage="video_generation", stageStartedAt=started)
            try:
                # Use the API's remote image item directly. poll=False returns after submission,
                # allowing the batch ID to be durably saved before waiting.
                response = client.manual_animate_image(
                    project_id=store.manifest["remoteProjectId"],
                    source_image=source_image,
                    prompt=scene["motionPrompt"],
                    poll=False,
                )
            except Exception as exc:
                uncertain = not _status_is_definitive_rejection(exc)
                _record_stage_error(store, scene_id, "video_generation", exc, uncertain=uncertain)
                return
            video_batch_id = _extract_batch_id(response)
            if not video_batch_id:
                scene = store.scene(scene_id)
                video_batch_id = _reconcile_batch(client, store, scene, "video_generation", "videos", scene.get("imageContentItemId"))
                if not video_batch_id:
                    return
            _save_batch_id(store, scene_id, "video", video_batch_id)

        scene = store.scene(scene_id)
        store.update_scene(scene_id, "video_results_check_started", status="video_generating", stage="video_poll")
        try:
            video_batch = _wait_batch(client, scene["currentVideoBatchId"], timeout=poll_timeout)
        except Exception as exc:
            _record_stage_error(store, scene_id, "video_poll", exc, uncertain=True)
            return
        valid_videos = _valid_items(video_batch, "videoUrl")
        if not valid_videos:
            errors = [item.get("error") for item in video_batch.get("content", []) if isinstance(item, dict) and item.get("error")]
            detail = "; ".join(str(item) for item in errors[:3]) or "el lote terminó sin videos válidos"
            store.update_scene(
                scene_id,
                "video_generation_failed",
                status="failed",
                stage="video_generation",
                error=f"Ningún elemento del lote de video fue válido: {detail}"[:500],
                videoBatchState={"isComplete": bool(video_batch.get("isComplete")), "hasError": bool(video_batch.get("hasError")), "contentCount": len(video_batch.get("content", []))},
            )
            return
        clip = valid_videos[0]
        store.update_scene(
            scene_id,
            "video_selected_technical_validity_only",
            status="video_ready",
            videoContentItemId=str(clip.get("id")),
            selectedVideoTechnicalValid=True,
            videoBatchState={"isComplete": bool(video_batch.get("isComplete")), "hasError": bool(video_batch.get("hasError")), "contentCount": len(video_batch.get("content", [])), "validContentCount": len(valid_videos)},
        )
        destination = store.root / _scene_filename(store.scene(scene_id))
        store.update_scene(scene_id, "video_download_started", status="downloading", stage="download")
        try:
            destination.unlink(missing_ok=True)
            client.download_video(str(clip["id"]), str(destination))
            media = probe_and_decode_video(destination)
        except Exception as exc:
            destination.unlink(missing_ok=True)
            store.update_scene(scene_id, "video_download_or_validation_failed", status="failed", stage="download", error=_safe_error(exc))
            return
        target = float(store.scene(scene_id)["targetDurationSeconds"])
        warning = None
        if abs(media["durationSeconds"] - target) > 0.5:
            warning = f"La duración real ({media['durationSeconds']:.3f}s) difiere del objetivo ({target:.3f}s); no se cambió la velocidad."
        store.update_scene(
            scene_id,
            "video_downloaded_and_verified",
            status="complete",
            stage=None,
            reconcileStage=None,
            error=None,
            warning=warning,
            file=media,
            visualReview="pending_review",
            selectedVideoTechnicalValid=True,
        )
    except PendingReconciliation:
        return
    except Exception as exc:
        _record_stage_error(store, scene_id, "executor", exc, uncertain=False)


def downloads_root() -> Path:
    # Resolve the Windows Downloads known folder, including redirected profiles.
    if __import__("os").name == "nt":
        try:
            import ctypes
            from ctypes import wintypes
            class GUID(ctypes.Structure):
                _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD), ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]
            downloads_guid = GUID(0x374DE290, 0x123F, 0x4565, (ctypes.c_ubyte * 8)(0x91, 0x64, 0x39, 0xC4, 0x92, 0x5E, 0x46, 0x7B))
            path_ptr = wintypes.LPWSTR()
            result = ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(downloads_guid), 0, None, ctypes.byref(path_ptr))
            if result == 0 and path_ptr.value:
                path = Path(path_ptr.value)
                ctypes.windll.ole32.CoTaskMemFree(path_ptr)
                return path / "VibesClips"
        except Exception:
            pass
    return Path.home() / "Downloads" / "VibesClips"


def create_job(plan_path: Path, output_root: Path | None = None, *, images_only: bool = False) -> JobStore:
    plan = load_plan(plan_path)
    job_id = str(uuid.uuid4())
    root = (output_root or downloads_root()) / job_id
    root.mkdir(parents=True, exist_ok=False)
    now = utc_now()
    scenes = []
    for index, source in enumerate(plan["scenes"], start=1):
        scenes.append({
            **source,
            "sceneNumber": index,
            "status": "queued",
            "attempts": 1,
            "createdAt": now,
            "updatedAt": now,
            "imageBatchIds": [],
            "videoBatchIds": [],
            "selectedImageTechnicalValid": None,
            "selectedVideoTechnicalValid": None,
            "visualReview": "pending_review",
            "compositionReview": "pending" if images_only else "not_required",
            "animationApproved": not images_only,
            "imagePreview": None,
            "file": None,
            "error": None,
            "warning": None,
        })
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "jobId": job_id,
        "status": "queued",
        "provider": PROVIDER,
        "providerVersion": PROVIDER_VERSION,
        "styleVersion": plan["styleVersion"],
        "styleVersionPolicy": plan.get("styleVersionPolicy", "uniform"),
        "generationMode": "images_only" if images_only else "image_and_video",
        "title": plan["title"],
        "parentJobId": plan.get("parentJobId"),
        "variantLabel": plan.get("variantLabel"),
        "sourceReference": plan.get("sourceReference"),
        "imageReviewRequired": images_only,
        "createdAt": now,
        "updatedAt": now,
        "variations": plan.get("variations", 1),
        "concurrency": plan.get("concurrency", 1),
        "imageGenerationConfig": {
            "resolution": IMAGE_GENERATION_CONFIG["resolution"],
            "imageModel": IMAGE_GENERATION_CONFIG["image_model"],
            "promptModel": IMAGE_GENERATION_CONFIG["prompt_model"],
            "generationType": "t2i",
            "directGeneration": True,
            "variations": plan.get("variations", 1),
            "batchVariation": plan.get("variations", 1) > 1,
            "ingredients": [],
            "createIngredients": [],
            "moodboard": None,
            "aspectRatioPerScene": True,
        },
        "remoteProjectName": f"Cipher Vibes · {job_id}",
        "remoteProjectId": None,
        "projectStatus": "not_started",
        "scenes": scenes,
    }
    write_json_atomic(root / "manifest.json", manifest)
    store = JobStore(root)
    store.save_plan(plan)
    store.event("job_created", jobId=job_id, sceneCount=len(scenes))
    return store


def open_job(job_id_or_path: str, output_root: Path | None = None) -> JobStore:
    candidate = Path(job_id_or_path)
    root = candidate if candidate.is_absolute() or candidate.exists() else (output_root or downloads_root()) / job_id_or_path
    if not root.is_dir() or not (root / "manifest.json").is_file():
        raise FileNotFoundError(f"No existe el trabajo Vibes {job_id_or_path}.")
    return JobStore(root)


def execute_job(
    store: JobStore,
    *,
    concurrency: int | None = None,
    retry_scene: str | list[str] | None = None,
    images_only: bool = False,
    approved_scene_ids: list[str] | None = None,
) -> dict[str, Any]:
    plan = load_plan(store.plan_path)
    validate_plan(plan)
    selected_concurrency = concurrency if concurrency is not None else int(store.manifest.get("concurrency", 1))
    if selected_concurrency not in (1, 2):
        raise ValueError("La concurrencia está limitada a 1 o 2.")
    review_required = bool(store.manifest.get("imageReviewRequired"))
    if images_only and not review_required:
        raise ValueError("--images-only solo se aplica a un trabajo creado para revisión de imágenes.")
    if images_only and selected_concurrency != 1:
        raise ValueError("La fase de revisión de imágenes debe ejecutarse con concurrencia 1.")
    if retry_scene:
        retry_scene_ids = [retry_scene] if isinstance(retry_scene, str) else retry_scene
        for scene_id in retry_scene_ids:
            _reset_failed_scene(store, scene_id)
    approved_scene_ids = approved_scene_ids or []
    if approved_scene_ids and not review_required:
        raise ValueError("--animate-approved solo se aplica a un trabajo con revisión de imágenes.")
    for scene_id in approved_scene_ids:
        scene = store.scene(scene_id)
        if scene.get("status") != "image_ready" or not scene.get("selectedImageTechnicalValid") or not scene.get("currentImageBatchId") or not scene.get("imageContentItemId"):
            raise ValueError(f"Solo se puede aprobar para animación una imagen existente y técnicamente válida: {scene_id}.")
        if scene.get("currentVideoBatchId") or scene.get("videoContentItemId") or scene.get("status") in ("video_generating", "downloading", "pending_reconciliation", "complete"):
            raise ValueError(f"La escena {scene_id} ya tiene un intento de animación; se debe reanudar o reconciliar, no enviar otra solicitud.")
        if scene.get("compositionReview") == "rejected":
            raise ValueError(f"La composición de {scene_id} fue rechazada para animación.")
        preview = scene.get("imagePreview") or {}
        if not preview.get("absolutePath") or not Path(preview["absolutePath"]).is_file():
            raise ValueError(f"Falta la vista previa local que se debe revisar antes de animar {scene_id}.")
        review = scene.get("compositionReview")
        store.update_scene(
            scene_id,
            "image_composition_approved_for_animation",
            animationApproved=True,
            compositionReview=review if review not in (None, "pending") else "approved",
        )
    if store.manifest.get("status") == "complete" and all(scene.get("status") == "complete" for scene in store.manifest["scenes"]):
        return store.manifest
    pending_ids = [
        scene["sceneId"]
        for scene in store.manifest["scenes"]
        if scene.get("status") not in ("complete", "failed")
        and not (review_required and scene.get("status") == "image_ready" and not scene.get("animationApproved"))
    ]
    if not pending_ids:
        store.refresh_job_status()
        return store.manifest
    # Authenticate before creating a Vibes project or submitting a generation.
    client, _identity = authenticated_client()
    try:
        project_id = _ensure_project(store, client)
    except PendingReconciliation:
        store.refresh_job_status()
        return store.manifest

    # A single shared HTTP client is used sequentially. For two workers, construct an isolated
    # client per scene to avoid sharing requests.Session state; all writes remain locked/atomic.
    if images_only:
        pending_ids = [scene_id for scene_id in pending_ids if store.scene(scene_id).get("status") != "complete"]
    if selected_concurrency == 1:
        for scene_id in pending_ids:
            _process_scene(client, store, scene_id, float(plan.get("pollTimeoutSeconds", 600)), images_only=images_only)
    elif pending_ids:
        from .auth import _read_saved_cookie
        cookie = _read_saved_cookie()
        if not cookie:
            # authenticated_client just saved or validated this credential; ask through its own
            # public path again only if Windows Credential Manager was unavailable.
            client, _identity = authenticated_client()
            cookie = _read_saved_cookie()
        from vibes_api import VibesClient

        def worker(scene_id: str) -> None:
            worker_client = VibesClient(meta_session=cookie)
            _process_scene(worker_client, store, scene_id, float(plan.get("pollTimeoutSeconds", 600)), images_only=images_only)

        with ThreadPoolExecutor(max_workers=selected_concurrency) as executor:
            futures = [executor.submit(worker, scene_id) for scene_id in pending_ids]
            for future in as_completed(futures):
                future.result()
        del cookie
    status = store.refresh_job_status()
    store.event("job_execution_finished", jobId=store.manifest["jobId"], status=status)
    return store.manifest


def summarize_job(manifest: dict[str, Any]) -> str:
    counts: dict[str, int] = {}
    for scene in manifest.get("scenes", []):
        status = scene.get("status", "unknown")
        counts[status] = counts.get(status, 0) + 1
    summary = ", ".join(f"{count} {status}" for status, count in sorted(counts.items())) or "sin escenas"
    return f"Trabajo {manifest.get('jobId')} · {manifest.get('status')} · {summary}"
