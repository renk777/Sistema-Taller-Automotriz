"""
controllers/servicios.py
CRUD del catálogo de servicios. APIRouter agrupa las rutas bajo /api/servicios.
Todas exigen JWT; crear, editar, cambiar tarifa y eliminar son solo para ADMIN.
"""
from decimal import Decimal
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.connection import get_db
from models.servicio import Servicio
from schemas.servicio import ServicioCreate, ServicioResponse, ServicioTarifa
from schemas.tipos import MAX_INT
from security.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/servicios", tags=["Servicios"], dependencies=[Depends(get_current_user)])
solo_admin = Depends(require_roles("ADMIN"))
IdServicio = Annotated[int, Path(gt=0, le=MAX_INT, description="Identificador del servicio")]


def _obtener(db: Session, id_servicio: int) -> Servicio:
    servicio = db.query(Servicio).filter(Servicio.idServicio == id_servicio).first()
    if not servicio:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return servicio


def _validar_nombre_unico(db: Session, nombre: str, excepto_id: int = 0) -> None:
    existe = (
        db.query(Servicio)
        .filter(func.lower(Servicio.nombre) == nombre.lower(), Servicio.idServicio != excepto_id)
        .first()
    )
    if existe:
        raise HTTPException(status_code=409, detail="Ya existe un servicio con ese nombre")


@router.get("", response_model=List[ServicioResponse])
def listar_servicios(db: Session = Depends(get_db)):
    return db.query(Servicio).order_by(Servicio.idServicio).all()


@router.get("/{id_servicio}", response_model=ServicioResponse)
def obtener_servicio(id_servicio: IdServicio, db: Session = Depends(get_db)):
    return _obtener(db, id_servicio)


@router.post("", response_model=ServicioResponse, status_code=status.HTTP_201_CREATED, dependencies=[solo_admin])
def crear_servicio(datos: ServicioCreate, db: Session = Depends(get_db)):
    _validar_nombre_unico(db, datos.nombre)
    nuevo = Servicio(nombre=datos.nombre, tarifaBase=Decimal(str(datos.tarifaBase)))
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/{id_servicio}", response_model=ServicioResponse, dependencies=[solo_admin])
def actualizar_servicio(id_servicio: IdServicio, datos: ServicioCreate, db: Session = Depends(get_db)):
    servicio = _obtener(db, id_servicio)
    _validar_nombre_unico(db, datos.nombre, id_servicio)
    servicio.nombre = datos.nombre
    servicio.tarifaBase = Decimal(str(datos.tarifaBase))
    db.commit()
    db.refresh(servicio)
    return servicio


@router.put("/{id_servicio}/tarifa", dependencies=[solo_admin])
def actualizar_tarifa(id_servicio: IdServicio, datos: ServicioTarifa, db: Session = Depends(get_db)):
    servicio = _obtener(db, id_servicio)
    servicio.tarifaBase = Decimal(str(datos.nuevaTarifa))
    db.commit()
    return {"mensaje": "Tarifa actualizada correctamente", "idServicio": id_servicio, "tarifaBase": datos.nuevaTarifa}


@router.delete("/{id_servicio}", dependencies=[solo_admin])
def eliminar_servicio(id_servicio: IdServicio, db: Session = Depends(get_db)):
    servicio = _obtener(db, id_servicio)
    try:
        db.delete(servicio)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="No se puede eliminar: el servicio está asociado a órdenes de trabajo")
    return {"mensaje": "Servicio eliminado correctamente"}
