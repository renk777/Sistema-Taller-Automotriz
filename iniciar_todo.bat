@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Si PHP no esta en el PATH, escribe aqui la ruta completa. Ejemplo: set PHP_EXE=C:\xampp\php\php.exe
set PHP_EXE=php

echo Iniciando los servicios del taller en ventanas separadas ...
start "TallerAuto - PHP entidades y vehiculos (8000)" cmd /k "cd /d api-php-entidades-vehiculos && %PHP_EXE% -S 127.0.0.1:8000 index.php"
start "TallerAuto - Python inventario (5000)" cmd /k "cd /d api-python-inventario && python main.py"
start "TallerAuto - Node ordenes y facturas (3000)" cmd /k "cd /d api-node-ordenes-facturas && npm start"
start "TallerAuto - API Gateway (4000)" cmd /k "cd /d api-gateway && npm start"
start "TallerAuto - Frontend (5500)" cmd /k "cd /d frontend-taller && python -m http.server 5500 --bind 127.0.0.1"

timeout /t 7 >nul
start http://127.0.0.1:5500
echo.
echo Para detener todo, cierra las 5 ventanas que se abrieron.
