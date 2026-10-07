"""Command-line entry point: run a scene plan or resume a saved job."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from .cipher_adapter import adapt_scene_to_cipher
from .engine import create_job, execute_job, open_job, summarize_job
from .validation import load_plan


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="vibes-clips", description="Genera y reanuda clips individuales de Vibes para Cipher Studio.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    run = subparsers.add_parser("run", help="Ejecuta un plan JSON y crea un trabajo local.")
    run.add_argument("plan", type=Path)
    run.add_argument("--concurrency", type=int, choices=(1, 2), help="Escenas simultáneas (1 por defecto; máximo 2).")
    run.add_argument("--images-only", action="store_true", help="Genera y guarda imágenes para revisión visual sin animarlas.")
    run.add_argument("--output-root", type=Path, help="Carpeta en la que se guarda el trabajo local (el bot crea una carpeta por jobId).")
    resume = subparsers.add_parser("resume", help="Reanuda un trabajo guardado sin regenerar escenas terminadas.")
    resume.add_argument("job_id", help="jobId UUID o ruta absoluta de la carpeta del trabajo.")
    resume.add_argument("--concurrency", type=int, choices=(1, 2))
    resume.add_argument("--retry-scene", action="append", help="Reintenta esta escena fallida; se puede repetir para varias descargas pendientes.")
    resume.add_argument("--animate-approved", action="append", default=[], metavar="SCENE_ID", help="Anima una escena cuya imagen ya revisaste. Se puede repetir para varias escenas.")
    resume.add_argument("--cipher-json", action="store_true", help="Imprime el adaptador de Cipher de las escenas terminadas.")
    validate = subparsers.add_parser("validate-plan", help="Valida el plan sin autenticarse ni generar contenido.")
    validate.add_argument("plan", type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "validate-plan":
            plan = load_plan(args.plan)
            print(f"Plan válido: {len(plan['scenes'])} escena(s), estilo {plan['styleVersion']}.")
            return 0
        if args.command == "run":
            plan = load_plan(args.plan)
            if plan.get("generationMode") == "images_only" and not args.images_only:
                raise ValueError("Este plan requiere --images-only; no se enviará a animación.")
            store = create_job(args.plan, output_root=args.output_root, images_only=args.images_only)
            print(f"Trabajo creado: {store.manifest['jobId']}\nSalida: {store.root}", flush=True)
            result = execute_job(store, concurrency=args.concurrency, images_only=args.images_only)
        else:
            store = open_job(args.job_id)
            result = execute_job(
                store,
                concurrency=args.concurrency,
                retry_scene=args.retry_scene,
                approved_scene_ids=args.animate_approved,
            )
        print(summarize_job(result))
        if args.command == "resume" and args.cipher_json:
            compatible = [
                adapt_scene_to_cipher(result, scene["sceneId"])
                for scene in result["scenes"]
                if scene.get("status") == "complete"
                or (result.get("generationMode") == "images_only" and scene.get("status") == "image_ready")
            ]
            print(json.dumps(compatible, ensure_ascii=False, indent=2))
        print(f"Manifest: {store.manifest_path}")
        return 0 if result.get("status") in ("complete", "awaiting_visual_review") else 2
    except Exception as exc:
        print(f"Error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
