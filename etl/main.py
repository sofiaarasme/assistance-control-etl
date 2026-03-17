from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from io import StringIO

import pandas as pd

from etl.config import Settings, load_service_account_info
from etl.drive_client import DriveClient
from etl.transform import build_shift_summary, parse_and_transform


MONTHLY_FILENAME_PATTERN = re.compile(
    r"^asistencia_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.csv$",
    re.IGNORECASE,
)


def _to_csv_bytes(df) -> bytes:
    buffer = StringIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue().encode("utf-8")


def _extract_period_from_filename(filename: str) -> tuple[str, str]:
    match = MONTHLY_FILENAME_PATTERN.match(filename)
    if not match:
        raise ValueError(
            "Nombre inválido. Formato requerido: asistencia_YYYY-MM-DD_YYYY-MM-DD.csv"
        )
    return match.group(1), match.group(2)


def _deduplicate_events(events_df: pd.DataFrame) -> pd.DataFrame:
    dedup_keys = ["persona_id", "fecha_hora", "punto_verificacion"]
    existing_keys = [k for k in dedup_keys if k in events_df.columns]
    if not existing_keys:
        return events_df
    return (
        events_df.sort_values(["persona_id", "fecha_hora"]) 
        .drop_duplicates(subset=existing_keys, keep="first")
        .reset_index(drop=True)
    )


def run() -> None:
    settings = Settings.from_env()
    settings.reports_output_dir.mkdir(parents=True, exist_ok=True)

    service_account_info = load_service_account_info(settings)
    drive = DriveClient(service_account_info)

    files = drive.list_csv_files(settings.gdrive_raw_folder_id)
    if not files:
        print("No hay CSV en carpeta raw para procesar.")
        return

    all_events: list[pd.DataFrame] = []
    source_files_ok: list[dict] = []
    source_files_skipped: list[dict] = []

    for item in files:
        file_id = item["id"]
        filename = item["name"]
        print(f"Leyendo: {filename} ({file_id})")

        try:
            periodo_inicio, periodo_fin = _extract_period_from_filename(filename)
        except ValueError as exc:
            source_files_skipped.append(
                {
                    "source_file_id": file_id,
                    "source_file_name": filename,
                    "reason": str(exc),
                }
            )
            print(f"Omitido {filename}: {exc}")
            continue

        file_bytes = drive.download_file_bytes(file_id)
        events_df, _ = parse_and_transform(file_bytes)

        events_df["source_file_id"] = file_id
        events_df["source_file_name"] = filename
        events_df["periodo_inicio"] = periodo_inicio
        events_df["periodo_fin"] = periodo_fin

        all_events.append(events_df)
        source_files_ok.append(
            {
                "source_file_id": file_id,
                "source_file_name": filename,
                "periodo_inicio": periodo_inicio,
                "periodo_fin": periodo_fin,
                "records_in": int(len(events_df)),
            }
        )

    if not all_events:
        print("No hubo archivos válidos para procesar.")
        return

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    events_historico_df = pd.concat(all_events, ignore_index=True)
    events_historico_df = _deduplicate_events(events_historico_df)
    events_historico_df = events_historico_df.sort_values(["fecha_hora", "persona_id"]).reset_index(drop=True)

    summary_historico_df = build_shift_summary(events_historico_df)

    events_name = "asistencia_eventos_historico.csv"
    summary_name = "asistencia_resumen_diario_historico.csv"
    meta_name = "asistencia_metadata_historico.json"

    events_bytes = _to_csv_bytes(events_historico_df)
    summary_bytes = _to_csv_bytes(summary_historico_df)
    metadata = {
        "processed_at_utc": ts,
        "required_filename_format": "asistencia_YYYY-MM-DD_YYYY-MM-DD.csv",
        "source_files_processed": source_files_ok,
        "source_files_skipped": source_files_skipped,
        "source_files_count": len(source_files_ok),
        "records_eventos_historico": int(len(events_historico_df)),
        "records_resumen_historico": int(len(summary_historico_df)),
        "fecha_min": str(events_historico_df["fecha_hora"].min()),
        "fecha_max": str(events_historico_df["fecha_hora"].max()),
    }
    metadata_bytes = json.dumps(metadata, ensure_ascii=False, indent=2).encode("utf-8")

    if settings.output_mode in {"local", "both"}:
        (settings.reports_output_dir / events_name).write_bytes(events_bytes)
        (settings.reports_output_dir / summary_name).write_bytes(summary_bytes)
        (settings.reports_output_dir / meta_name).write_bytes(metadata_bytes)
        print(f"Archivos históricos guardados localmente en {settings.reports_output_dir}")

    if settings.output_mode in {"drive", "both"}:
        if not settings.gdrive_processed_folder_id:
            raise ValueError(
                "OUTPUT_MODE incluye drive pero falta GDRIVE_PROCESSED_FOLDER_ID"
            )
        drive.upsert_bytes(
            settings.gdrive_processed_folder_id,
            events_name,
            events_bytes,
            "text/csv",
        )
        drive.upsert_bytes(
            settings.gdrive_processed_folder_id,
            summary_name,
            summary_bytes,
            "text/csv",
        )
        drive.upsert_bytes(
            settings.gdrive_processed_folder_id,
            meta_name,
            metadata_bytes,
            "application/json",
        )
        print("Archivos históricos actualizados en Google Drive (carpeta processed)")

    print("ETL finalizado correctamente.")


if __name__ == "__main__":
    run()
