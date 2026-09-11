#!/usr/bin/env python3
"""Local, single-purpose CutoutTransform worker for Cipher Studio V15.

It receives an already-verified local raster and writes one RGBA PNG.  Provider retrieval,
ProjectAsset publication, cache identity and rendering remain in Electron.  No URL, credential
or renderer contract crosses this process boundary.

The worker deliberately refuses to download a model.  Install/package provisioning must put the
selected model into REMBG_HOME first; this prevents an implicit network dependency during visual
generation and keeps the weight-license gate explicit.
"""

from __future__ import annotations

import argparse
from io import BytesIO
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import time
from typing import Any

ALLOWED_MODELS = ("u2netp", "isnet-general-use")
ALPHA_THRESHOLD = 3


def fail(code: str, message: str) -> None:
    raise RuntimeError(f"{code}:{message}")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(value: Path) -> str:
    with value.open("rb") as handle:
        return sha256_bytes(handle.read())


def prepare_model_home(value: str, model: str) -> tuple[Path, Path]:
    if model not in ALLOWED_MODELS:
        fail("CUTOUT_MODEL_UNSUPPORTED", f"modelo no permitido: {model}")
    root = Path(value).resolve()
    model_path = root / "models" / model / f"{model}.onnx"
    if not model_path.is_file():
        fail("CUTOUT_MODEL_NOT_INSTALLED", f"modelo local ausente: {model}")
    os.environ["REMBG_HOME"] = str(root)
    os.environ.pop("U2NET_HOME", None)
    return root, model_path


def image_metrics(image: Any) -> dict[str, Any]:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    histogram = alpha.histogram()
    width, height = rgba.size
    total = width * height
    transparent = sum(histogram[: ALPHA_THRESHOLD + 1])
    visible = total - transparent
    mask = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    bbox = mask.getbbox()
    return {
        "width": width,
        "height": height,
        "rgbaPixelSha256": sha256_bytes(rgba.tobytes()),
        "alphaPresent": bool(min(alpha.getextrema()) < 255),
        "alphaUseful": bool(transparent > 0 and visible > 0),
        "transparentPixelPercent": round((transparent / total) * 100, 4) if total else 0,
        "alphaBoundingBox": None if bbox is None else {
            "x": bbox[0], "y": bbox[1], "width": bbox[2] - bbox[0], "height": bbox[3] - bbox[1],
        },
    }


def source_png_bytes(image_module: Any, source: Path, max_dimension: int) -> tuple[bytes, dict[str, int]]:
    with image_module.open(source) as original:
        original = original.convert("RGBA")
        source_width, source_height = original.size
        longest = max(original.size)
        if longest > max_dimension:
            scale = max_dimension / longest
            target = (max(1, round(source_width * scale)), max(1, round(source_height * scale)))
            original = original.resize(target, image_module.Resampling.LANCZOS)
        buffer = BytesIO()
        original.save(buffer, format="PNG")
        return buffer.getvalue(), {
            "sourceWidth": source_width,
            "sourceHeight": source_height,
            "processingWidth": original.width,
            "processingHeight": original.height,
        }


def action_transform(args: argparse.Namespace) -> dict[str, Any]:
    cache_root, model_path = prepare_model_home(args.cache, args.model)
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    if not source.is_file():
        fail("CUTOUT_SOURCE_MISSING", "raster local no existe")
    if output.exists():
        fail("CUTOUT_OUTPUT_CONFLICT", "salida temporal ya existe")
    if args.max_dimension < 128 or args.max_dimension > 4096:
        fail("CUTOUT_DIMENSION_INVALID", "max dimension fuera de rango")
    try:
        from PIL import Image  # type: ignore
        from rembg import new_session, remove  # type: ignore
        import onnxruntime  # type: ignore
    except Exception as error:
        fail("CUTOUT_RUNTIME_UNAVAILABLE", type(error).__name__)
    input_bytes, dimensions = source_png_bytes(Image, source, args.max_dimension)
    started_load = time.perf_counter()
    session = new_session(args.model)
    model_load_ms = (time.perf_counter() - started_load) * 1000
    started = time.perf_counter()
    output_bytes = remove(input_bytes, session=session)
    processing_ms = (time.perf_counter() - started) * 1000
    with Image.open(BytesIO(output_bytes)) as output_image:
        metrics = image_metrics(output_image)
    if not metrics["alphaPresent"] or not metrics["alphaUseful"]:
        fail("CUTOUT_OUTPUT_NO_USEFUL_ALPHA", "modelo no produjo alpha útil")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name("." + output.name + ".tmp")
    try:
        temporary.write_bytes(output_bytes)
        if sha256_file(temporary) != sha256_bytes(output_bytes):
            fail("CUTOUT_OUTPUT_VERIFY_FAILED", "SHA temporal no coincide")
        temporary.replace(output)
    finally:
        if temporary.exists():
            temporary.unlink()
    return {
        "status": "OK",
        "action": "transform",
        "model": args.model,
        "modelRevision": "sha256:" + sha256_file(model_path),
        "modelPath": str(model_path),
        "cacheRoot": str(cache_root),
        "sourceSha256": sha256_file(source),
        "outputSha256": sha256_bytes(output_bytes),
        "outputBytes": len(output_bytes),
        "modelLoadMs": round(model_load_ms, 3),
        "processingMs": round(processing_ms, 3),
        "runtime": {
            "python": sys.version.split()[0],
            "rembg": importlib.metadata.version("rembg"),
            "onnxruntime": onnxruntime.__version__,
            "providers": onnxruntime.get_available_providers(),
        },
        **dimensions,
        **metrics,
    }


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("action", choices=["transform"])
    result.add_argument("--input", required=True)
    result.add_argument("--output", required=True)
    result.add_argument("--cache", required=True)
    result.add_argument("--model", choices=ALLOWED_MODELS, default="u2netp")
    result.add_argument("--max-dimension", type=int, default=1024)
    return result


def main() -> int:
    args = parser().parse_args()
    print(json.dumps(action_transform(args), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        raw = str(error)
        code, _, message = raw.partition(":")
        print(json.dumps({"status": "FAIL", "code": code or "CUTOUT_WORKER_FAILED", "message": message or raw}, ensure_ascii=False), file=sys.stderr)
        raise
