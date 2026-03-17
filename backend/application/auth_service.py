from __future__ import annotations

from backend.domain.models import CreateUserRequest, LoginResponse, UserProfile
from backend.domain.ports import AuthRepository


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    def login(self, email: str, password: str) -> LoginResponse:
        return self.repository.login(email=email, password=password)

    def me(self, token: str) -> UserProfile:
        return self.repository.get_profile_from_token(token)

    def list_users(self) -> list[UserProfile]:
        return self.repository.list_users()

    def create_user(self, payload: CreateUserRequest) -> UserProfile:
        return self.repository.create_user(payload)

    def delete_user(self, user_id: str) -> None:
        self.repository.delete_user(user_id)
