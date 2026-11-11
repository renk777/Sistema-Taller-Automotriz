"""
security/auth.py
Validación del JWT (HS256) que el API Gateway reenvía en "Authorization: Bearer <token>".
401: no hay token.  403: token inválido o expirado, o el rol no tiene permiso.
HTTPBearer hace que Swagger (/docs) muestre el botón "Authorize" para probar los endpoints.
"""
import os
from typing import Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False, description="JWT emitido por el API Gateway (POST /login)")


def validar_configuracion() -> str:
    """Termina el proceso si JWT_SECRET falta, es la plantilla o es débil."""
    secreto = os.getenv("JWT_SECRET", "")
    if not secreto or secreto == "replace-with-a-long-random-secret" or len(secreto) < 32:
        print("JWT_SECRET es obligatorio (mismo valor que el gateway), distinto de la plantilla y de al menos 32 caracteres.")
        raise SystemExit(1)
    return secreto


def get_current_user(credenciales: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> dict:
    if credenciales is None or not credenciales.credentials:
        raise HTTPException(status_code=401, detail="Token no proporcionado")
    try:
        return jwt.decode(
            credenciales.credentials,
            os.getenv("JWT_SECRET", ""),
            algorithms=["HS256"],
            options={"require": ["exp"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=403, detail="Token inválido o expirado")


def require_roles(*roles: str):
    """Dependencia que restringe una ruta a ciertos roles."""

    def verificar(usuario: dict = Depends(get_current_user)) -> dict:
        if usuario.get("rol") not in roles:
            raise HTTPException(status_code=403, detail="El rol no puede ejecutar esta operación")
        return usuario

    return verificar
