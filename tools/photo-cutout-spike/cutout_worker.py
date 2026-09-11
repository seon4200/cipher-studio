#!/usr/bin/env python3
"""Isolated local benchmark worker for the V15 photo-cutout feasibility spike.

This file is deliberately not imported by Cipher Studio.  It accepts only local
raster paths, invokes rembg in an external venv, and emits JSON diagnostics.
Provider search, ProjectAsset publication, SceneSpec compilation and rendering
remain owned by the existing V15 code paths.

The worker uses an explicit REMBG_HOME so model downloads/cache never leak into
the user profile or Cipher's packaged runtime.  Only the two models authorised
for this spike are accepted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import statistics
import sys
import time
from pathlib import Path
from typing import Any

ALLOWED_MODELS = ("u2netp", "isnet-general-use")
ALPHA_THRESHOLD = 3


def fail(message: str) -> None:
    raise RuntimeError(message)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(value: Path) -> str:
    with value.open("rb") as handle:
        return sha256_bytes(handle.read())


def set_model_home(value: str) -> Path:
    root = Path(value).resolve()
    root.mkdir(parents=True, exist_ok=True)
    # Current rembg prefers REMBG_HOME; remove a legacy override so this worker
    # cannot accidentally read/write a user-level U2NET_HOME cache.
    os.environ["REMBG_HOME"] = str(root)
    os.environ.pop("U2NET_HOME", None)
    return root


def rembg_modules() -> tuple[Any, Any, Any, Any, Any]:
    # Import after REMBG_HOME is set. Pillow and psutil are dependencies of the
    # isolated venv, not of the Electron product.
    from PIL import Image, ImageDraw, ImageFont, ImageOps  # type: ignore
    import psutil  # type: ignore
    from rembg import new_session, remove  # type: ignore
    from rembg.sessions import sessions  # type: ignore
    return (Image, ImageDraw, ImageFont, ImageOps), psutil, new_session, remove, sessions


def model_class(model: str, sessions: Any) -> Any:
    if model not in ALLOWED_MODELS:
        fail(f"modelo no autorizado para spike: {model}")
    session = sessions.get(model)
    if session is None:
        fail(f"rembg no expone el modelo solicitado: {model}")
    return session


def model_files(root: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for candidate in sorted(root.rglob("*.onnx")):
        if candidate.is_file():
            rows.append({
                "path": str(candidate),
                "bytes": candidate.stat().st_size,
                "sha256": sha256_file(candidate),
            })
    return rows


def percentile(values: list[float], ratio: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * ratio))))
    return ordered[index]


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


def load_resized_source(image_module: Any, source: Path, max_dimension: int) -> tuple[Any, dict[str, int]]:
    with image_module.open(source) as original:
        original = original.convert("RGBA")
        original_width, original_height = original.size
        longest = max(original.size)
        if longest > max_dimension:
            scale = max_dimension / longest
            target = (max(1, round(original_width * scale)), max(1, round(original_height * scale)))
            original = original.resize(target, image_module.Resampling.LANCZOS)
        return original.copy(), {
            "sourceWidth": original_width,
            "sourceHeight": original_height,
            "processingWidth": original.width,
            "processingHeight": original.height,
        }


def action_download(args: argparse.Namespace) -> dict[str, Any]:
    cache_root = set_model_home(args.cache)
    _, _, _, _, sessions = rembg_modules()
    session_class = model_class(args.model, sessions)
    before = model_files(cache_root)
    expected_model = cache_root / "models" / args.model / f"{args.model}.onnx"
    was_warm = expected_model.is_file()
    started = time.perf_counter()
    model_path = Path(session_class.download_models()).resolve()
    elapsed = (time.perf_counter() - started) * 1000
    after = model_files(cache_root)
    return {
        "action": "download",
        "model": args.model,
        "cacheRoot": str(cache_root),
        "modelDownloadMs": round(elapsed, 3),
        # A cache can contain a different model; warm/cold belongs to this exact model.
        "cacheWasWarm": was_warm,
        "modelPath": str(model_path),
        "modelBytes": model_path.stat().st_size,
        "modelSha256": sha256_file(model_path),
        "modelFiles": after,
    }


def action_load(args: argparse.Namespace) -> dict[str, Any]:
    cache_root = set_model_home(args.cache)
    _, psutil, new_session, _, sessions = rembg_modules()
    model_class(args.model, sessions)
    process = psutil.Process(os.getpid())
    before = process.memory_info().rss
    started = time.perf_counter()
    new_session(args.model)
    elapsed = (time.perf_counter() - started) * 1000
    after = process.memory_info().rss
    return {
        "action": "load",
        "model": args.model,
        "cacheRoot": str(cache_root),
        "coldModelLoadMs": round(elapsed, 3),
        "rssBeforeBytes": before,
        "rssAfterBytes": after,
        "runtime": runtime_details(),
    }


def action_benchmark(args: argparse.Namespace) -> dict[str, Any]:
    cache_root = set_model_home(args.cache)
    (Image, _, _, _), psutil, new_session, remove, sessions = rembg_modules()
    model_class(args.model, sessions)
    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    cases = manifest.get("cases")
    if not isinstance(cases, list) or not cases:
        fail("manifest sin casos")
    output_root = Path(args.output_dir).resolve() / args.model / f"max-{args.max_dimension}"
    output_root.mkdir(parents=True, exist_ok=True)
    process = psutil.Process(os.getpid())
    peak_rss = process.memory_info().rss
    started_load = time.perf_counter()
    session = new_session(args.model)
    model_load_ms = (time.perf_counter() - started_load) * 1000
    peak_rss = max(peak_rss, process.memory_info().rss)
    rows: list[dict[str, Any]] = []
    warm_times: list[float] = []
    cold_inference_ms: float | None = None
    first_output_paths: list[str] = []
    for case_index, case in enumerate(cases):
        case_id = str(case.get("id", ""))
        if not case_id or any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for ch in case_id.lower()):
            fail(f"case id inválido: {case_id!r}")
        source = Path(str(case.get("sourcePath", ""))).resolve()
        if not source.is_file():
            fail(f"source local ausente: {source}")
        source_image, dimensions = load_resized_source(Image, source, args.max_dimension)
        input_bytes_path = output_root / f".{case_id}.input.png"
        source_image.save(input_bytes_path, format="PNG")
        input_bytes = input_bytes_path.read_bytes()
        try:
            input_bytes_path.unlink()
        except FileNotFoundError:
            pass
        runs: list[dict[str, Any]] = []
        for run_index in range(args.warm_runs):
            started = time.perf_counter()
            output_bytes = remove(input_bytes, session=session)
            elapsed = (time.perf_counter() - started) * 1000
            output_path = output_root / (f"{case_id}.png" if run_index == 0 else f"{case_id}.repeat-{run_index}.png")
            output_path.write_bytes(output_bytes)
            with Image.open(output_path) as output_image:
                metrics = image_metrics(output_image)
            peak_rss = max(peak_rss, process.memory_info().rss)
            result = {
                "run": run_index + 1,
                "processingMs": round(elapsed, 3),
                "fileSha256": sha256_bytes(output_bytes),
                "outputPath": str(output_path),
                "outputBytes": len(output_bytes),
                **metrics,
            }
            runs.append(result)
            if case_index == 0 and run_index < 2:
                first_output_paths.append(str(output_path))
            if cold_inference_ms is None:
                cold_inference_ms = elapsed
            else:
                warm_times.append(elapsed)
        rows.append({
            "id": case_id,
            "label": str(case.get("label", case_id)),
            "sourcePath": str(source),
            "sourceSha256": sha256_file(source),
            "sourceBytes": source.stat().st_size,
            **dimensions,
            "runs": runs,
        })
    determinism: dict[str, Any] = {"fileDeterministic": None, "pixelDeterministic": None}
    if len(first_output_paths) == 2:
        with Image.open(first_output_paths[0]) as first, Image.open(first_output_paths[1]) as second:
            first_metrics = image_metrics(first)
            second_metrics = image_metrics(second)
        determinism = {
            "caseId": rows[0]["id"],
            "firstOutput": first_output_paths[0],
            "secondOutput": first_output_paths[1],
            "fileDeterministic": sha256_file(Path(first_output_paths[0])) == sha256_file(Path(first_output_paths[1])),
            "pixelDeterministic": first_metrics["rgbaPixelSha256"] == second_metrics["rgbaPixelSha256"],
        }
    return {
        "action": "benchmark",
        "model": args.model,
        "cacheRoot": str(cache_root),
        "maxDimension": args.max_dimension,
        "warmRunsPerCase": args.warm_runs,
        "benchmarkSessionLoadMs": round(model_load_ms, 3),
        "coldInferenceMs": None if cold_inference_ms is None else round(cold_inference_ms, 3),
        "warmMedianMs": None if not warm_times else round(statistics.median(warm_times), 3),
        "warmP95Ms": None if not warm_times else round(percentile(warm_times, 0.95), 3),
        "warmSamples": len(warm_times),
        "peakRssBytes": peak_rss,
        "runtime": runtime_details(),
        "determinism": determinism,
        "cases": rows,
    }


def default_font(image_font: Any, size: int) -> Any:
    for candidate in [
        Path(os.environ.get("WINDIR", "C:\\Windows")) / "Fonts" / "arial.ttf",
        Path(os.environ.get("WINDIR", "C:\\Windows")) / "Fonts" / "segoeui.ttf",
    ]:
        if candidate.is_file():
            return image_font.truetype(str(candidate), size)
    return image_font.load_default()


def checker(image: Any, size: tuple[int, int], square: int = 24) -> Any:
    _, ImageDraw, _, _ = rembg_modules()[0]
    canvas = image.new("RGBA", size, "#7a7a7a")
    draw = ImageDraw.Draw(canvas)
    for y in range(0, size[1], square):
        for x in range(0, size[0], square):
            if ((x // square) + (y // square)) % 2 == 0:
                draw.rectangle((x, y, x + square - 1, y + square - 1), fill="#bdbdbd")
    return canvas


def fit_on(image: Any, background: Any, area: tuple[int, int], margin: int = 12) -> Any:
    Image, _, _, ImageOps = rembg_modules()[0]
    contained = ImageOps.contain(
        image.convert("RGBA"),
        (area[0] - margin * 2, area[1] - margin * 2),
        method=Image.Resampling.LANCZOS,
    )
    x = (area[0] - contained.width) // 2
    y = (area[1] - contained.height) // 2
    background.alpha_composite(contained, (x, y))
    return background


def action_quality_sheet(args: argparse.Namespace) -> dict[str, Any]:
    (Image, ImageDraw, ImageFont, _), _, _, _, _ = rembg_modules()
    benchmark = json.loads(Path(args.benchmark).read_text(encoding="utf-8"))
    models = benchmark.get("models", {})
    if not all(model in models for model in ALLOWED_MODELS):
        fail("quality-sheet requiere benchmark de ambos modelos")
    rows_by_model = {model: {row["id"]: row for row in data["cases"]} for model, data in models.items()}
    case_ids = [row["id"] for row in models[ALLOWED_MODELS[0]]["cases"]]
    tile_w, tile_h, label_h = 250, 210, 48
    columns = ["SOURCE", "u2netp / black", "u2netp / white", "u2netp / checker",
               "isnet / black", "isnet / white", "isnet / checker"]
    sheet = Image.new("RGBA", (tile_w * len(columns), label_h + (tile_h + label_h) * len(case_ids)), "#111114")
    draw = ImageDraw.Draw(sheet)
    font = default_font(ImageFont, 17)
    small = default_font(ImageFont, 13)
    for col, label in enumerate(columns):
        x = col * tile_w
        draw.rectangle((x, 0, x + tile_w, label_h), fill="#202027")
        draw.text((x + 8, 10), label, fill="white", font=font)
    for row_index, case_id in enumerate(case_ids):
        row_y = label_h + row_index * (tile_h + label_h)
        source_row = rows_by_model[ALLOWED_MODELS[0]][case_id]
        source = Image.open(source_row["sourcePath"]).convert("RGBA")
        cells: list[tuple[str, Any]] = [(
            source_row["label"],
            fit_on(source, Image.new("RGBA", (tile_w, tile_h), "#222228"), (tile_w, tile_h)),
        )]
        for model in ALLOWED_MODELS:
            output = Image.open(rows_by_model[model][case_id]["runs"][0]["outputPath"]).convert("RGBA")
            for background_name, background in [
                ("black", Image.new("RGBA", (tile_w, tile_h), "#0D0D0F")),
                ("white", Image.new("RGBA", (tile_w, tile_h), "#FFFFFF")),
                ("checker", checker(Image, (tile_w, tile_h))),
            ]:
                cells.append((f"{case_id} / {background_name}", fit_on(output, background, (tile_w, tile_h))))
        for col, (label, cell) in enumerate(cells):
            x = col * tile_w
            sheet.alpha_composite(cell, (x, row_y))
            draw.rectangle((x, row_y + tile_h, x + tile_w, row_y + tile_h + label_h), fill="#202027")
            draw.text((x + 8, row_y + tile_h + 8), label, fill="#eeeeee", font=small)
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output, format="PNG", optimize=True)
    return {"action": "quality-sheet", "output": str(output), "width": sheet.width, "height": sheet.height}


def action_motion_sheet(args: argparse.Namespace) -> dict[str, Any]:
    (Image, ImageDraw, ImageFont, _), _, _, _, _ = rembg_modules()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    cells = manifest.get("cells")
    if not isinstance(cells, list) or not cells:
        fail("motion-sheet requiere cells")
    tile_w, tile_h, label_h = 360, 640, 56
    columns = min(4, len(cells))
    rows = (len(cells) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * tile_w, rows * (tile_h + label_h)), "#0D0D0F")
    draw = ImageDraw.Draw(sheet)
    font = default_font(ImageFont, 16)
    for index, cell in enumerate(cells):
        source = Path(str(cell.get("path", ""))).resolve()
        if not source.is_file():
            fail(f"motion cell missing: {source}")
        image = Image.open(source).convert("RGBA")
        column, row = index % columns, index // columns
        x, y = column * tile_w, row * (tile_h + label_h)
        surface = Image.new("RGBA", (tile_w, tile_h), "#111118")
        sheet.alpha_composite(fit_on(image, surface, (tile_w, tile_h), 0), (x, y))
        draw.rectangle((x, y + tile_h, x + tile_w, y + tile_h + label_h), fill="#202027")
        draw.text((x + 10, y + tile_h + 10), str(cell.get("label", source.name)), fill="white", font=font)
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output, format="PNG", optimize=True)
    return {"action": "motion-sheet", "output": str(output), "width": sheet.width, "height": sheet.height}


def runtime_details() -> dict[str, Any]:
    import importlib.metadata
    import onnxruntime  # type: ignore
    return {
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "rembg": importlib.metadata.version("rembg"),
        "onnxruntime": onnxruntime.__version__,
        "providers": onnxruntime.get_available_providers(),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["download", "load", "benchmark", "quality-sheet", "motion-sheet"])
    parser.add_argument("--model", choices=ALLOWED_MODELS)
    parser.add_argument("--cache")
    parser.add_argument("--manifest")
    parser.add_argument("--output-dir")
    parser.add_argument("--output")
    parser.add_argument("--benchmark")
    parser.add_argument("--max-dimension", type=int, default=1024)
    parser.add_argument("--warm-runs", type=int, default=3)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.action in {"download", "load", "benchmark"} and (not args.model or not args.cache):
        fail("--model y --cache son obligatorios")
    if args.action == "benchmark":
        if not args.manifest or not args.output_dir or args.max_dimension not in {512, 1024} or args.warm_runs < 2:
            fail("benchmark requiere --manifest, --output-dir, dimensión 512/1024 y >=2 warm runs")
    if args.action == "quality-sheet" and (not args.benchmark or not args.output):
        fail("quality-sheet requiere --benchmark y --output")
    if args.action == "motion-sheet" and (not args.manifest or not args.output):
        fail("motion-sheet requiere --manifest y --output")
    if args.action == "download":
        result = action_download(args)
    elif args.action == "load":
        result = action_load(args)
    elif args.action == "benchmark":
        result = action_benchmark(args)
    elif args.action == "quality-sheet":
        result = action_quality_sheet(args)
    else:
        result = action_motion_sheet(args)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # No traceback in machine-readable benchmark output.
        print(json.dumps({"status": "FAIL", "error": type(error).__name__, "message": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise
