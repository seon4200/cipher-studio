"""Map finished Vibes media to Cipher's existing library Clip shape."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote


def local_file_url(path: str) -> str:
    """Match Cipher's segment-encoded file URL helper, including '#' and spaces."""
    normalized = path.replace("\\", "/")
    segments = normalized.split("/")
    # Python's default quoting escapes a few characters that JavaScript encodeURIComponent
    # leaves intact; use the same safe set as Cipher's renderer helper.
    encoded = [segments[0]] + [quote(part, safe="~!*'()-._") for part in segments[1:]]
    return "file:///" + "/".join(encoded)


def _format_duration(seconds: float) -> str:
    mins = max(0, int(seconds // 60))
    secs = max(0, int(seconds % 60 + 0.5))
    return f"{mins}:{secs:02d}"


def _format_size(size: int) -> str:
    return f"{size / (1024 * 1024):.2f} MB"


def adapt_scene_to_cipher(manifest: dict[str, Any], scene_id: str) -> dict[str, Any]:
    scene = next(item for item in manifest["scenes"] if item["sceneId"] == scene_id)
    if manifest.get("generationMode") == "images_only":
        preview = scene.get("imagePreview") or {}
        if scene.get("status") not in ("image_ready", "complete") or not preview.get("absolutePath"):
            raise ValueError(f"La imagen de {scene_id} todavía no está descargada para Cipher.")
        path = str(preview["absolutePath"])
        size = int(preview.get("sizeBytes") or 0)
        order = scene.get("sceneNumber", 1)
        return {
            "id": f"vibes-{manifest['jobId']}-{scene_id}",
            "slotId": scene_id,
            "name": f"Vibes · Imagen {order:03d} · {scene_id}",
            "duration": "",
            "durationSeconds": 0,
            "type": "image",
            "mediaKind": "image",
            "path": path,
            "size": _format_size(size),
            "url": local_file_url(path),
            "category": "ia",
            "thumbnailUrl": local_file_url(path),
            "provider": "vibes",
            "exposureDurationSeconds": scene.get("timelineDurationSeconds"),
            "scriptPosition": scene.get("scriptPosition"),
            "remoteImageBatchId": scene.get("currentImageBatchId"),
            "remoteContentItemId": scene.get("imageContentItemId"),
            "styleVersion": scene.get("styleVersion"),
            "remoteImageBatchIds": scene.get("imageBatchIds", []),
        }
    if scene.get("status") != "complete" or not scene.get("file"):
        raise ValueError(f"La escena {scene_id} no está lista para Cipher.")
    media = scene["file"]
    path = media["absolutePath"]
    actual_duration = float(media["durationSeconds"])
    size = int(media["sizeBytes"])
    order = scene.get("sceneNumber", 1)
    return {
        "id": f"vibes-{manifest['jobId']}-{scene_id}",
        "name": f"Vibes · Escena {order:03d} · {scene_id}",
        "duration": _format_duration(actual_duration),
        "durationSeconds": actual_duration,
        "type": "video",
        "path": path,
        "size": _format_size(size),
        "url": local_file_url(path),
        "category": "ia",
        "thumbnailUrl": "",
        "provider": "vibes",
        "targetDurationSeconds": scene["targetDurationSeconds"],
        "scriptPosition": scene.get("scriptPosition"),
    }
