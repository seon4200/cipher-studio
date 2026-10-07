"""Durable, secret-free job storage."""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


class JobStore:
    def __init__(self, root: Path):
        self.root = root
        self.plan_path = root / "plan.json"
        self.manifest_path = root / "manifest.json"
        self.progress_path = root / "progress.jsonl"
        self.lock = threading.RLock()
        self.manifest: dict[str, Any] = json.loads(self.manifest_path.read_text(encoding="utf-8"))

    def save_plan(self, plan: dict[str, Any]) -> None:
        write_json_atomic(self.plan_path, plan)

    def save(self) -> None:
        with self.lock:
            self.manifest["updatedAt"] = utc_now()
            write_json_atomic(self.manifest_path, self.manifest)

    def event(self, event: str, **fields: Any) -> None:
        record = {"at": utc_now(), "event": event, **fields}
        with self.lock:
            self.progress_path.parent.mkdir(parents=True, exist_ok=True)
            with self.progress_path.open("a", encoding="utf-8", newline="\n") as stream:
                stream.write(json.dumps(record, ensure_ascii=False) + "\n")

    def scene(self, scene_id: str) -> dict[str, Any]:
        for scene in self.manifest["scenes"]:
            if scene["sceneId"] == scene_id:
                return scene
        raise KeyError(scene_id)

    def update_scene(self, scene_id: str, event: str, **changes: Any) -> dict[str, Any]:
        with self.lock:
            scene = self.scene(scene_id)
            scene.update(changes)
            scene["updatedAt"] = utc_now()
            self.manifest["updatedAt"] = scene["updatedAt"]
            self.manifest["status"] = self._derive_job_status()
            write_json_atomic(self.manifest_path, self.manifest)
            with self.progress_path.open("a", encoding="utf-8", newline="\n") as stream:
                stream.write(json.dumps({"at": scene["updatedAt"], "event": event, "sceneId": scene_id, "status": scene.get("status")}, ensure_ascii=False) + "\n")
            return scene

    def update_root(self, event: str, **changes: Any) -> None:
        with self.lock:
            self.manifest.update(changes)
            self.manifest["updatedAt"] = utc_now()
            self.manifest["status"] = self._derive_job_status()
            write_json_atomic(self.manifest_path, self.manifest)
            with self.progress_path.open("a", encoding="utf-8", newline="\n") as stream:
                stream.write(json.dumps({"at": self.manifest["updatedAt"], "event": event}, ensure_ascii=False) + "\n")

    def _derive_job_status(self) -> str:
        statuses = [scene.get("status") for scene in self.manifest["scenes"]]
        if statuses and all(status == "complete" for status in statuses):
            status = "complete"
        elif any(status == "pending_reconciliation" for status in statuses) or self.manifest.get("projectStatus") == "pending_reconciliation":
            status = "pending_reconciliation"
        elif any(status == "failed" for status in statuses):
            status = "failed" if all(item == "failed" for item in statuses) else "partial_failure"
        elif (
            self.manifest.get("imageReviewRequired")
            and any(scene.get("status") == "image_ready" and not scene.get("animationApproved") for scene in self.manifest["scenes"])
            and all(status in ("complete", "image_ready") for status in statuses)
        ):
            status = "awaiting_visual_review"
        elif any(status != "queued" for status in statuses):
            status = "running"
        else:
            status = "queued"
        return status

    def refresh_job_status(self) -> str:
        self.manifest["status"] = self._derive_job_status()
        self.save()
        return self.manifest["status"]
