from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query

from backend.api.dependencies import get_asistencia_service
from backend.application.asistencia_service import AsistenciaService


router = APIRouter(prefix="/api/v1/asistencia", tags=["asistencia"])


@router.get("/resumen")
def get_resumen(
    from_date: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_date: str = Query(..., alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    departamento: str | None = Query(default=None),
    grupo: str | None = Query(default=None),
    turno: Literal["diurno", "nocturno"] | None = Query(default=None),
    persona_id: str | None = Query(default=None, alias="personaId"),
    search: str | None = Query(default=None),
    semaforo_entrada: Literal["verde", "amarillo", "rojo"] | None = Query(
        default=None, alias="semaforoEntrada"
    ),
    semaforo_almuerzo: Literal["verde", "amarillo", "rojo", "sin_datos"] | None = Query(
        default=None, alias="semaforoAlmuerzo"
    ),
    solo_alertas: bool = Query(default=False, alias="soloAlertas"),
    solo_asistencia_perfecta: bool = Query(default=False, alias="soloAsistenciaPerfecta"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500, alias="pageSize"),
    sort_by: Literal[
        "fecha",
        "departamento",
        "nombre",
        "horas_en_planta",
        "total_registros",
        "turno",
        "semaforo_entrada",
        "semaforo_almuerzo",
        "semaforo_salida",
        "marcas_faltantes",
    ] = Query(default="fecha", alias="sortBy"),
    sort_dir: Literal["asc", "desc"] = Query(default="asc", alias="sortDir"),
    service: AsistenciaService = Depends(get_asistencia_service),
) -> dict:
    return service.get_resumen(
        from_date=from_date,
        to_date=to_date,
        departamento=departamento,
        grupo=grupo,
        turno=turno,
        persona_id=persona_id,
        search=search,
        semaforo_entrada=semaforo_entrada,
        semaforo_almuerzo=semaforo_almuerzo,
        solo_alertas=solo_alertas,
        solo_asistencia_perfecta=solo_asistencia_perfecta,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


@router.get("/eventos")
def get_eventos(
    from_date: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_date: str = Query(..., alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    departamento: str | None = Query(default=None),
    grupo: str | None = Query(default=None),
    turno: Literal["diurno", "nocturno"] | None = Query(default=None),
    persona_id: str | None = Query(default=None, alias="personaId"),
    tipo_evento: Literal[
        "entrada",
        "salida_almuerzo",
        "regreso_almuerzo",
        "salida",
        "movimiento",
        "adicional",
    ]
    | None = Query(default=None, alias="tipoEvento"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=200, ge=1, le=1000, alias="pageSize"),
    service: AsistenciaService = Depends(get_asistencia_service),
) -> dict:
    return service.get_eventos(
        from_date=from_date,
        to_date=to_date,
        departamento=departamento,
        grupo=grupo,
        turno=turno,
        persona_id=persona_id,
        tipo_evento=tipo_evento,
        page=page,
        page_size=page_size,
    )


@router.get("/metadata")
def get_metadata(service: AsistenciaService = Depends(get_asistencia_service)) -> dict:
    return service.get_metadata()


@router.get("/catalogos")
def get_catalogos(service: AsistenciaService = Depends(get_asistencia_service)) -> dict:
    return service.get_catalogos()
