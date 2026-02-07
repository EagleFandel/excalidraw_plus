#!/bin/sh
set -eu

echo "[entrypoint] starting backend on ${BACKEND_HOST:-127.0.0.1}:${BACKEND_PORT:-3005}"

node /opt/node_app/backend/dist/main.js &
BACKEND_PID=$!

echo "[entrypoint] starting nginx on ${PORT:-80}"

nginx -g 'daemon off;' &
NGINX_PID=$!

wait -n "$BACKEND_PID" "$NGINX_PID"
EXIT_CODE=$?

kill "$BACKEND_PID" "$NGINX_PID" 2>/dev/null || true
wait "$BACKEND_PID" "$NGINX_PID" 2>/dev/null || true

exit "$EXIT_CODE"

