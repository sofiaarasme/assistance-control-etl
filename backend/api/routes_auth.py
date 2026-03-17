from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.dependencies import get_auth_service, get_current_user
from backend.application.auth_service import AuthService
from backend.domain.models import LoginRequest, LoginResponse, UserProfile


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, service: AuthService = Depends(get_auth_service)) -> LoginResponse:
    return service.login(email=payload.email, password=payload.password)


@router.get("/me", response_model=UserProfile)
def me(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    return current_user
