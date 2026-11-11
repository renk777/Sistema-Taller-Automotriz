"""
schemas/tipos.py
Tipos estrictos reutilizables. Pydantic actúa como "guardián" de la API: no acepta números como texto,
decimales donde se espera un entero, booleanos, NaN/Infinity ni valores fuera del rango de la columna.
"""
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, Field

MAX_INT = 2_147_483_647
MAX_DINERO = 99_999_999.99  # DECIMAL(10,2)


def _maximo_dos_decimales(valor: float) -> float:
    if Decimal(str(valor)).as_tuple().exponent < -2:
        raise ValueError("no puede tener más de 2 decimales")
    return valor


Dinero = Annotated[
    float,
    Field(strict=True, gt=0, le=MAX_DINERO, allow_inf_nan=False),
    AfterValidator(_maximo_dos_decimales),
]
IdEntero = Annotated[int, Field(strict=True, gt=0, le=MAX_INT)]
Cantidad = Annotated[int, Field(strict=True, gt=0, le=1_000_000)]
StockInicial = Annotated[int, Field(strict=True, ge=0, le=MAX_INT)]
Nombre = Annotated[str, Field(strict=True, min_length=1, max_length=100)]
