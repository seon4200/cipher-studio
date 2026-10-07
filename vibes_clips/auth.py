"""Local-only Vibes authentication using Windows Credential Manager."""

from __future__ import annotations

import ctypes
import os
import sys
from ctypes import wintypes
from typing import Any


_TARGET = "CipherStudio.VibesClips.meta_session"
_CRED_TYPE_GENERIC = 1
_CRED_PERSIST_LOCAL_MACHINE = 2


def _credential_api() -> Any:
    if os.name != "nt":
        raise RuntimeError("El almacenamiento protegido de esta fase requiere Windows.")
    return ctypes.WinDLL("Advapi32.dll", use_last_error=True)


class _FILETIME(ctypes.Structure):
    _fields_ = [("dwLowDateTime", wintypes.DWORD), ("dwHighDateTime", wintypes.DWORD)]


class _CREDENTIALW(ctypes.Structure):
    pass


_CREDENTIALW._fields_ = [
    ("Flags", wintypes.DWORD),
    ("Type", wintypes.DWORD),
    ("TargetName", wintypes.LPWSTR),
    ("Comment", wintypes.LPWSTR),
    ("LastWritten", _FILETIME),
    ("CredentialBlobSize", wintypes.DWORD),
    ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
    ("Persist", wintypes.DWORD),
    ("AttributeCount", wintypes.DWORD),
    ("Attributes", ctypes.c_void_p),
    ("TargetAlias", wintypes.LPWSTR),
    ("UserName", wintypes.LPWSTR),
]


def _read_saved_cookie() -> str | None:
    api = _credential_api()
    read = api.CredReadW
    read.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.POINTER(_CREDENTIALW))]
    read.restype = wintypes.BOOL
    free = api.CredFree
    free.argtypes = [ctypes.c_void_p]
    free.restype = None
    pointer = ctypes.POINTER(_CREDENTIALW)()
    if not read(_TARGET, _CRED_TYPE_GENERIC, 0, ctypes.byref(pointer)):
        error = ctypes.get_last_error()
        if error == 1168:  # ERROR_NOT_FOUND
            return None
        raise OSError(error, "No se pudo leer la credencial Vibes del usuario.")
    try:
        credential = pointer.contents
        raw = ctypes.string_at(credential.CredentialBlob, credential.CredentialBlobSize)
        return raw.decode("utf-8") if raw else None
    finally:
        free(pointer)


def _save_cookie(cookie: str) -> None:
    api = _credential_api()
    write = api.CredWriteW
    write.argtypes = [ctypes.POINTER(_CREDENTIALW), wintypes.DWORD]
    write.restype = wintypes.BOOL
    payload = cookie.encode("utf-8")
    blob = (ctypes.c_ubyte * len(payload)).from_buffer_copy(payload)
    credential = _CREDENTIALW()
    credential.Type = _CRED_TYPE_GENERIC
    credential.TargetName = _TARGET
    credential.Comment = "Vibes session for local Cipher Studio clip generation"
    credential.CredentialBlobSize = len(payload)
    credential.CredentialBlob = ctypes.cast(blob, ctypes.POINTER(ctypes.c_ubyte))
    credential.Persist = _CRED_PERSIST_LOCAL_MACHINE
    credential.UserName = "meta_session"
    if not write(ctypes.byref(credential), 0):
        raise OSError(ctypes.get_last_error(), "No se pudo guardar la credencial en Windows Credential Manager.")


def _delete_saved_cookie() -> None:
    api = _credential_api()
    delete = api.CredDeleteW
    delete.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]
    delete.restype = wintypes.BOOL
    if not delete(_TARGET, _CRED_TYPE_GENERIC, 0):
        error = ctypes.get_last_error()
        if error != 1168:
            raise OSError(error, "No se pudo borrar la credencial Vibes caducada.")


def _prompt_cookie() -> str:
    try:
        import tkinter as tk
        from tkinter import simpledialog
    except Exception as exc:  # pragma: no cover - depends on local Python packaging
        raise RuntimeError("Python necesita Tkinter para abrir la entrada local oculta.") from exc

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        value = simpledialog.askstring(
            "Sesión local de Vibes",
            "Pega el valor de la cookie meta_session. La entrada está oculta; se guardará en Windows Credential Manager.",
            show="*",
            parent=root,
        )
        if not value:
            raise RuntimeError("No se proporcionó una sesión Vibes.")
        return value.strip()
    finally:
        root.destroy()


def _looks_like_auth_error(exc: BaseException) -> bool:
    status = getattr(exc, "status", None)
    message = str(exc).lower()
    return status == 401 or "401" in message or "unauthorized" in message or "session expired" in message


def authenticated_client() -> tuple[Any, dict[str, Any]]:
    """Return a live Vibes client and identity; prompt locally only when needed."""
    try:
        from vibes_api import VibesClient
    except ImportError as exc:
        raise RuntimeError("No se encontró VibesAI-api. Instala requirements-vibes.txt en el entorno Python local.") from exc

    cookie = _read_saved_cookie()
    if cookie:
        client = VibesClient(meta_session=cookie)
        try:
            identity = client.get_me()
            return client, identity
        except Exception as exc:
            if not _looks_like_auth_error(exc):
                raise RuntimeError(f"No se pudo comprobar la sesión Vibes: {type(exc).__name__}.") from None
            _delete_saved_cookie()

    cookie = _prompt_cookie()
    client = VibesClient(meta_session=cookie)
    try:
        identity = client.get_me()
    except Exception as exc:
        # Never echo the exception: API layers may include request details.
        raise RuntimeError(f"Vibes rechazó la sesión introducida ({type(exc).__name__}). Vuelve a copiarla localmente.") from None
    _save_cookie(cookie)
    # Drop our references as soon as the library has built its authenticated session.
    del cookie
    return client, identity
