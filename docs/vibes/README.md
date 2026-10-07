# Vibes

Vibes is the AI workflow inside Cipher's **IA** area. Its Python bot is installed from `requirements-vibes.txt`; the desktop IPC service connects it to DeepSeek prompt preparation, image creation, and image-to-video jobs. Credentials come from the existing authorized environment and never belong in project files or Git.

Vibes has its own versioned profile: `vibes-editorial-photographic-paper@2.0.0` in `src/shared/vibes-editorial-photographic-paper-v2.ts`. It does not replace Animation's active procedural style. Project references, prompts, images, voice, manifests, remote job IDs, and generated results stay under that project's `materiales/ia/vibes/` directory.

Image-to-video reuses the selected image. It keeps the protagonist, background, and camera fixed; only the specified supporting graphics may move. Jobs are persisted and resumed before new requests are sent.

Install the bot with:

```powershell
python -m pip install -r requirements-vibes.txt
python -m vibes_clips --help
```

The Python executable can be selected by `CIPHER_VIBES_PYTHON`; credentials are supplied through the existing authorized secret store/environment, not in command-line examples.
