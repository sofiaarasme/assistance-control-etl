from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.dependencies import get_settings
from backend.api.routes_admin import router as admin_router
from backend.api.routes_asistencia import router as asistencia_router
from backend.api.routes_auth import router as auth_router

settings = get_settings()

app = FastAPI(
    title="Asistencia API",
    version="2.0.0",
    description="API clean architecture para asistencia, ETL histórico y autenticación con Supabase.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "version": "2.0.0"}


app.include_router(asistencia_router)
app.include_router(auth_router)
app.include_router(admin_router)
