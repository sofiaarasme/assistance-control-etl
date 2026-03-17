from __future__ import annotations

from pathlib import Path

import pandas as pd

from backend.repository import load_eventos, load_metadata, load_resumen


class CsvAsistenciaRepository:
    def load_resumen(self, file_path: Path) -> pd.DataFrame:
        return load_resumen(file_path)

    def load_eventos(self, file_path: Path) -> pd.DataFrame:
        return load_eventos(file_path)

    def load_metadata(self, file_path: Path) -> dict:
        return load_metadata(file_path)
