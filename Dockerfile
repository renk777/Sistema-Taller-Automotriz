FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends php-cli php-mysql python3 python3-venv ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY api-gateway/package*.json api-gateway/
COPY api-node-ordenes-facturas/package*.json api-node-ordenes-facturas/
RUN cd api-gateway && npm ci --omit=dev && cd ../api-node-ordenes-facturas && npm ci --omit=dev
COPY api-python-inventario/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt
COPY . .
ENV NODE_ENV=production PYTHONUNBUFFERED=1
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python3", "deploy/start.py"]
