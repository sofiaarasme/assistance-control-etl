from __future__ import annotations

from datetime import datetime, timedelta
from io import BytesIO
import re

import pandas as pd

REQUIRED_COLUMNS = [
    "ID de persona",
    "Nombre",
    "Departamento",
    "Hora",
    "Estado de asistencia",
    "Punto de verificaci\u00f3n de asistencia",
    "Nombre personalizado",
    "Fuente de datos",
    "Gesti\u00f3n de informe",
    "Temperatura",
    "Anormal",
]


def _read_csv_safely(file_bytes: bytes) -> pd.DataFrame:
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            df = pd.read_csv(BytesIO(file_bytes), encoding=encoding)
            return df
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("csv", b"", 0, 1, "No se pudo decodificar el CSV")


def _extract_departamento_y_grupo(departamento_raw: str) -> tuple[str, str]:
    if not isinstance(departamento_raw, str):
        return "", ""

    parts = [p.strip() for p in departamento_raw.split("/") if p.strip()]
    if not parts:
        return "", ""

    # Ejemplo: PERSONAL YOLO/04 Produccion/Grupo 1
    # Ignorar el primer nivel organizacional y usar:
    # departamento = Produccion, grupo = Grupo 1
    grupo = parts[-1]
    departamento_part = parts[-2] if len(parts) >= 2 else parts[-1]
    departamento_clean = re.sub(r"^\d+\s*", "", departamento_part).strip()
    return departamento_clean, grupo


def _extract_grupo(departamento: str) -> str:
    if not isinstance(departamento, str):
        return ""
    _, grupo = _extract_departamento_y_grupo(departamento)
    return grupo


def _classify_shift(ts: pd.Timestamp) -> tuple[str, datetime]:
    base = ts.to_pydatetime()
    if base.hour >= 19:
        start = base.replace(hour=19, minute=0, second=0, microsecond=0)
        return "nocturno", start

    if base.hour < 7:
        prev = base - timedelta(days=1)
        start = prev.replace(hour=19, minute=0, second=0, microsecond=0)
        return "nocturno", start

    start = base.replace(hour=7, minute=0, second=0, microsecond=0)
    return "diurno", start


def _entry_semaforo(delay_seconds: float) -> str:
    if delay_seconds <= 0:
        return "verde"
    if delay_seconds <= 59:
        return "amarillo"
    return "rojo"


def _lunch_semaforo(lunch_seconds: float) -> str:
    if lunch_seconds <= 3599:
        return "verde"
    if lunch_seconds <= 3659:
        return "amarillo"
    return "rojo"


def _exit_semaforo(early_seconds: float) -> str:
    if early_seconds <= 0:
        return "verde"
    if early_seconds <= 59:
        return "amarillo"
    return "rojo"


