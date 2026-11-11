"""
main.py — Punto de entrada de la API de Inventario y Catálogo (FastAPI).
Arranque:  python main.py        (o:  python -m uvicorn main:app --host 127.0.0.1 --port 5000 --reload)
Documentación interactiva (OpenAPI/Swagger): http://127.0.0.1:5000/docs
Estructura: controllers (APIRouter) -> schemas (Pydantic) -> models (SQLAlchemy ORM) -> database/connection.py
"""
import logging
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.exc import OperationalError, SQLAlchemyError  # noqa: E402
from starlette.exceptions import HTTPException as StarletteHTTPException  # noqa: E402

from controllers import repuestos, servicios  # noqa: E402
from database.connection import SessionLocal  # noqa: E402
from security.auth import validar_configuracion  # noqa: E402

validar_configuracion()
logger = logging.getLogger("inventario")

app = FastAPI(
    title="API de Inventario y Catálogo - Taller Automotriz",
    description=(
        "Microservicio de servicios y repuestos. Se consume a través del API Gateway (RAMA = INVENTARIO). "
        "Para probar aquí en Swagger: usa el botón Authorize con el access token que entrega POST /login del gateway."
    ),
    version="2.0.0",
)

app.include_router(servicios.router)
app.include_router(repuestos.router)

MENSAJES_HTTP = {404: "Ruta no encontrada", 405: "Método no permitido para esta ruta"}


@app.get("/", tags=["Estado"])
def inicio():
    return {"status": "online", "mensaje": "API de inventario funcionando correctamente", "docs": "/docs"}


@app.get("/health", tags=["Estado"])
def health():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "online"}
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "offline"})
    finally:
        db.close()


# ---------- Manejo de errores: siempre JSON {"error": ...} y sin detalles internos ----------
@app.exception_handler(StarletteHTTPException)
async def manejar_http(_: Request, error: StarletteHTTPException):
    mensaje = MENSAJES_HTTP.get(error.status_code, error.detail if isinstance(error.detail, str) else "Error")
    return JSONResponse(status_code=error.status_code, content={"error": mensaje})


def _mensaje_validacion(detalle: dict) -> str:
    tipo = detalle.get("type", "")
    ctx = detalle.get("ctx") or {}
    if tipo == "missing":
        return "es obligatorio"
    if tipo in ("int_type", "int_parsing", "int_from_float"):
        return "debe ser un número entero (sin comillas ni decimales)"
    if tipo in ("float_type", "float_parsing", "decimal_type"):
        return "debe ser un número (sin comillas)"
    if tipo == "string_type":
        return "debe ser texto"
    if tipo == "finite_number":
        return "debe ser un número finito"
    if tipo == "greater_than":
        return f"debe ser mayor que {ctx.get('gt')}"
    if tipo == "greater_than_equal":
        return f"debe ser mayor o igual que {ctx.get('ge')}"
    if tipo == "less_than_equal":
        return f"no puede ser mayor que {ctx.get('le')}"
    if tipo == "string_too_short":
        return "no puede estar vacío"
    if tipo == "string_too_long":
        return f"no puede superar {ctx.get('max_length')} caracteres"
    if tipo == "extra_forbidden":
        return "campo no permitido"
    if tipo == "value_error":
        return str(ctx.get("error", "valor inválido")).replace("Value error, ", "")
    return detalle.get("msg", "valor inválido")


@app.exception_handler(RequestValidationError)
async def manejar_validacion(_: Request, error: RequestValidationError):
    detalles = []
    for item in error.errors():
        ubicacion = [str(parte) for parte in item.get("loc", []) if parte not in ("body", "path", "query")]
        campo = ".".join(ubicacion) or "cuerpo"
        if item.get("type") == "json_invalid":
            return JSONResponse(status_code=400, content={"error": "El cuerpo no es un JSON válido"})
        detalles.append({"campo": campo, "mensaje": _mensaje_validacion(item)})
    primero = detalles[0] if detalles else {"campo": "cuerpo", "mensaje": "solicitud inválida"}
    return JSONResponse(
        status_code=400,
        content={"error": f"Campo '{primero['campo']}': {primero['mensaje']}", "detalles": detalles},
    )


@app.exception_handler(OperationalError)
async def manejar_bd_no_disponible(_: Request, error: OperationalError):
    logger.error("Base de datos no disponible: %s", type(error.orig).__name__)
    return JSONResponse(status_code=503, content={"error": "Base de datos no disponible"})


@app.exception_handler(SQLAlchemyError)
async def manejar_bd(_: Request, error: SQLAlchemyError):
    logger.error("Error de base de datos: %s", type(error).__name__)
    return JSONResponse(status_code=500, content={"error": "Error interno del servidor"})


@app.exception_handler(Exception)
async def manejar_error_interno(_: Request, error: Exception):
    logger.exception("Error interno")
    return JSONResponse(status_code=500, content={"error": "Error interno del servidor"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=int(os.getenv("PORT", "5000")))
