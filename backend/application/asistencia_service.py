from __future__ import annotations

from typing import Literal

import pandas as pd

from backend.config import ApiSettings
from backend.domain.ports import AsistenciaRepository
from backend.repository import apply_date_filter, paginate


class AsistenciaService:
    def __init__(self, settings: ApiSettings, repository: AsistenciaRepository):
        self.settings = settings
        self.repository = repository

    def get_resumen(
        self,
        from_date: str,
        to_date: str,
        departamento: str | None,
        grupo: str | None,
        turno: Literal["diurno", "nocturno"] | None,
        persona_id: str | None,
        search: str | None,
        semaforo_entrada: Literal["verde", "amarillo", "rojo"] | None,
        semaforo_almuerzo: Literal["verde", "amarillo", "rojo", "sin_datos"] | None,
        solo_alertas: bool,
        solo_asistencia_perfecta: bool,
        page: int,
        page_size: int,
        sort_by: str,
        sort_dir: Literal["asc", "desc"],
    ) -> dict:
        file_path = self.settings.data_dir / self.settings.resumen_filename
        df = self.repository.load_resumen(file_path)

        if df.empty:
            return {
                "items": [],
                "pagination": {"page": page, "pageSize": page_size, "total": 0, "totalPages": 1},
            }

        df = apply_date_filter(df, from_date, to_date)

        if departamento:
            df = df[df["departamento"].astype(str).str.lower() == departamento.lower()]
        if grupo:
            df = df[df["grupo"].astype(str).str.lower() == grupo.lower()]
        if turno:
            df = df[df["turno"].astype(str).str.lower() == turno.lower()]
        if persona_id:
            df = df[df["persona_id"].astype(str) == str(persona_id)]
        if search:
            df = df[df["nombre"].astype(str).str.contains(search, case=False, na=False)]
        if semaforo_entrada:
            df = df[df["semaforo_entrada"].astype(str).str.lower() == semaforo_entrada.lower()]
        if semaforo_almuerzo:
            df = df[df["semaforo_almuerzo"].astype(str).str.lower() == semaforo_almuerzo.lower()]
        if solo_alertas and "alerta_general" in df.columns:
            df = df[df["alerta_general"] == True]
        if solo_asistencia_perfecta:
            required_columns = {"semaforo_entrada", "semaforo_almuerzo", "semaforo_salida", "marcas_faltantes"}
            if required_columns.issubset(set(df.columns)):
                df = df[
                    (df["semaforo_entrada"] == "verde")
                    & (df["semaforo_almuerzo"] == "verde")
                    & (df["semaforo_salida"] == "verde")
                    & (df["marcas_faltantes"] == 0)
                ]

        ascending = sort_dir == "asc"
        if sort_by not in df.columns:
            sort_by = "fecha"
        df = df.sort_values(by=sort_by, ascending=ascending)

        page_df, total, total_pages = paginate(df, page, page_size)
        records = page_df.where(pd.notnull(page_df), None).to_dict(orient="records")
        return {
            "items": records,
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "totalPages": total_pages,
            },
        }

    def get_eventos(
        self,
        from_date: str,
        to_date: str,
        departamento: str | None,
        grupo: str | None,
        turno: Literal["diurno", "nocturno"] | None,
        persona_id: str | None,
        tipo_evento: str | None,
        page: int,
        page_size: int,
    ) -> dict:
        file_path = self.settings.data_dir / self.settings.eventos_filename
        df = self.repository.load_eventos(file_path)

        if df.empty:
            return {
                "items": [],
                "pagination": {"page": page, "pageSize": page_size, "total": 0, "totalPages": 1},
            }

        df = apply_date_filter(df, from_date, to_date)

        if departamento:
            df = df[df["departamento"].astype(str).str.lower() == departamento.lower()]
        if grupo:
            df = df[df["grupo"].astype(str).str.lower() == grupo.lower()]
        if turno:
            df = df[df["turno"].astype(str).str.lower() == turno.lower()]
        if persona_id:
            df = df[df["persona_id"].astype(str) == str(persona_id)]
        if tipo_evento:
            df = df[df["tipo_evento"].astype(str).str.lower() == tipo_evento.lower()]

        df = df.sort_values(by="fecha_hora", ascending=True)
        page_df, total, total_pages = paginate(df, page, page_size)
        records = page_df.where(pd.notnull(page_df), None).to_dict(orient="records")
        return {
            "items": records,
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "totalPages": total_pages,
            },
        }

    def get_metadata(self) -> dict:
        file_path = self.settings.data_dir / self.settings.metadata_filename
        return self.repository.load_metadata(file_path)

    def get_catalogos(self) -> dict:
        file_path = self.settings.data_dir / self.settings.resumen_filename
        df = self.repository.load_resumen(file_path)

        if df.empty:
            return {"departamentos": [], "grupos": [], "turnos": [], "personas": []}

        departamentos = sorted(
            [d for d in df["departamento"].dropna().astype(str).unique().tolist() if d]
        )
        grupos = sorted([g for g in df["grupo"].dropna().astype(str).unique().tolist() if g])

        personas_df = (
            df[["persona_id", "nombre"]]
            .dropna()
            .astype({"persona_id": "string", "nombre": "string"})
            .drop_duplicates()
            .sort_values(["nombre", "persona_id"])
        )
        personas = personas_df.to_dict(orient="records")
        turnos = sorted([t for t in df["turno"].dropna().astype(str).unique().tolist() if t])

        return {
            "departamentos": departamentos,
            "grupos": grupos,
            "turnos": turnos,
            "personas": personas,
        }
