# YOLO_ETL

ETL para procesar reportes crudos de asistencia en CSV desde Google Drive y generar datasets limpios para un frontend en React.

## Objetivo

- Una persona carga **1 archivo mensual** de CSV crudo en una carpeta de Google Drive.
- El ETL en la nube lee todos los archivos mensuales válidos del histórico.
- Limpia/normaliza los datos.
- Consolida y actualiza datasets históricos:
   - `asistencia_eventos_historico.csv` (nivel transacción)
   - `asistencia_resumen_diario_historico.csv` (nivel persona/día)
   - `asistencia_metadata_historico.json`
- Publica resultados en carpeta `processed` de Google Drive (y opcionalmente local).

## Regla obligatoria de nombre de archivo mensual

Cada archivo que se suba a `raw` debe llamarse exactamente así:

- `asistencia_YYYY-MM-DD_YYYY-MM-DD.csv`

Ejemplo para abril 2026:

- `asistencia_2026-04-01_2026-04-30.csv`

Si el nombre no cumple el formato, el ETL lo omite y lo reporta en metadata.

## Reglas operativas calculadas por ETL

- Turno diurno: 07:00 a 19:00.
- Turno nocturno: 19:00 a 07:00 del día siguiente.
- 4 marcas esperadas por jornada: entrada, salida a almuerzo, regreso de almuerzo, salida.
- Alertas:
   - `semaforo_entrada`: verde/amarillo/rojo según segundos de retraso.
   - `semaforo_almuerzo`: verde/amarillo/rojo según duración de almuerzo.
   - `marcas_faltantes` y `alerta_general` para incidencias operativas.

## Estructura del proyecto

- [.github/workflows/etl-google-drive.yml](.github/workflows/etl-google-drive.yml): ejecución en GitHub Actions.
- [etl/config.py](etl/config.py): variables de entorno y credenciales.
- [etl/drive_client.py](etl/drive_client.py): extracción/carga en Google Drive.
- [etl/transform.py](etl/transform.py): limpieza y transformaciones.
- [etl/main.py](etl/main.py): orquestación ETL completa.
- [backend/main.py](backend/main.py): API FastAPI para consumo de React.
- [BACKEND_SUPABASE_SETUP.md](BACKEND_SUPABASE_SETUP.md): configuración de arquitectura clean, Supabase y despliegue gratis.
- [backend/repository.py](backend/repository.py): lectura/filtrado/paginación desde CSV histórico.
- [backend/config.py](backend/config.py): configuración del backend.
- [.env.example](.env.example): plantilla de configuración.
- [LOCAL_SETUP.md](LOCAL_SETUP.md): guía paso a paso para prueba local.

## Mapeo del CSV original

Basado en [Informe de los registros originales.csv](Informe%20de%20los%20registros%20originales.csv):

- `ID de persona` -> `persona_id` (sin `'` y solo dígitos)
- `Nombre` -> `nombre`
- `Departamento` crudo -> `departamento_raw`
- `Departamento` derivado -> `departamento` (ejemplo: `PERSONAL YOLO/04 Produccion/Grupo 1` => `Produccion`)
- `Hora` -> `fecha_hora` (datetime)
- `Punto de verificación de asistencia` -> `punto_verificacion`
- Derivadas:
  - `fecha`, `hora`, `grupo`, `dia_semana`, `semana_iso`
  - `tipo_evento`: `entrada`, `movimiento`, `salida`

## Configuración local (prueba)

1. Crea una cuenta de servicio en Google Cloud de la empresa (ideal) o temporal para pruebas.
2. Comparte en Drive:
   - carpeta `raw` (entrada) con la cuenta de servicio
   - carpeta `processed` (salida) con la cuenta de servicio
3. Copia `.env.example` a `.env` y llena valores.
4. Instala dependencias:
   - `pip install -r requirements.txt`
5. Ejecuta:
   - `python -m etl.main`

## Configuración en GitHub Actions (nube)

Configura estos `Repository Secrets`:

- `GDRIVE_RAW_FOLDER_ID`
- `GDRIVE_PROCESSED_FOLDER_ID`
- `GDRIVE_SERVICE_ACCOUNT_JSON_B64`

Para generar `GDRIVE_SERVICE_ACCOUNT_JSON_B64`:

- macOS/Linux: `base64 -i service-account.json | tr -d '\n'`

