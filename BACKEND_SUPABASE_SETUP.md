# Backend + Supabase + Google Drive (setup completo)

## 1) Arquitectura backend (clean)

El backend quedó separado en capas:

- `backend/domain`: modelos y puertos.
- `backend/application`: casos de uso (asistencia y auth).
- `backend/infrastructure`: adaptadores (CSV y Supabase).
- `backend/api`: rutas FastAPI y dependencias.

## 2) Supabase (mini-BD usuarios)

### Crear proyecto
1. Crea un proyecto en Supabase (plan gratuito).
2. Ve a **SQL Editor** y ejecuta:
   - `supabase/sql/001_profiles.sql`

### Crear primer usuario admin
1. En Supabase -> **Authentication -> Users**, crea un usuario (email/password).
2. Copia su `UUID`.
3. Inserta ese UUID en `public.profiles` como role `admin`:

```sql
insert into public.profiles (id, email, nombre, role, departamento, activo)
values ('<AUTH_USER_UUID>', 'admin@serimar.com', 'Administrador', 'admin', null, true)
on conflict (id) do update set
  email = excluded.email,
  nombre = excluded.nombre,
  role = excluded.role,
  departamento = excluded.departamento,
  activo = excluded.activo;
```

## 3) Variables `.env` necesarias

```dotenv
# Google Drive
GDRIVE_RAW_FOLDER_ID=
GDRIVE_PROCESSED_FOLDER_ID=
GDRIVE_SERVICE_ACCOUNT_JSON_B64=
# o GDRIVE_SERVICE_ACCOUNT_FILE=/ruta/service-account.json

# ETL
TZ=America/Caracas
REPORTS_OUTPUT_DIR=data/processed
OUTPUT_MODE=both
STATE_FILE=state/processed_files.json

# API
API_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
RESUMEN_HISTORICO_FILENAME=asistencia_resumen_diario_historico.csv
EVENTOS_HISTORICO_FILENAME=asistencia_eventos_historico.csv
METADATA_HISTORICO_FILENAME=asistencia_metadata_historico.json

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 4) Endpoints nuevos de autenticación y admin

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/admin/users` (admin)
- `POST /api/v1/admin/users` (admin)
- `DELETE /api/v1/admin/users/{id}` (admin)

Los endpoints de asistencia se mantienen:

- `GET /api/v1/asistencia/resumen`
- `GET /api/v1/asistencia/eventos`
- `GET /api/v1/asistencia/metadata`
- `GET /api/v1/asistencia/catalogos`

## 5) GitHub Actions (gratis)

### ETL
Workflow: `.github/workflows/etl-google-drive.yml`

Secrets requeridos:
- `GDRIVE_RAW_FOLDER_ID`
- `GDRIVE_PROCESSED_FOLDER_ID`
- `GDRIVE_SERVICE_ACCOUNT_JSON_B64`

### Backend CI
Workflow: `.github/workflows/backend-ci.yml`

Valida sintaxis/imports en cada PR/push.

### Frontend GitHub Pages
Workflow: `.github/workflows/frontend-pages.yml`

Publica `frontend/dist` en GitHub Pages.

## 6) ¿Se puede desplegar todo en GitHub Pages?

- **Frontend React:** Sí.
- **Backend FastAPI:** No. GitHub Pages es estático y no ejecuta backend.

Alternativas gratuitas para backend:
- Render (free web service)
- Railway (trial/free limitado)
- Fly.io (free limitado)

Recomendación costo 0:
- Frontend: GitHub Pages
- Backend: Render free
- Auth/usuarios: Supabase free
- ETL programado: GitHub Actions

## 7) Orden recomendado de puesta en producción

1. Configurar Supabase (`profiles` + admin inicial).
2. Configurar secretos de GitHub para ETL.
3. Ejecutar ETL manual (`workflow_dispatch`) y validar outputs.
4. Desplegar backend en Render con variables `.env`.
5. Desplegar frontend en GitHub Pages y apuntar `API_BASE` al backend público.
