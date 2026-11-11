"""models/servicio.py — Modelo ORM de la tabla servicios (el esquema lo crea database/schema.sql)."""
from sqlalchemy import Column, Integer, Numeric, String

from database.connection import Base


class Servicio(Base):
    __tablename__ = "servicios"

    idServicio = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    tarifaBase = Column(Numeric(10, 2), nullable=False)
