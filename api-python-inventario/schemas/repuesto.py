"""schemas/repuesto.py — Esquemas Pydantic de repuestos."""
from pydantic import BaseModel, ConfigDict

from schemas.tipos import Cantidad, Dinero, IdEntero, Nombre, StockInicial


class RepuestoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: Nombre
    stock: StockInicial = 0
    precioUnitario: Dinero


class RepuestoUpdate(BaseModel):
    """PUT: el stock NO se edita aquí; se modifica solo con /reponer y con el descuento de la API de órdenes."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombre: Nombre
    precioUnitario: Dinero


class ReponerStock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idRepuesto: IdEntero
    cantidad: Cantidad


class DescontarStock(BaseModel):
    model_config = ConfigDict(extra="allow")


class RepuestoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idRepuesto: int
    nombre: str
    stock: int
    precioUnitario: float
