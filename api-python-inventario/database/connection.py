"""
database/connection.py
Conexión a MySQL con SQLAlchemy. Las credenciales se leen del archivo .env (python-dotenv),
nunca del código. get_db() es una dependencia de FastAPI: abre una sesión por petición y la cierra siempre.
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = URL.create(
    "mysql+pymysql",
    username=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),  # URL.create escapa caracteres especiales de la contraseña
    host=os.getenv("DB_HOST", "127.0.0.1"),
    port=int(os.getenv("DB_PORT", "3306")),
    database=os.getenv("DB_NAME", "taller_automotriz"),
    query={"charset": "utf8mb4"},
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependencia: abre la sesión de la petición y la cierra al terminar la respuesta."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
