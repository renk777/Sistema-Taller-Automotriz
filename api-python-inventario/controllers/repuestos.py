"""
controllers/repuestos.py
CRUD del catálogo de repuestos y control de stock. Rutas bajo /api/repuestos.
El stock se modifica SOLO por /reponer (suma) y por la API de órdenes (descuento al pasar a EN_REPARACION).
"""
from decimal import Decimal
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.connection import get_db
from models.repuesto import Repuesto
from schemas.repuesto import DescontarStock, ReponerStock, RepuestoCreate, RepuestoResponse, RepuestoUpdate
from schemas.tipos import MAX_INT
from security.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/repuestos", tags=["Repuestos"], dependencies=[Depends(get_current_user)])
solo_admin = Depends(require_roles("ADMIN"))
IdRepuesto = Annotated[int, Path(gt=0, le=MAX_INT, description="Identificador del repuesto")]


def _obtener(db: Session, id_repuesto: int) -> Repuesto:
    repuesto = db.query(Repuesto).filter(Repuesto.idRepuesto == id_repuesto).first()
    if not repuesto:
        raise HTTPException(status_code=404, detail="Repuesto no encontrado")
    return repuesto


def _validar_nombre_unico(db: Session, nombre: str, excepto_id: int = 0) -> None:
    existe = (
        db.query(Repuesto)
        .filter(func.lower(Repuesto.nombre) == nombre.lower(), Repuesto.idRepuesto != excepto_id)
        .first()
    )
    if existe:
        raise HTTPException(status_code=409, detail="Ya existe un repuesto con ese nombre")


@router.get("", response_model=List[RepuestoResponse])
def listar_repuestos(db: Session = Depends(get_db)):
    return db.query(Repuesto).order_by(Repuesto.idRepuesto).all()


@router.post("/reponer", dependencies=[solo_admin])
def reponer_stock(datos: ReponerStock, db: Session = Depends(get_db)):
    """Suma `cantidad` al stock de forma atómica (UPDATE ... SET stock = stock + n), sin superar el límite de la columna."""
    resultado = db.execute(
        update(Repuesto)
        .where(Repuesto.idRepuesto == datos.idRepuesto, Repuesto.stock + datos.cantidad <= MAX_INT)
        .values(stock=Repuesto.stock + datos.cantidad)
    )
    if resultado.rowcount == 0:
        db.rollback()
        _obtener(db, datos.idRepuesto)  # 404 si no existe
        raise HTTPException(status_code=409, detail="La reposición supera el stock máximo permitido")
    db.commit()
    stock = db.execute(select(Repuesto.stock).where(Repuesto.idRepuesto == datos.idRepuesto)).scalar_one()
    return {"mensaje": "Stock repuesto correctamente", "idRepuesto": datos.idRepuesto, "stock": stock}


@router.post("/descontar")
def descontar_stock(_: DescontarStock):
    """El descuento lo realiza la API de órdenes de forma transaccional; este endpoint solo lo documenta."""
    raise HTTPException(
        status_code=409,
        detail="El stock se descuenta automáticamente al pasar una orden a EN_REPARACION; no se permite descontar manualmente",
    )


@router.get("/{id_repuesto}", response_model=RepuestoResponse)
def obtener_repuesto(id_repuesto: IdRepuesto, db: Session = Depends(get_db)):
    return _obtener(db, id_repuesto)


@router.post("", response_model=RepuestoResponse, status_code=status.HTTP_201_CREATED, dependencies=[solo_admin])
def crear_repuesto(datos: RepuestoCreate, db: Session = Depends(get_db)):
    _validar_nombre_unico(db, datos.nombre)
    nuevo = Repuesto(nombre=datos.nombre, stock=datos.stock, precioUnitario=Decimal(str(datos.precioUnitario)))
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/{id_repuesto}", response_model=RepuestoResponse, dependencies=[solo_admin])
def actualizar_repuesto(id_repuesto: IdRepuesto, datos: RepuestoUpdate, db: Session = Depends(get_db)):
    repuesto = _obtener(db, id_repuesto)
    _validar_nombre_unico(db, datos.nombre, id_repuesto)
    repuesto.nombre = datos.nombre
    repuesto.precioUnitario = Decimal(str(datos.precioUnitario))
    db.commit()
    db.refresh(repuesto)
    return repuesto


@router.delete("/{id_repuesto}", dependencies=[solo_admin])
def eliminar_repuesto(id_repuesto: IdRepuesto, db: Session = Depends(get_db)):
    repuesto = _obtener(db, id_repuesto)
    try:
        db.delete(repuesto)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="No se puede eliminar: el repuesto está asociado a órdenes de trabajo")
    return {"mensaje": "Repuesto eliminado correctamente"}