El workflow está en [etl-google-drive.yml](.github/workflows/etl-google-drive.yml#L1) y corre:

- Manual (`workflow_dispatch`)
- Automático los días 1, 2 y 3 de cada mes (10:00 UTC)

## Salidas para consumo del programa React

El frontend **no debe leer Google Drive directo**. Debe leer un API backend de la empresa.

Archivos de salida base:

- `asistencia_eventos_historico.csv`
- `asistencia_resumen_diario_historico.csv`
- `asistencia_metadata_historico.json`

Campos clave en `asistencia_resumen_diario_historico.csv`:

- `persona_id`
- `nombre`
- `fecha`
- `departamento`
- `grupo`
- `primer_registro`
- `ultimo_registro`
- `total_registros`
- `horas_en_planta`
- `source_file_name`
- `periodo_inicio`
- `periodo_fin`

## Instrucciones exactas para la persona de React

Entregar este contrato de integración:

1. React consume API HTTP corporativa (no Drive).  
2. Base URL ejemplo: `https://api.tuempresa.com`.
3. Endpoints mínimos:
   - `GET /api/v1/asistencia/resumen?from=YYYY-MM-DD&to=YYYY-MM-DD&departamento=Produccion&grupo=Grupo%201&page=1&pageSize=50`
   - `GET /api/v1/asistencia/eventos?from=YYYY-MM-DD&to=YYYY-MM-DD&departamento=Produccion&personaId=14678330&page=1&pageSize=200`
    - `GET /api/v1/asistencia/metadata`
4. El backend filtra por rango de fechas sobre `asistencia_resumen_diario_historico.csv` (o BD derivada).
5. React solo envía filtros y renderiza.

Ejemplo de respuesta para `GET /api/v1/asistencia/resumen`:

```json
{
   "items": [
      {
         "persona_id": "14678330",
         "nombre": "Gregorio Lobo",
         "fecha": "2026-03-07",
         "grupo": "Grupo 1",
         "primer_registro": "2026-03-07T07:01:25",
         "ultimo_registro": "2026-03-07T18:57:05",
         "total_registros": 2,
         "horas_en_planta": 11.93,
         "source_file_name": "asistencia_2026-03-01_2026-03-31.csv",
         "periodo_inicio": "2026-03-01",
         "periodo_fin": "2026-03-31"
      }
   ],
   "pagination": {
      "page": 1,
      "pageSize": 50,
      "total": 1
   }
}
```

Si quieres, el backend puede guardar el histórico en PostgreSQL y esos mismos endpoints quedan iguales.

## Backend local para React

API disponible en [backend/main.py](backend/main.py):

- `GET /health`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `DELETE /api/v1/admin/users/{id}`
- `GET /api/v1/asistencia/resumen`
- `GET /api/v1/asistencia/eventos`
- `GET /api/v1/asistencia/metadata`
- `GET /api/v1/asistencia/catalogos`

Configuración local completa en [LOCAL_SETUP.md](LOCAL_SETUP.md).

## Escalabilidad recomendada

- Separar capas `extract`, `transform`, `load` (ya aplicado).
- Añadir pruebas unitarias sobre [transform.py](etl/transform.py).
- Persistir datos en BD analítica (BigQuery/PostgreSQL) para React en producción.
- Agregar validaciones de calidad (registros nulos, duplicados, timestamps inválidos).

## Migración a entorno de la empresa (sin depender de tu cuenta)

### A. Recomendación de propiedad

Usar una **organización de GitHub de la empresa** + **Google Cloud de la empresa**:

- Código, Actions y secretos quedan en propiedad corporativa.
- Tú solo quedas como colaboradora temporal.

### B. Pasos para crear y entregar GitHub empresarial

1. Crear usuario técnico o, mejor, organización de empresa en GitHub.
2. Activar 2FA obligatoria para propietarios/admins.
3. Crear repositorio nuevo (privado) en la organización.
4. Subir este proyecto al repo empresarial.
5. Crear equipos y permisos:
   - `Admins`
   - `Developers`
   - `ReadOnly/Auditors`
6. Configurar `Secrets and variables` del repo con credenciales de la empresa.
7. Habilitar GitHub Actions en el repo.
8. Ejecutar workflow manual y validar salida.
9. Quitar tus accesos personales al finalizar handover.
10. Documentar operación y responsables.

### C. Checklist de handover final

- [ ] Repo en organización de la empresa
- [ ] Secrets en cuenta empresarial
- [ ] Service Account de Google en tenant de la empresa
- [ ] Carpetas Drive compartidas con cuenta de servicio empresarial
- [ ] Workflow exitoso en Actions
- [ ] Accesos personales removidos

## Próximo paso recomendado

Conectar `resumen_diario` a una base de datos para que React consuma por API y no por archivos.
