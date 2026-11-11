"""schemas/servicio.py — Esquemas Pydantic: Base / Create / Response (igual que en el documento de FastAPI)."""
from pydantic import BaseModel, ConfigDict

from schemas.tipos import Dinero, Nombre


class ServicioBase(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: Nombre
    tarifaBase: Dinero


class ServicioCreate(ServicioBase):
    pass


class ServicioTarifa(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nuevaTarifa: Dinero


class ServicioResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idServicio: int
    nombre: str
    tarifaBase: float
