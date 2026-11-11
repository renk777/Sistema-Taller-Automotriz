@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===================================================
echo  TallerAuto - preparacion del entorno (una sola vez)
echo ===================================================
where node >nul 2>nul || (echo [ERROR] Node.js no esta instalado o no esta en el PATH. & pause & exit /b 1)
where python >nul 2>nul || (echo [ERROR] Python no esta instalado o no esta en el PATH. & pause & exit /b 1)
echo.
echo 1/4 Creando archivos .env ...
node scripts\preparar-env.js || (pause & exit /b 1)
echo.
echo 2/4 Instalando dependencias del API Gateway ...
pushd api-gateway && call npm install && popd
echo.
echo 3/4 Instalando dependencias de la API de ordenes y facturas ...
pushd api-node-ordenes-facturas && call npm install && popd
echo.
echo 4/4 Instalando dependencias de la API de inventario (Python) ...
pushd api-python-inventario && python -m pip install -r requirements.txt && popd
echo.
echo Listo. Siguiente paso: importar database\schema.sql en MySQL y ejecutar iniciar_todo.bat
echo (ver GUIA_PUESTA_EN_MARCHA.txt)
pause