def normalize_events(raw_df: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in REQUIRED_COLUMNS if c not in raw_df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias: {missing}")

    df = raw_df.copy()

    df = df.rename(
        columns={
            "ID de persona": "persona_id",
            "Nombre": "nombre",
            "Departamento": "departamento",
            "Hora": "fecha_hora",
            "Estado de asistencia": "estado_asistencia",
            "Punto de verificaci\u00f3n de asistencia": "punto_verificacion",
            "Nombre personalizado": "nombre_personalizado",
            "Fuente de datos": "fuente_datos",
            "Gesti\u00f3n de informe": "gestion_informe",
            "Temperatura": "temperatura",
            "Anormal": "anormal",
        }
    )

    df["persona_id"] = (
        df["persona_id"].astype(str).str.replace("'", "", regex=False).str.replace(r"\\D", "", regex=True)
    )
    df["fecha_hora"] = pd.to_datetime(df["fecha_hora"], errors="coerce")

    df = df.dropna(subset=["persona_id", "fecha_hora"])

    df["fecha"] = df["fecha_hora"].dt.date.astype(str)
    df["hora"] = df["fecha_hora"].dt.time.astype(str)
    df["departamento_raw"] = df["departamento"].astype(str)
    dep_grupo = df["departamento_raw"].map(_extract_departamento_y_grupo)
    df["departamento"] = dep_grupo.map(lambda x: x[0])
    df["grupo"] = dep_grupo.map(lambda x: x[1])
    df["dia_semana"] = df["fecha_hora"].dt.day_name()
    df["semana_iso"] = df["fecha_hora"].dt.isocalendar().week.astype(int)

    shift_data = df["fecha_hora"].map(_classify_shift)
    df["turno"] = shift_data.map(lambda x: x[0])
    df["jornada_inicio_programada"] = pd.to_datetime(shift_data.map(lambda x: x[1]))
    df["jornada_fin_programada"] = df["jornada_inicio_programada"] + pd.Timedelta(hours=12)
    df["jornada_fecha"] = df["jornada_inicio_programada"].dt.date.astype(str)

    df = df.sort_values(["persona_id", "fecha_hora"]).reset_index(drop=True)

    group_keys = ["persona_id", "jornada_fecha", "turno"]
    df["orden_jornada"] = df.groupby(group_keys).cumcount() + 1
    df["total_registros_jornada"] = df.groupby(group_keys)["persona_id"].transform("count")

    df["tipo_evento"] = "movimiento"
    df.loc[df["orden_jornada"] == 1, "tipo_evento"] = "entrada"
    df.loc[df["orden_jornada"] == 2, "tipo_evento"] = "salida_almuerzo"
    df.loc[df["orden_jornada"] == 3, "tipo_evento"] = "regreso_almuerzo"
    df.loc[df["orden_jornada"] == 4, "tipo_evento"] = "salida"
    df.loc[df["orden_jornada"] > 4, "tipo_evento"] = "adicional"

    return df


def build_shift_summary(events_df: pd.DataFrame) -> pd.DataFrame:
    if events_df.empty:
        return pd.DataFrame()

    group_keys = ["persona_id", "nombre", "departamento", "grupo", "turno", "jornada_fecha"]
    rows: list[dict] = []

    for keys, g in events_df.groupby(group_keys, dropna=False):
        persona_id, nombre, departamento, grupo, turno, jornada_fecha = keys
        g = g.sort_values("fecha_hora").reset_index(drop=True)

        marks = g["fecha_hora"].tolist()
        primer = marks[0]
        ultimo = marks[-1]
        total = len(marks)

        jornada_inicio = g["jornada_inicio_programada"].iloc[0]
        jornada_fin = g["jornada_fin_programada"].iloc[0]

        entry_delay_seconds = float((primer - jornada_inicio).total_seconds())
        semaforo_entrada = _entry_semaforo(entry_delay_seconds)

        lunch_out = None
        lunch_in = None
        lunch_seconds = None
        semaforo_almuerzo = "sin_datos"

        if total >= 3:
            lunch_out = marks[1]
            lunch_in = marks[2]
            lunch_seconds = float((lunch_in - lunch_out).total_seconds())
            if lunch_seconds < 0:
                lunch_seconds = None
                semaforo_almuerzo = "sin_datos"
            else:
                semaforo_almuerzo = _lunch_semaforo(lunch_seconds)

        marcas_esperadas = 4
        marcas_faltantes = max(0, marcas_esperadas - total)
        tiene_alerta_marcas = marcas_faltantes > 0
        tiene_alerta_almuerzo = semaforo_almuerzo in {"amarillo", "rojo", "sin_datos"}

        salida_anticipada_segundos = float((jornada_fin - ultimo).total_seconds())
        if salida_anticipada_segundos < 0:
            salida_anticipada_segundos = 0.0
        semaforo_salida = _exit_semaforo(salida_anticipada_segundos)

        horas_en_planta = round(float((ultimo - primer).total_seconds() / 3600), 2)

        rows.append(
            {
                "persona_id": str(persona_id),
                "nombre": nombre,
                "departamento": departamento,
                "fecha": str(jornada_fecha),
                "grupo": grupo,
                "turno": turno,
                "jornada_inicio_programada": jornada_inicio,
                "jornada_fin_programada": jornada_fin,
                "primer_registro": primer,
                "ultimo_registro": ultimo,
                "total_registros": int(total),
                "marcas_esperadas": marcas_esperadas,
                "marcas_faltantes": int(marcas_faltantes),
                "alerta_marcas": "rojo" if tiene_alerta_marcas else "verde",
                "entrada_tarde_segundos": int(max(0, round(entry_delay_seconds))),
                "semaforo_entrada": semaforo_entrada,
                "salida_anticipada_segundos": int(round(salida_anticipada_segundos)),
                "semaforo_salida": semaforo_salida,
                "salida_almuerzo": lunch_out,
                "regreso_almuerzo": lunch_in,
                "duracion_almuerzo_segundos": int(lunch_seconds) if lunch_seconds is not None else None,
                "duracion_almuerzo_minutos": round(lunch_seconds / 60, 2)
                if lunch_seconds is not None
                else None,
                "semaforo_almuerzo": semaforo_almuerzo,
                "alerta_general": bool(
                    tiene_alerta_marcas
                    or semaforo_entrada in {"amarillo", "rojo"}
                    or semaforo_salida in {"amarillo", "rojo"}
                    or tiene_alerta_almuerzo
                ),
                "horas_en_planta": horas_en_planta,
                "source_file_name": g["source_file_name"].iloc[0] if "source_file_name" in g.columns else None,
                "periodo_inicio": g["periodo_inicio"].iloc[0] if "periodo_inicio" in g.columns else None,
                "periodo_fin": g["periodo_fin"].iloc[0] if "periodo_fin" in g.columns else None,
            }
        )

    out = pd.DataFrame(rows)
    out = out.sort_values(["fecha", "turno", "persona_id"]).reset_index(drop=True)
    return out


def parse_and_transform(file_bytes: bytes) -> tuple[pd.DataFrame, pd.DataFrame]:
    raw_df = _read_csv_safely(file_bytes)
    events_df = normalize_events(raw_df)
    summary_df = build_shift_summary(events_df)
    return events_df, summary_df
