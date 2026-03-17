from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


def _read_csv_or_empty(file_path: Path, parse_dates: list[str] | None = None) -> pd.DataFrame:
    if not file_path.exists():
        return pd.DataFrame()
    return pd.read_csv(file_path, parse_dates=parse_dates)


def load_resumen(file_path: Path) -> pd.DataFrame:
    df = _read_csv_or_empty(file_path, parse_dates=["primer_registro", "ultimo_registro"])
    if df.empty:
        return df

    if "fecha" in df.columns:
        df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce").dt.date.astype(str)
    return df


def load_eventos(file_path: Path) -> pd.DataFrame:
    df = _read_csv_or_empty(file_path, parse_dates=["fecha_hora"])
    if df.empty:
        return df

    if "fecha" in df.columns:
        df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce").dt.date.astype(str)
    return df


def load_metadata(file_path: Path) -> dict[str, Any]:
    if not file_path.exists():
        return {
            "processed_at_utc": None,
            "source_files_count": 0,
            "records_eventos_historico": 0,
            "records_resumen_historico": 0,
            "fecha_min": None,
            "fecha_max": None,
            "required_filename_format": "asistencia_YYYY-MM-DD_YYYY-MM-DD.csv",
        }

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def apply_date_filter(df: pd.DataFrame, from_date: str, to_date: str) -> pd.DataFrame:
    if df.empty or "fecha" not in df.columns:
        return df

    filtered = df[(df["fecha"] >= from_date) & (df["fecha"] <= to_date)]
    return filtered.copy()


def paginate(df: pd.DataFrame, page: int, page_size: int) -> tuple[pd.DataFrame, int, int]:
    total = int(len(df))
    total_pages = max((total + page_size - 1) // page_size, 1)
    start = (page - 1) * page_size
    end = start + page_size
    return df.iloc[start:end].copy(), total, total_pages
