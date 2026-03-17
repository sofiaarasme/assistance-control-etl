from __future__ import annotations

from fastapi import HTTPException, status
from supabase import Client, create_client

from backend.config import ApiSettings
from backend.domain.models import CreateUserRequest, LoginResponse, UserProfile


class SupabaseAuthRepository:
    def __init__(self, settings: ApiSettings):
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise ValueError("SUPABASE_URL y SUPABASE_ANON_KEY son obligatorios para autenticación")
        if not settings.supabase_service_role_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY es obligatorio para gestión de usuarios")

        self.settings = settings
        self.anon_client: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
        self.admin_client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    def _to_profile(self, data: dict, fallback_email: str | None = None) -> UserProfile:
        return UserProfile(
            id=str(data.get("id") or ""),
            email=str(data.get("email") or fallback_email or ""),
            nombre=str(data.get("nombre") or data.get("email") or ""),
            role=str(data.get("role") or "departamento"),
            departamento=data.get("departamento"),
            activo=bool(data.get("activo", True)),
        )

    def _fetch_profile(self, user_id: str, fallback_email: str | None = None) -> UserProfile:
        profile_resp = (
            self.admin_client.table("profiles")
            .select("id,email,nombre,role,departamento,activo")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = profile_resp.data or []
        if rows:
            return self._to_profile(rows[0], fallback_email=fallback_email)

        if fallback_email:
            return UserProfile(
                id=user_id,
                email=fallback_email,
                nombre=fallback_email,
                role="departamento",
                departamento=None,
                activo=True,
            )

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil no encontrado")

    def login(self, email: str, password: str) -> LoginResponse:
        try:
            auth_response = self.anon_client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        if not auth_response.session or not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No se pudo iniciar sesión",
            )

        profile = self._fetch_profile(str(auth_response.user.id), fallback_email=auth_response.user.email)
        return LoginResponse(
            access_token=auth_response.session.access_token,
            refresh_token=auth_response.session.refresh_token,
            expires_in=auth_response.session.expires_in,
            user=profile,
        )

    def get_profile_from_token(self, token: str) -> UserProfile:
        try:
            user_response = self.anon_client.auth.get_user(token)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
            )

        if not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
            )

        user = user_response.user
        return self._fetch_profile(str(user.id), fallback_email=user.email)

    def list_users(self) -> list[UserProfile]:
        resp = (
            self.admin_client.table("profiles")
            .select("id,email,nombre,role,departamento,activo")
            .order("nombre")
            .execute()
        )
        rows = resp.data or []
        return [self._to_profile(row) for row in rows]

    def create_user(self, payload: CreateUserRequest) -> UserProfile:
        try:
            created = self.admin_client.auth.admin.create_user(
                {
                    "email": payload.email,
                    "password": payload.password,
                    "email_confirm": True,
                    "user_metadata": {"nombre": payload.nombre},
                }
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se pudo crear el usuario: {exc}",
            )

        if not created.user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Respuesta inválida de Supabase")

        user_id = str(created.user.id)
        profile_payload = {
            "id": user_id,
            "email": payload.email,
            "nombre": payload.nombre,
            "role": payload.role,
            "departamento": payload.departamento,
            "activo": True,
        }

        self.admin_client.table("profiles").upsert(profile_payload).execute()
        return self._to_profile(profile_payload)

    def delete_user(self, user_id: str) -> None:
        self.admin_client.table("profiles").delete().eq("id", user_id).execute()
        try:
            self.admin_client.auth.admin.delete_user(user_id)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se pudo eliminar el usuario en auth: {exc}",
            )
