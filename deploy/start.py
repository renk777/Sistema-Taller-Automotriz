"""Run the internal services and expose only the gateway. Database is external."""
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
children = []

def stop(signum=None, frame=None):
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try:
            child.wait(timeout=8)
        except subprocess.TimeoutExpired:
            child.kill()

signal.signal(signal.SIGTERM, lambda s, f: (stop(), sys.exit(0)))
signal.signal(signal.SIGINT, lambda s, f: (stop(), sys.exit(0)))

subprocess.run(['node', str(ROOT / 'deploy/init-db.js')], check=True)
services = [
    ('api-php-entidades-vehiculos', ['php', '-S', '127.0.0.1:8000', 'index.php'], {'PHP_CLI_SERVER_WORKERS': '2'}),
    ('api-python-inventario', ['/opt/venv/bin/uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '5000'], {}),
    ('api-node-ordenes-facturas', ['node', 'src/app.js'], {'PORT': '3000'}),
    ('api-gateway', ['node', 'src/server.js'], {'HOST': '0.0.0.0', 'PORT': os.getenv('PORT', '8080'), 'TRUST_PROXY': '1'}),
]
try:
    for directory, command, overrides in services:
        children.append(subprocess.Popen(command, cwd=ROOT / directory, env={**os.environ, **overrides}))
    while all(child.poll() is None for child in children):
        time.sleep(1)
    print('A service stopped; restarting the container.', flush=True)
finally:
    stop()
sys.exit(1)
