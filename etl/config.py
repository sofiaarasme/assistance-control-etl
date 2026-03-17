from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    gdrive_raw_folder_id: str
    gdrive_processed_folder_id: str | None
    gdrive_service_account_json_b64: str | None
    gdrive_service_account_file: str | None
    tz: str
    reports_output_dir: Path
    state_file: Path
    output_mode: str


    @staticmethod
    def from_env() -> "Settings":
        raw_folder = os.getenv("GDRIVE_RAW_FOLDER_ID", "").strip()
        if not raw_folder:
            raise ValueError("GDRIVE_RAW_FOLDER_ID es obligatorio.")

        output_mode = os.getenv("OUTPUT_MODE", "both").strip().lower()
        if output_mode not in {"both", "local", "drive"}:
            raise ValueError("OUTPUT_MODE debe ser: both, local o drive")

        reports_output_dir = Path(os.getenv("REPORTS_OUTPUT_DIR", "data/processed")).resolve()
        state_file = Path(os.getenv("STATE_FILE", "state/processed_files.json")).resolve()

        return Settings(
            gdrive_raw_folder_id=raw_folder,
            gdrive_processed_folder_id=os.getenv("GDRIVE_PROCESSED_FOLDER_ID", "").strip() or None,
            gdrive_service_account_json_b64=os.getenv("GDRIVE_SERVICE_ACCOUNT_JSON_B64", "").strip() or None,
            gdrive_service_account_file=os.getenv("GDRIVE_SERVICE_ACCOUNT_FILE", "").strip() or None,
            tz=os.getenv("TZ", "America/Caracas").strip(),
            reports_output_dir=reports_output_dir,
            state_file=state_file,
            output_mode=output_mode,
        )


def load_service_account_info(settings: Settings) -> dict:
    if settings.gdrive_service_account_json_b64:
        import base64

        raw = base64.b64decode(settings.gdrive_service_account_json_b64).decode("utf-8")
        return json.loads(raw)

    if settings.gdrive_service_account_file:
        with open(settings.gdrive_service_account_file, "r", encoding="utf-8") as f:
            return json.load(f)

    raise ValueError(
        "Debes definir GDRIVE_SERVICE_ACCOUNT_JSON_B64 o GDRIVE_SERVICE_ACCOUNT_FILE para autenticar Google Drive."
    )
