# Prueba local completa (ETL + API FastAPI)

Este checklist te permite probar todo en local antes de enviar al frontend.

## 1) Requisitos

- Python 3.11+
- Cuenta de servicio de Google (JSON)
- Carpeta de Drive `raw` (entrada)
- Carpeta de Drive `processed` (salida)

## 2) Preparar entorno local

Desde la raíz del proyecto:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 3) Configurar variables

Copia y edita variables:

```bash
cp .env.example .env
```

Variables mínimas para ETL:

- `GDRIVE_RAW_FOLDER_ID`
- `GDRIVE_PROCESSED_FOLDER_ID`
- `GDRIVE_SERVICE_ACCOUNT_FILE` o `GDRIVE_SERVICE_ACCOUNT_JSON_B64`
- `OUTPUT_MODE=both` (recomendado en pruebas)
- `REPORTS_OUTPUT_DIR=data/processed`

Variables para API:

- `API_CORS_ORIGINS=http://localhost:3000`

Variables para autenticación y usuarios (Supabase):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4) Regla de nombre para archivos mensuales en Drive

Cada archivo en `raw` debe tener este nombre:

- `asistencia_YYYY-MM-DD_YYYY-MM-DD.csv`

Ejemplo:

- `asistencia_2026-04-01_2026-04-30.csv`

## 5) Ejecutar ETL local

```bash
set -a
source .env
set +a
python -m etl.main
```

Al terminar, debe generar en `data/processed`:

- `asistencia_eventos_historico.csv`
- `asistencia_resumen_diario_historico.csv`
- `asistencia_metadata_historico.json`

## 6) Levantar backend FastAPI local

Con el mismo entorno y variables cargadas:

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger local:

- http://localhost:8000/docs

## 7) Pruebas rápidas de endpoints

### Health

```bash
curl "http://localhost:8000/health"
```

### Metadata

```bash
curl "http://localhost:8000/api/v1/asistencia/metadata"
```

### Resumen por rango de fechas

```bash
curl "http://localhost:8000/api/v1/asistencia/resumen?from=2026-03-01&to=2026-03-31&departamento=Produccion&page=1&pageSize=20"
```

### Resumen solo alertas y turno nocturno

```bash
curl "http://localhost:8000/api/v1/asistencia/resumen?from=2026-03-01&to=2026-03-31&departamento=Produccion&turno=nocturno&soloAlertas=true&page=1&pageSize=20"
```

### Eventos por persona

```bash
curl "http://localhost:8000/api/v1/asistencia/eventos?from=2026-03-01&to=2026-03-31&departamento=Produccion&personaId=14678330&page=1&pageSize=50"
```

### Catálogos para filtros UI

```bash
curl "http://localhost:8000/api/v1/asistencia/catalogos"
```

### Login (Supabase)

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@serimar.com","password":"tu_clave"}'
```

### Perfil actual (`/me`)

```bash
curl "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 8) Qué enviar al frontend

Comparte:

- `baseURL`: `http://localhost:8000` (local)
- Contrato API: [CONTRATO_API_REACT.md](CONTRATO_API_REACT.md)
- Endpoints:
  - `GET /api/v1/asistencia/resumen`
  - `GET /api/v1/asistencia/eventos`
  - `GET /api/v1/asistencia/metadata`
  - `GET /api/v1/asistencia/catalogos`

## 9) Criterios de aceptación local

- ETL termina sin errores.
- Los 3 archivos históricos existen en `data/processed`.
- `GET /metadata` devuelve `processed_at_utc` no nulo.
- `GET /resumen` devuelve registros para un rango válido.
- `GET /resumen` devuelve campos de control: `turno`, `semaforo_entrada`, `semaforo_almuerzo`, `marcas_faltantes`.
- React puede listar, paginar y filtrar por fecha sin leer Drive directamente.
