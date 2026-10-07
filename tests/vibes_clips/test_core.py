from __future__ import annotations

import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from vibes_clips.cipher_adapter import adapt_scene_to_cipher, local_file_url
from vibes_clips.engine import _process_scene, _reset_failed_scene, _scene_image_filename, create_job, execute_job, open_job
from vibes_clips.validation import validate_plan


ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "tests" / "vibes_clips" / "fixtures" / "one-scene.json"


class VibesClipsCoreTests(unittest.TestCase):
    def test_plan_is_valid_and_requires_no_secret(self) -> None:
        plan = json.loads(PLAN.read_text(encoding="utf-8"))
        self.assertEqual(len(validate_plan(plan)["scenes"]), 1)
        plan["meta_session"] = "not-allowed"
        with self.assertRaises(ValueError):
            validate_plan(plan)

    def test_images_only_contract_does_not_require_motion_or_generation_duration(self) -> None:
        plan = json.loads(PLAN.read_text(encoding="utf-8"))
        plan["generationMode"] = "images_only"
        for scene in plan["scenes"]:
            scene.pop("motionPrompt", None)
            scene.pop("targetDurationSeconds", None)
            scene["timelineDurationSeconds"] = 3
        self.assertEqual(len(validate_plan(plan)["scenes"]), 1)

    def test_job_persists_plan_and_initial_scene_state(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary))
            reopened = open_job(store.manifest["jobId"], Path(temporary))
            self.assertTrue(reopened.plan_path.is_file())
            self.assertEqual(reopened.scene("idea-se-ordena")["status"], "queued")
            self.assertEqual(reopened.manifest["schemaVersion"], 1)

    def test_finished_job_resume_does_not_authenticate_or_regenerate(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary))
            scene = store.scene("idea-se-ordena")
            scene.update(status="complete", file={"absolutePath": "C:/Downloads/clip.mp4", "durationSeconds": 5.1, "sizeBytes": 1024})
            store.manifest["status"] = "complete"
            store.save()
            result = execute_job(store)
            self.assertEqual(result["status"], "complete")
            self.assertEqual(scene["status"], "complete")

    def test_images_only_job_saves_preview_and_never_animates(self) -> None:
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")

        class FakeClient:
            image_requests = 0

            def generate_image(self, **_kwargs: object) -> dict:
                self.image_requests += 1
                return {"updatedBatch": {"id": "image-batch-1"}}

            def get_batch(self, _batch_id: str) -> dict:
                return {"isComplete": True, "hasError": False, "content": [{"id": "remote-image-1", "imageUrl": "remote://image"}]}

            def download_image(self, _item_id: str, path: str) -> None:
                Path(path).write_bytes(png)

            def manual_animate_image(self, **_kwargs: object) -> None:
                raise AssertionError("La fase de imágenes no debe iniciar una animación.")

        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary), images_only=True)
            store.update_root("test_project", remoteProjectId="project-1", projectStatus="ready")
            client = FakeClient()
            with patch("vibes_clips.engine.authenticated_client", return_value=(client, {})):
                result = execute_job(store, images_only=True)
            scene = store.scene("idea-se-ordena")
            self.assertEqual(result["status"], "awaiting_visual_review")
            self.assertEqual(scene["status"], "image_ready")
            self.assertFalse(scene["animationApproved"])
            self.assertEqual(client.image_requests, 1)
            self.assertTrue(Path(scene["imagePreview"]["absolutePath"]).is_file())
            self.assertEqual(scene["imagePreview"]["remoteContentItemId"], "remote-image-1")

    def test_resume_does_not_authenticate_or_animate_unapproved_preview(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary), images_only=True)
            scene = store.scene("idea-se-ordena")
            preview = store.root / "images" / "preview.png"
            preview.parent.mkdir()
            preview.write_bytes(b"reviewed image")
            scene.update(
                status="image_ready",
                currentImageBatchId="image-batch-1",
                imageContentItemId="image-content-1",
                selectedImageTechnicalValid=True,
                imagePreview={"absolutePath": str(preview)},
                animationApproved=False,
            )
            store.save()
            with patch("vibes_clips.engine.authenticated_client", side_effect=AssertionError("No debe iniciar sesión ni enviar una animación.")):
                result = execute_job(store)
            self.assertEqual(result["status"], "awaiting_visual_review")
            self.assertEqual(scene["status"], "image_ready")

    def test_explicit_image_approval_is_required_before_processing_animation(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary), images_only=True)
            preview = store.root / "images" / "preview.png"
            preview.parent.mkdir()
            preview.write_bytes(b"reviewed image")
            store.update_root("test_project", remoteProjectId="project-1", projectStatus="ready")
            store.update_scene(
                "idea-se-ordena",
                "test_image_ready",
                status="image_ready",
                currentImageBatchId="image-batch-1",
                imageContentItemId="image-content-1",
                selectedImageTechnicalValid=True,
                imagePreview={"absolutePath": str(preview)},
                animationApproved=False,
            )
            with patch("vibes_clips.engine.authenticated_client", return_value=(object(), {})), patch("vibes_clips.engine._process_scene") as process:
                execute_job(store, approved_scene_ids=["idea-se-ordena"])
            self.assertTrue(store.scene("idea-se-ordena")["animationApproved"])
            process.assert_called_once()

    def test_rejected_composition_cannot_be_approved_for_animation(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary), images_only=True)
            preview = store.root / "images" / "preview.png"
            preview.parent.mkdir()
            preview.write_bytes(b"reviewed image")
            store.update_scene(
                "idea-se-ordena",
                "test_image_rejected",
                status="image_ready",
                currentImageBatchId="image-batch-1",
                imageContentItemId="image-content-1",
                selectedImageTechnicalValid=True,
                imagePreview={"absolutePath": str(preview)},
                compositionReview="rejected",
                animationApproved=False,
            )
            with patch("vibes_clips.engine.authenticated_client", side_effect=AssertionError("A rejected image must not authenticate or animate.")):
                with self.assertRaisesRegex(ValueError, "fue rechazada"):
                    execute_job(store, approved_scene_ids=["idea-se-ordena"])

    def test_interrupted_generation_reconciles_before_any_new_request(self) -> None:
        class NoMatchClient:
            def list_project_batches(self, _project_id: str, **_kwargs: object) -> dict:
                return {"batches": []}

            def generate_image(self, **_kwargs: object) -> None:
                raise AssertionError("No se debe duplicar la generación al reanudar.")

        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary))
            store.manifest["remoteProjectId"] = "project-1"
            scene = store.scene("idea-se-ordena")
            scene.update(status="image_generating", stage="image_generation", stageStartedAt=scene["createdAt"])
            store.save()
            _process_scene(NoMatchClient(), store, "idea-se-ordena", poll_timeout=1)
            self.assertEqual(scene["status"], "pending_reconciliation")
            self.assertEqual(scene["reconcileStage"], "image_generation")

    def test_retry_requires_failed_scene_and_preserves_remote_history(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary))
            scene = store.scene("idea-se-ordena")
            scene.update(status="failed", imageBatchIds=["old-image-batch"], error="known failure")
            _reset_failed_scene(store, "idea-se-ordena")
            self.assertEqual(scene["status"], "queued")
            self.assertEqual(scene["attempts"], 2)
            self.assertEqual(scene["imageBatchIds"], ["old-image-batch"])
            with self.assertRaises(ValueError):
                _reset_failed_scene(store, "idea-se-ordena")

    def test_failed_image_download_reuses_saved_remote_image_ids(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary), images_only=True)
            scene = store.scene("idea-se-ordena")
            scene.update(
                status="failed", stage="image_preview", currentImageBatchId="batch-existing",
                imageContentItemId="content-existing", imageBatchIds=["batch-existing"], error="download timeout",
            )
            store.save()
            _reset_failed_scene(store, "idea-se-ordena")
            self.assertEqual(scene["status"], "image_generating")
            self.assertEqual(scene["stage"], "image_poll")
            self.assertEqual(scene["currentImageBatchId"], "batch-existing")
            self.assertEqual(scene["imageContentItemId"], "content-existing")
            self.assertEqual(scene["imageBatchIds"], ["batch-existing"])

    def test_retry_of_reviewed_job_requires_new_visual_approval_and_keeps_old_preview(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary), images_only=True)
            old_preview = store.root / "images" / "001_idea-se-ordena.png"
            old_preview.parent.mkdir()
            old_preview.write_bytes(b"old preview")
            scene = store.scene("idea-se-ordena")
            scene.update(status="failed", attempts=1, animationApproved=True, compositionReview="approved", imagePreview={"absolutePath": str(old_preview)})
            store.save()
            _reset_failed_scene(store, "idea-se-ordena")
            self.assertFalse(scene["animationApproved"])
            self.assertEqual(scene["compositionReview"], "pending")
            self.assertIsNone(scene["imagePreview"])
            self.assertTrue(old_preview.is_file())
            self.assertEqual(_scene_image_filename(scene), "001_idea-se-ordena_attempt-02.png")

    def test_approved_animation_uses_selected_remote_image_without_regenerating(self) -> None:
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
        class FakeClient:
            def generate_image(self, **_kwargs: object) -> None:
                raise AssertionError("No se debe regenerar una imagen existente.")
            def get_batch(self, batch_id: str) -> dict:
                if batch_id == "image-batch-existing":
                    return {"isComplete": True, "content": [
                        {"id": "another-variant", "imageUrl": "remote://other"},
                        {"id": "selected-image", "imageUrl": "remote://selected"},
                    ]}
                if batch_id == "video-batch-existing":
                    return {"isComplete": True, "content": [{"id": "video-result", "videoUrl": "remote://video"}]}
                raise AssertionError(f"Lote inesperado: {batch_id}")
            def download_image(self, _item_id: str, path: str) -> None:
                Path(path).write_bytes(png)
            def manual_animate_image(self, **kwargs: object) -> dict:
                self.source_id = kwargs["source_image"]["id"]
                return {"updatedBatch": {"id": "video-batch-existing"}}
            def download_video(self, _item_id: str, path: str) -> None:
                Path(path).write_bytes(b"fake video")
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary), images_only=True)
            store.manifest["remoteProjectId"] = "project-1"
            scene = store.scene("idea-se-ordena")
            preview = store.root / "images" / "selected.png"
            preview.parent.mkdir()
            preview.write_bytes(png)
            scene.update(status="image_ready", stage=None, currentImageBatchId="image-batch-existing",
                imageContentItemId="selected-image", selectedImageTechnicalValid=True, imagePreview={"absolutePath": str(preview)},
                animationApproved=True, currentVideoBatchId=None, motionPrompt="Keep subject and scene fixed.")
            store.manifest["imageReviewRequired"] = True
            store.save()
            client = FakeClient()
            with patch("vibes_clips.engine.authenticated_client", return_value=(client, {})), \
                 patch("vibes_clips.engine.probe_and_decode_video", return_value={"durationSeconds": 3.0, "sizeBytes": 9}):
                result = execute_job(store)
            self.assertEqual(result["status"], "complete")
            self.assertEqual(client.source_id, "selected-image")
            self.assertEqual(scene["currentImageBatchId"], "image-batch-existing")
            self.assertEqual(scene["currentVideoBatchId"], "video-batch-existing")

    def test_video_download_retry_preserves_remote_ids_and_only_polls(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary), images_only=True)
            scene = store.scene("idea-se-ordena")
            scene.update(status="failed", stage="download", animationApproved=True, currentImageBatchId="image-batch-1",
                imageContentItemId="image-1", currentVideoBatchId="video-batch-1", videoContentItemId="video-1")
            store.save()
            _reset_failed_scene(store, "idea-se-ordena")
            self.assertEqual(scene["status"], "video_generating")
            self.assertEqual(scene["stage"], "video_poll")
            self.assertEqual(scene["currentVideoBatchId"], "video-batch-1")
            self.assertEqual(scene["videoContentItemId"], "video-1")
            self.assertEqual(scene["imageContentItemId"], "image-1")

    def test_manifest_job_status_tracks_scene_progress(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            store = create_job(PLAN, Path(temporary))
            store.update_scene("idea-se-ordena", "started", status="video_generating")
            self.assertEqual(store.manifest["status"], "running")
            store.update_scene("idea-se-ordena", "uncertain", status="pending_reconciliation")
            self.assertEqual(store.manifest["status"], "pending_reconciliation")

    def test_cipher_adapter_matches_clip_contract_and_encodes_windows_path(self) -> None:
        manifest = {
            "jobId": "abc123",
            "scenes": [{
                "sceneId": "idea-se-ordena",
                "sceneNumber": 1,
                "status": "complete",
                "targetDurationSeconds": 5,
                "scriptPosition": None,
                "file": {"absolutePath": r"C:\Temp\vibes-test\clip #1.mp4", "durationSeconds": 5.2, "sizeBytes": 1048576},
            }],
        }
        clip = adapt_scene_to_cipher(manifest, "idea-se-ordena")
        self.assertEqual(clip["type"], "video")
        self.assertEqual(clip["category"], "ia")
        self.assertEqual(clip["durationSeconds"], 5.2)
        self.assertEqual(clip["duration"], "0:05")
        self.assertEqual(clip["targetDurationSeconds"], 5)
        self.assertIn("vibes-test", clip["url"])
        self.assertIn("%23", clip["url"])
        self.assertEqual(local_file_url(r"C:\folder with spaces\a#b.mp4"), "file:///C:/folder%20with%20spaces/a%23b.mp4")
        self.assertEqual(local_file_url(r"C:\folder\a!b.mp4"), "file:///C:/folder/a!b.mp4")

    def test_cipher_adapter_exposes_image_exposure_without_video_duration(self) -> None:
        manifest = {
            "jobId": "abc123",
            "generationMode": "images_only",
            "scenes": [{
                "sceneId": "idea-se-ordena", "sceneNumber": 1, "status": "image_ready",
                "timelineDurationSeconds": 3, "styleVersion": "vibes-editorial-photographic-paper@2.0.0",
                "scriptPosition": {"startSeconds": 224.08, "endSeconds": 227.08},
                "currentImageBatchId": "image-batch-1", "imageContentItemId": "remote-image-1",
                "imageBatchIds": ["image-batch-1"],
                "imagePreview": {"absolutePath": r"C:\Project\materiales\ia\vibes\images\01.png", "sizeBytes": 1024},
            }],
        }
        clip = adapt_scene_to_cipher(manifest, "idea-se-ordena")
        self.assertEqual(clip["type"], "image")
        self.assertEqual(clip["mediaKind"], "image")
        self.assertEqual(clip["durationSeconds"], 0)
        self.assertEqual(clip["exposureDurationSeconds"], 3)
        self.assertEqual(clip["remoteImageBatchId"], "image-batch-1")
        self.assertEqual(clip["remoteContentItemId"], "remote-image-1")


if __name__ == "__main__":
    unittest.main()
