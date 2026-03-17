from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ApiSettings:
    data_dir: Path
    resumen_filename: str
    eventos_filename: str
    metadata_filename: str
    cors_origins: list[str]
    supabase_url: str | None
    supabase_anon_key: str | None
    supabase_service_role_key: str | None

    @staticmethod
    def from_env() -> "ApiSettings":
        data_dir = Path(os.getenv("REPORTS_OUTPUT_DIR", "data/processed")).resolve()
        cors_raw = os.getenv("API_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
        cors_origins = [o.strip() for o in cors_raw.split(",") if o.strip()]

        return ApiSettings(
            data_dir=data_dir,
            resumen_filename=os.getenv(
                "RESUMEN_HISTORICO_FILENAME", "asistencia_resumen_diario_historico.csv"
            ),
            eventos_filename=os.getenv(
                "EVENTOS_HISTORICO_FILENAME", "asistencia_eventos_historico.csv"
            ),
            metadata_filename=os.getenv(
                "METADATA_HISTORICO_FILENAME", "asistencia_metadata_historico.json"
            ),
            cors_origins=cors_origins,
            supabase_url=os.getenv("SUPABASE_URL", "").strip() or None,
            supabase_anon_key=os.getenv("SUPABASE_ANON_KEY", "").strip() or None,
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None,
        )
