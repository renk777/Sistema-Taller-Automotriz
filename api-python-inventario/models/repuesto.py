"""models/repuesto.py — Modelo ORM de la tabla repuestos."""
from sqlalchemy import Column, Integer, Numeric, String

from database.connection import Base


class Repuesto(Base):
    __tablename__ = "repuestos"

    idRepuesto = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    precioUnitario = Column(Numeric(10, 2), nullable=False)
