from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


UserRole = Literal["admin", "departamento"]


class UserProfile(BaseModel):
    id: str
    email: str
    nombre: str
    role: UserRole
    departamento: str | None = None
    activo: bool = True


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    user: UserProfile


class CreateUserRequest(BaseModel):
    nombre: str = Field(min_length=2)
    email: str
    password: str = Field(min_length=6)
    role: UserRole
    departamento: str | None = None
