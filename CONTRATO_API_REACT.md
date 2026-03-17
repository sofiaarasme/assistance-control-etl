# Contrato API para Frontend React

Versión: 2026-03-08

## Fuente de datos

El ETL actualiza en Google Drive (carpeta `processed`):

- `asistencia_eventos_historico.csv`
- `asistencia_resumen_diario_historico.csv`
- `asistencia_metadata_historico.json`

El frontend React NO consume Google Drive directo.
Consume un backend API de la empresa.

Reglas de negocio ya calculadas por ETL:

- Estructura jerárquica `Departamento` en crudo, ejemplo: `PERSONAL YOLO/04 Produccion/Grupo 1`.
- Regla de extracción:
  - Ignorar el primer nivel (`PERSONAL YOLO`).
  - `departamento` = `Produccion` (sin prefijo numérico `04`).
  - `grupo` = `Grupo 1`.

- Turno `diurno`: ventana 07:00 a 19:00.
- Turno `nocturno`: ventana 19:00 a 07:00 del día siguiente.
- 4 marcas obligatorias por jornada:
  1. `entrada`
  2. `salida_almuerzo`
  3. `regreso_almuerzo`
  4. `salida`
- Semáforo de entrada:
  - `verde`: llegó antes o exacto a hora programada
  - `amarillo`: llegó entre +1 y +59 segundos
  - `rojo`: llegó desde +60 segundos en adelante
- Semáforo de almuerzo (duración entre marca 2 y 3):
  - `verde`: <= 59m 59s
  - `amarillo`: 60m 00s a 60m 59s
  - `rojo`: >= 61m 00s

## Base URL

- `https://api.tuempresa.com`

## Endpoints requeridos

### 1) Resumen diario (pantalla principal)

`GET /api/v1/asistencia/resumen`

Query params:

- `from` (obligatorio): `YYYY-MM-DD`
- `to` (obligatorio): `YYYY-MM-DD`
- `departamento` (obligatorio en operación): `Produccion`
- `grupo` (opcional): `Grupo 1`, `Grupo 3`, etc.
- `turno` (opcional): `diurno|nocturno`
- `personaId` (opcional)
- `search` (opcional): nombre parcial
- `semaforoEntrada` (opcional): `verde|amarillo|rojo`
- `semaforoAlmuerzo` (opcional): `verde|amarillo|rojo|sin_datos`
- `soloAlertas` (opcional): `true|false`
- `soloAsistenciaPerfecta` (opcional): `true|false`
- `page` (opcional, default 1)
- `pageSize` (opcional, default 50, max 500)
- `sortBy` (opcional): `fecha|departamento|nombre|turno|horas_en_planta|total_registros|semaforo_entrada|semaforo_almuerzo|marcas_faltantes`
- `sortDir` (opcional): `asc|desc`

Respuesta 200:

```json
{
  "items": [
    {
      "persona_id": "14678330",
      "nombre": "Gregorio Lobo",
      "fecha": "2026-03-07",
      "departamento": "Produccion",
      "grupo": "Grupo 1",
      "turno": "diurno",
      "jornada_inicio_programada": "2026-03-07T07:00:00",
      "jornada_fin_programada": "2026-03-07T19:00:00",
      "primer_registro": "2026-03-07T07:01:25",
      "ultimo_registro": "2026-03-07T18:57:05",
      "total_registros": 2,
      "marcas_esperadas": 4,
      "marcas_faltantes": 2,
      "alerta_marcas": "rojo",
      "entrada_tarde_segundos": 85,
      "semaforo_entrada": "rojo",
      "salida_anticipada_segundos": 120,
      "semaforo_salida": "rojo",
      "salida_almuerzo": null,
      "regreso_almuerzo": null,
      "duracion_almuerzo_segundos": null,
      "duracion_almuerzo_minutos": null,
      "semaforo_almuerzo": "sin_datos",
      "alerta_general": true,
      "horas_en_planta": 11.93,
      "source_file_name": "asistencia_2026-03-01_2026-03-31.csv",
      "periodo_inicio": "2026-03-01",
      "periodo_fin": "2026-03-31"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

### 2) Eventos detallados (drill-down)

`GET /api/v1/asistencia/eventos`

Query params:

- `from` (obligatorio)
- `to` (obligatorio)
- `departamento` (obligatorio en operación): `Produccion`
- `personaId` (opcional)
- `grupo` (opcional)
- `turno` (opcional): `diurno|nocturno`
- `tipoEvento` (opcional): `entrada|salida_almuerzo|regreso_almuerzo|salida|movimiento|adicional`
- `page` (opcional)
- `pageSize` (opcional)

### 3) Metadata de actualización

`GET /api/v1/asistencia/metadata`

Respuesta:

```json
{
  "processed_at_utc": "20260308T210000Z",
  "source_files_count": 12,
  "records_eventos_historico": 8302,
  "records_resumen_historico": 1875,
  "fecha_min": "2026-01-01 06:30:00",
  "fecha_max": "2026-03-31 20:05:00",
  "required_filename_format": "asistencia_YYYY-MM-DD_YYYY-MM-DD.csv"
}
```

### 4) Catálogos para filtros UI

`GET /api/v1/asistencia/catalogos`

Respuesta:

```json
{
  "departamentos": ["Produccion"],
  "grupos": ["Grupo 1", "Grupo 3", "Grupo 4"],
  "turnos": ["diurno", "nocturno"],
  "personas": [
    { "persona_id": "14678330", "nombre": "Gregorio Lobo" }
  ]
}
```

## Reglas de negocio para frontend

1. Filtro por fechas siempre usando `from` y `to`.
2. Filtro por `departamento` es obligatorio en vistas operativas por área.
3. Mostrar timestamp de última actualización desde `/metadata`.
4. Usar `soloAlertas=true` para tablero operativo de incidencias.
5. Mostrar chips/colores por `semaforo_entrada`, `semaforo_almuerzo` y `alerta_marcas`.
6. Si no hay datos, mostrar estado vacío con filtros seleccionados.
7. No depender de nombres de archivos, solo del API.

## Regla para archivo mensual cargado por operaciones

Formato obligatorio en carpeta `raw`:

- `asistencia_YYYY-MM-DD_YYYY-MM-DD.csv`

Ejemplo:

- `asistencia_2026-05-01_2026-05-31.csv`
