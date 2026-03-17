from __future__ import annotations

from io import BytesIO

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload


SCOPES = ["https://www.googleapis.com/auth/drive"]


class DriveClient:
    def __init__(self, service_account_info: dict):
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=SCOPES,
        )
        self.service = build("drive", "v3", credentials=credentials, cache_discovery=False)

    def list_csv_files(self, folder_id: str) -> list[dict]:
        q = (
            f"'{folder_id}' in parents and trashed = false "
            "and mimeType != 'application/vnd.google-apps.folder'"
        )
        response = (
            self.service.files()
            .list(
                q=q,
                fields="files(id,name,mimeType,modifiedTime)",
                orderBy="modifiedTime asc",
                pageSize=200,
            )
            .execute()
        )
        files = response.get("files", [])
        return [f for f in files if f["name"].lower().endswith(".csv")]

    def download_file_bytes(self, file_id: str) -> bytes:
        request = self.service.files().get_media(fileId=file_id)
        fh = BytesIO()
        downloader = MediaIoBaseDownload(fh, request)

        done = False
        while not done:
            _, done = downloader.next_chunk()

        fh.seek(0)
        return fh.read()

    def upload_bytes(self, folder_id: str, filename: str, content: bytes, mime_type: str) -> str:
        media = MediaIoBaseUpload(BytesIO(content), mimetype=mime_type, resumable=False)
        metadata = {"name": filename, "parents": [folder_id]}
        created = (
            self.service.files()
            .create(body=metadata, media_body=media, fields="id,name")
            .execute()
        )
        return created["id"]

    def find_file_by_name(self, folder_id: str, filename: str) -> dict | None:
        safe_filename = filename.replace("'", "\\'")
        q = (
            f"'{folder_id}' in parents and trashed = false "
            f"and name = '{safe_filename}'"
        )
        response = (
            self.service.files()
            .list(q=q, fields="files(id,name,modifiedTime)", orderBy="modifiedTime desc", pageSize=10)
            .execute()
        )
        files = response.get("files", [])
        return files[0] if files else None

    def upsert_bytes(self, folder_id: str, filename: str, content: bytes, mime_type: str) -> str:
        existing = self.find_file_by_name(folder_id, filename)
        media = MediaIoBaseUpload(BytesIO(content), mimetype=mime_type, resumable=False)

        if existing:
            updated = (
                self.service.files()
                .update(fileId=existing["id"], media_body=media, fields="id,name")
                .execute()
            )
            return updated["id"]

        metadata = {"name": filename, "parents": [folder_id]}
        created = (
            self.service.files()
            .create(body=metadata, media_body=media, fields="id,name")
            .execute()
        )
        return created["id"]
