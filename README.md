# Assistance Control (Frontend-Only)

Arquitectura final sin backend propio.

- Frontend React en `frontend/`
- Autenticación y perfiles de usuarios en Supabase
- Datos de asistencia leídos directamente desde Google Drive privado vía OAuth (Google Identity Services)
- Despliegue web en GitHub Pages

## Estructura actual

- `frontend/`: aplicación React (única app runtime)
- `supabase/sql/001_profiles.sql`: tabla `profiles` para roles/permisos
- `.github/workflows/frontend-pages.yml`: deploy automático a GitHub Pages

## Variables de entorno

Este proyecto usa variables en `frontend/.env` (no en la raíz).

Copia `frontend/.env.example` a `frontend/.env` y configura:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_DRIVE_FILE_IDS`

## Supabase

1. Crea proyecto (plan gratuito).
2. Ejecuta `supabase/sql/001_profiles.sql` en SQL Editor.
3. En `Authentication > Users`, crea usuarios.
4. Inserta perfil para cada usuario en `public.profiles` con rol `admin` o `departamento`.

## Google OAuth + Drive privado

1. En Google Cloud, habilita Drive API.
2. Crea OAuth Client ID tipo Web Application.
3. En `Authorized JavaScript origins` agrega:
   - `http://localhost:5173`
   - `https://TU_USUARIO.github.io`
4. Copia el Client ID a `VITE_GOOGLE_CLIENT_ID`.
5. Coloca en `VITE_GOOGLE_DRIVE_FILE_IDS` los IDs CSV separados por coma.
6. Asegúrate de que el usuario autenticado tenga permiso sobre esos archivos en Drive.

## Desarrollo local

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
cd frontend
npm run build
```

## Deploy a GitHub Pages

1. Push a `main`.
2. Workflow `frontend-pages.yml` genera y publica `frontend/dist`.
3. URL final: `https://TU_USUARIO.github.io/NOMBRE_REPO/`.

## Notas importantes

- No uses `client_secret` en frontend.
- `SUPABASE_SERVICE_ROLE_KEY` nunca debe ir en cliente web.
- Si expusiste claves en `.env`, rótalas inmediatamente en Supabase y Google Cloud.
