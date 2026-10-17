from __future__ import annotations

from urllib.parse import quote, urlsplit
from pathlib import Path
from typing import Protocol
import hashlib

import httpx

from ..config import Settings


class StorageUnavailable(RuntimeError):
    pass


class Storage(Protocol):
    def upload_file(self, object_path: str, source: Path, media_type: str) -> None: ...
    def download(self, object_path: str, max_bytes: int = 25 * 1024 * 1024) -> bytes: ...
    def delete(self, object_paths: list[str]) -> None: ...


class LocalPrivateStorage:
    """Explicit development/test adapter; forbidden by production Settings."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, object_path: str) -> Path:
        path = (self.root / object_path).resolve()
        if not path.is_relative_to(self.root) or path == self.root:
            raise ValueError('Invalid private object path')
        return path

    def upload_file(self, object_path: str, source: Path, media_type: str) -> None:
        target = self.path(object_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with target.open('xb') as output, source.open('rb') as input_file:
                for chunk in iter(lambda: input_file.read(65536), b''):
                    output.write(chunk)
        except FileExistsError:
            if hashlib.sha256(target.read_bytes()).digest() != hashlib.sha256(source.read_bytes()).digest():
                raise StorageUnavailable('Existing private object differs') from None
        except OSError:
            target.unlink(missing_ok=True)
            raise StorageUnavailable('Private upload could not be stored') from None

    def download(self, object_path: str, max_bytes: int = 25 * 1024 * 1024) -> bytes:
        try:
            with self.path(object_path).open('rb') as source:
                content = source.read(max_bytes + 1)
            if len(content) > max_bytes:
                raise StorageUnavailable('Private source exceeds the processing limit')
            return content
        except OSError:
            raise StorageUnavailable('Private source is unavailable') from None

    def delete(self, object_paths: list[str]) -> None:
        for object_path in object_paths:
            self.path(object_path).unlink(missing_ok=True)


def configured_storage(settings: Settings) -> Storage:
    if settings.storage_backend == 'local' and settings.app_env != 'production':
        return LocalPrivateStorage(settings.local_storage_dir)
    return PrivateStorage(settings)


class PrivateStorage:
    def __init__(self, settings: Settings) -> None:
        if (not settings.supabase_url or not settings.supabase_service_role_key
                or not settings.supabase_service_role_key.get_secret_value()):
            raise StorageUnavailable("Configure private Supabase storage before uploading")
        self.origin = settings.supabase_url.rstrip("/")
        if not self.origin.startswith("https://") and settings.app_env == "production":
            raise StorageUnavailable("Private storage must use HTTPS")
        self.bucket = settings.private_upload_bucket
        self.headers = {"Authorization": "Bearer " + settings.supabase_service_role_key.get_secret_value(),
                        "apikey": settings.supabase_service_role_key.get_secret_value()}

    def path(self, object_path: str) -> str:
        if object_path.startswith("/") or any(part in {"", ".", ".."} for part in object_path.split("/")):
            raise ValueError("Invalid private object path")
        return quote(self.bucket, safe="") + "/" + quote(object_path, safe="/")

    def sign_read(self, object_path: str, expires_in: int = 120) -> str:
        with httpx.Client(timeout=15, follow_redirects=False) as client:
            response = client.post(f"{self.origin}/storage/v1/object/sign/{self.path(object_path)}",
                                   headers=self.headers, json={"expiresIn": min(300, max(30, expires_in))})
        if response.status_code != 200:
            raise StorageUnavailable("Private file access is temporarily unavailable")
        signed = response.json().get("signedURL") or response.json().get("signedUrl")
        if not isinstance(signed, str) or not signed.startswith("/object/sign/"):
            raise StorageUnavailable("Storage returned an invalid access URL")
        return self.origin + "/storage/v1" + signed

    def upload(self, object_path: str, content: bytes, media_type: str) -> None:
        with httpx.Client(timeout=60, follow_redirects=False) as client:
            response = client.post(f"{self.origin}/storage/v1/object/{self.path(object_path)}",
                headers={**self.headers, "Content-Type": media_type, "x-upsert": "false"}, content=content)
        if response.status_code not in {200, 201}:
            raise StorageUnavailable("Private upload could not be stored")

    def upload_file(self, object_path: str, source: Path, media_type: str) -> None:
        with source.open('rb') as content, httpx.Client(timeout=60, follow_redirects=False) as client:
            response = client.post(f'{self.origin}/storage/v1/object/{self.path(object_path)}',
                headers={**self.headers, 'Content-Type': media_type, 'x-upsert': 'false',
                         'Content-Length': str(source.stat().st_size)}, content=content)
        if response.status_code in {400, 409}:
            existing = self.download(object_path, source.stat().st_size)
            if hashlib.sha256(existing).digest() == hashlib.sha256(source.read_bytes()).digest():
                return
        if response.status_code not in {200, 201}:
            raise StorageUnavailable('Private upload could not be stored')

    def download(self, object_path: str, max_bytes: int = 25 * 1024 * 1024) -> bytes:
        with httpx.Client(timeout=60, follow_redirects=False) as client:
            with client.stream("GET", f"{self.origin}/storage/v1/object/authenticated/{self.path(object_path)}",
                               headers=self.headers) as response:
                if response.status_code != 200:
                    raise StorageUnavailable("Private source is unavailable")
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        raise StorageUnavailable("Private source exceeds the processing limit")
                    chunks.append(chunk)
        return b"".join(chunks)

    def delete(self, object_paths: list[str]) -> None:
        for path in object_paths:
            self.path(path)
        with httpx.Client(timeout=30, follow_redirects=False) as client:
            response = client.request("DELETE", f"{self.origin}/storage/v1/object/{quote(self.bucket, safe='')}",
                                      headers=self.headers, json={"prefixes": object_paths})
        if response.status_code != 200:
            raise StorageUnavailable("Private file cleanup could not complete")

    def is_own_signed_url(self, url: str) -> bool:
        target, origin = urlsplit(url), urlsplit(self.origin)
        return target.scheme == origin.scheme and target.netloc == origin.netloc and target.path.startswith("/storage/v1/object/sign/")
