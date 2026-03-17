from __future__ import annotations

from pathlib import Path
from typing import Protocol

import pandas as pd

from backend.domain.models import CreateUserRequest, LoginResponse, UserProfile


class AsistenciaRepository(Protocol):
    def load_resumen(self, file_path: Path) -> pd.DataFrame: ...

    def load_eventos(self, file_path: Path) -> pd.DataFrame: ...

    def load_metadata(self, file_path: Path) -> dict: ...


class AuthRepository(Protocol):
    def login(self, email: str, password: str) -> LoginResponse: ...

    def get_profile_from_token(self, token: str) -> UserProfile: ...

    def list_users(self) -> list[UserProfile]: ...

    def create_user(self, payload: CreateUserRequest) -> UserProfile: ...

    def delete_user(self, user_id: str) -> None: ...
