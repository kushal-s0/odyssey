from __future__ import annotations

from urllib.parse import quote, urlsplit

import httpx

from ..config import Settings


class StorageUnavailable(RuntimeError):
    pass


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
