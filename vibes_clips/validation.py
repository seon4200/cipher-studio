"""Plan validation and real-media verification helpers."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any


_SCENE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
_SECRET_KEYS = {"cookie", "meta_session", "session_cookie", "access_token", "refresh_token"}


def _reject_secret_fields(value: Any, location: str = "plan") -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if str(key).casefold() in _SECRET_KEYS:
                raise ValueError(f"El plan contiene un campo no permitido en {location}.{key}.")
            _reject_secret_fields(nested, f"{location}.{key}")
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            _reject_secret_fields(nested, f"{location}[{index}]")


def validate_plan(plan: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(plan, dict) or plan.get("schemaVersion") != 1:
        raise ValueError("El plan debe ser un objeto JSON con schemaVersion: 1.")
    _reject_secret_fields(plan)
    if not isinstance(plan.get("title"), str) or not plan["title"].strip():
        raise ValueError("El plan necesita un título.")
    if not isinstance(plan.get("styleVersion"), str) or not plan["styleVersion"].strip():
        raise ValueError("El plan necesita styleVersion.")
    generation_mode = plan.get("generationMode", "image_and_video")
    if generation_mode not in ("image_and_video", "images_only"):
        raise ValueError("generationMode debe ser image_and_video o images_only.")
    # A resumed editorial job can retain already-submitted prompts and apply a newer
    # guide only to queued scenes; the scene-level version remains the source of truth.
    style_version_policy = plan.get("styleVersionPolicy", "uniform")
    if style_version_policy not in ("uniform", "per_scene"):
        raise ValueError("styleVersionPolicy debe ser uniform o per_scene.")
    scenes = plan.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise ValueError("El plan necesita al menos una escena.")
    ids: set[str] = set()
    for index, scene in enumerate(scenes, start=1):
        if not isinstance(scene, dict):
            raise ValueError(f"La escena {index} debe ser un objeto JSON.")
        scene_id = scene.get("sceneId")
        if not isinstance(scene_id, str) or not _SCENE_ID.fullmatch(scene_id):
            raise ValueError(f"sceneId inválido en escena {index}.")
        if scene_id in ids:
            raise ValueError(f"sceneId duplicado: {scene_id}.")
        ids.add(scene_id)
        required_fields = ["scriptFragment", "narrativeIntent", "styleVersion", "imagePrompt", "aspectRatio"]
        if generation_mode != "images_only":
            required_fields.append("motionPrompt")
        for field in required_fields:
            allow_silent_literal = generation_mode == "images_only" and field == "scriptFragment" and scene.get("silentInterval") is True
            if not isinstance(scene.get(field), str) or (not scene[field].strip() and not allow_silent_literal):
                raise ValueError(f"La escena {scene_id} necesita {field}.")
        if generation_mode == "images_only" and scene.get("silentInterval") is True:
            context = scene.get("neighborContext")
            if scene.get("scriptFragment") != "" or not isinstance(context, dict) or not any(
                isinstance(context.get(key), str) and context[key].strip() for key in ("previous", "next")
            ):
                raise ValueError(f"El intervalo silencioso {scene_id} debe conservar su fragmento vacío y contexto vecino separado.")
        if style_version_policy == "uniform" and scene["styleVersion"] != plan["styleVersion"]:
            raise ValueError(f"La escena {scene_id} no coincide con styleVersion del plan.")
        target = scene.get("targetDurationSeconds")
        if generation_mode != "images_only" and (not isinstance(target, (int, float)) or isinstance(target, bool) or target <= 0):
            raise ValueError(f"targetDurationSeconds inválido en {scene_id}.")
        if generation_mode == "images_only" and target is not None:
            if not isinstance(target, (int, float)) or isinstance(target, bool) or target <= 0:
                raise ValueError(f"targetDurationSeconds inválido en {scene_id}.")
        position = scene.get("scriptPosition")
        if position is not None:
            if not isinstance(position, dict):
                raise ValueError(f"scriptPosition debe ser objeto o null en {scene_id}.")
            for key in ("startSeconds", "endSeconds"):
                if key not in position or not isinstance(position[key], (int, float)):
                    raise ValueError(f"Falta scriptPosition.{key} en {scene_id}.")
            if position["startSeconds"] < 0 or position["endSeconds"] < position["startSeconds"]:
                raise ValueError(f"scriptPosition fuera de orden en {scene_id}.")
        if "cipherOverlays" in scene and not isinstance(scene["cipherOverlays"], list):
            raise ValueError(f"cipherOverlays debe ser una lista en {scene_id}.")
    variations = plan.get("variations", 1)
    if not isinstance(variations, int) or variations < 1 or variations > 4:
        raise ValueError("variations debe estar entre 1 y 4.")
    concurrency = plan.get("concurrency", 1)
    if not isinstance(concurrency, int) or concurrency < 1 or concurrency > 2:
        raise ValueError("concurrency debe estar entre 1 y 2.")
    return plan


def load_plan(path: Path) -> dict[str, Any]:
    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"No se pudo leer el plan {path}: {exc}") from None
    return validate_plan(plan)


def _parse_rate(value: str | None) -> float | None:
    if not value or value == "0/0":
        return None
    try:
        numerator, denominator = value.split("/", 1)
        denominator_number = float(denominator)
        return float(numerator) / denominator_number if denominator_number else None
    except (ValueError, ZeroDivisionError):
        return None


def probe_and_decode_video(path: Path) -> dict[str, Any]:
    ffprobe = os.environ.get("FFPROBE_PATH") or shutil.which("ffprobe")
    ffmpeg = os.environ.get("FFMPEG_PATH") or shutil.which("ffmpeg")
    if not ffprobe or not ffmpeg:
        raise RuntimeError("Se necesitan ffprobe y ffmpeg en PATH (o FFPROBE_PATH y FFMPEG_PATH).")
    stat = path.stat()
    if not path.is_file() or stat.st_size == 0:
        raise ValueError("El archivo descargado está vacío.")
    probe = subprocess.run(
        [ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if probe.returncode != 0:
        raise ValueError("ffprobe no pudo leer el video descargado.")
    try:
        data = json.loads(probe.stdout)
    except json.JSONDecodeError:
        raise ValueError("ffprobe devolvió metadatos inválidos.") from None
    video_streams = [stream for stream in data.get("streams", []) if stream.get("codec_type") == "video"]
    if not video_streams:
        raise ValueError("El archivo no contiene una pista de video.")
    stream = video_streams[0]
    duration = stream.get("duration") or data.get("format", {}).get("duration")
    try:
        duration_seconds = float(duration)
    except (TypeError, ValueError):
        raise ValueError("No se pudo leer la duración real del video.") from None
    if duration_seconds <= 0:
        raise ValueError("El video informa una duración nula.")
    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)
    codec = stream.get("codec_name")
    if width <= 0 or height <= 0 or not codec:
        raise ValueError("ffprobe no devolvió dimensiones o códec de video válidos.")
    decode = subprocess.run(
        [ffmpeg, "-v", "error", "-i", str(path), "-f", "null", "-"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if decode.returncode != 0:
        raise ValueError("ffmpeg no pudo decodificar el video completo.")
    return {
        "absolutePath": str(path.resolve()),
        "durationSeconds": duration_seconds,
        "width": width,
        "height": height,
        "fps": _parse_rate(stream.get("avg_frame_rate") or stream.get("r_frame_rate")),
        "codec": codec,
        "hasAudio": any(item.get("codec_type") == "audio" for item in data.get("streams", [])),
        "sizeBytes": stat.st_size,
        "verifiedBy": ["ffprobe", "ffmpeg-decode"],
    }
