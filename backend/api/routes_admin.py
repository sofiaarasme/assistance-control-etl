from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from backend.api.dependencies import get_auth_service, require_admin
from backend.application.auth_service import AuthService
from backend.domain.models import CreateUserRequest, UserProfile


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/users", response_model=list[UserProfile], dependencies=[Depends(require_admin)])
def list_users(service: AuthService = Depends(get_auth_service)) -> list[UserProfile]:
    return service.list_users()


@router.post("/users", response_model=UserProfile, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_user(payload: CreateUserRequest, service: AuthService = Depends(get_auth_service)) -> UserProfile:
    return service.create_user(payload)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_user(user_id: str, service: AuthService = Depends(get_auth_service)) -> Response:
    service.delete_user(user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
