#!/bin/sh
set -eu

echo "[entrypoint] rendering nginx config with PORT=${PORT:-80}, API_UPSTREAM=${API_UPSTREAM:-http://127.0.0.1:3005}"

if [ -f /etc/nginx/templates/default.conf.template ]; then
  if command -v envsubst >/dev/null 2>&1; then
    envsubst '${PORT} ${API_UPSTREAM}' \
      < /etc/nginx/templates/default.conf.template \
      > /etc/nginx/conf.d/default.conf
  else
    echo "[entrypoint] envsubst not found"
    exit 1
  fi
fi

echo "[entrypoint] starting backend on ${BACKEND_HOST:-127.0.0.1}:${BACKEND_PORT:-3005}"

node /opt/node_app/backend/dist/main.js &
BACKEND_PID=$!

echo "[entrypoint] starting nginx on ${PORT:-80}"

nginx -g 'daemon off;' &
NGINX_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$NGINX_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$NGINX_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

while :; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[entrypoint] backend exited"
    exit 1
  fi

  if ! kill -0 "$NGINX_PID" 2>/dev/null; then
    echo "[entrypoint] nginx exited"
    wait "$NGINX_PID" 2>/dev/null || true
    exit 1
  fi

  sleep 1
done
