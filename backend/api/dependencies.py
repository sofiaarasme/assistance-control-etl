from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.application.asistencia_service import AsistenciaService
from backend.application.auth_service import AuthService
from backend.config import ApiSettings
from backend.domain.models import UserProfile
from backend.infrastructure.csv_asistencia_repository import CsvAsistenciaRepository
from backend.infrastructure.supabase_auth_repository import SupabaseAuthRepository


security = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def get_settings() -> ApiSettings:
    return ApiSettings.from_env()


@lru_cache(maxsize=1)
def get_asistencia_service() -> AsistenciaService:
    settings = get_settings()
    repo = CsvAsistenciaRepository()
    return AsistenciaService(settings=settings, repository=repo)


@lru_cache(maxsize=1)
def get_auth_service() -> AuthService:
    settings = get_settings()
    repo = SupabaseAuthRepository(settings=settings)
    return AuthService(repository=repo)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserProfile:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token requerido",
        )
    return auth_service.me(credentials.credentials)


def require_admin(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo admins pueden realizar esta acción",
        )
    return current_user
