#!/usr/bin/env bash
set -euo pipefail

NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/muusic2.0}"
PANEL_HOST="${PANEL_HOST:-}"
ENV_FILE="${ENV_FILE:-.env}"

fail() {
  echo "[smoke][FAIL] $1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando ausente: $1"
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  grep -q "$pattern" "$file" || fail "$description"
}

need_cmd curl
need_cmd grep

if [[ ! -f "$NGINX_SITE" ]]; then
  fail "Arquivo nginx nao encontrado: $NGINX_SITE"
fi

if [[ -z "$PANEL_HOST" && -f "$ENV_FILE" ]]; then
  env_frontend_urls=$(grep -E '^FRONTEND_URLS=' "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true)
  if [[ "$env_frontend_urls" == *"painel.muusic.live"* ]]; then
    PANEL_HOST="painel.muusic.live"
  fi
fi

assert_contains "$NGINX_SITE" "server_name muusic.live" "Nginx sem server_name muusic.live"

if [[ -n "$PANEL_HOST" ]]; then
  assert_contains "$NGINX_SITE" "server_name $PANEL_HOST" "Nginx sem server_name $PANEL_HOST"
fi

for route in "/auth/" "/admin/" "/api/" "/health"; do
  assert_contains "$NGINX_SITE" "location $route" "Nginx sem location obrigatoria: $route"
done

for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:3001/health" >/dev/null; then
    break
  fi
  sleep 1
  if [[ "$i" -eq 20 ]]; then
    fail "Backend nao respondeu /health em 20s"
  fi
done

api_muusic=$(curl -fsSL -H 'Host: muusic.live' 'http://127.0.0.1/api/shows?page=1&limit=1')
echo "$api_muusic" | grep -q '"shows"' || fail "muusic.live /api/shows nao retornou JSON esperado"

if [[ -n "$PANEL_HOST" ]]; then
  api_painel=$(curl -fsSL -H "Host: $PANEL_HOST" 'http://127.0.0.1/api/shows?page=1&limit=1')
  echo "$api_painel" | grep -q '"shows"' || fail "$PANEL_HOST /api/shows nao retornou JSON esperado"

  admin_status=$(curl -s -o /tmp/muusic-admin-smoke.out -w '%{http_code}' -H "Host: $PANEL_HOST" 'http://127.0.0.1/admin/users')
  if [[ "$admin_status" != "401" && "$admin_status" != "403" ]]; then
    body=$(head -c 200 /tmp/muusic-admin-smoke.out 2>/dev/null || true)
    fail "$PANEL_HOST /admin/users retornou status inesperado: $admin_status | body: $body"
  fi

  cors_headers_file="/tmp/muusic-cors-smoke.headers"
  curl -sSL -o /dev/null -D "$cors_headers_file" \
    -X OPTIONS 'http://127.0.0.1/auth/local/login' \
    -H 'Host: muusic.live' \
    -H "Origin: https://$PANEL_HOST" \
    -H 'Access-Control-Request-Method: POST'

  grep -qi "^access-control-allow-origin: https://$PANEL_HOST" "$cors_headers_file" || fail "CORS entre $PANEL_HOST e muusic.live nao autorizado"
fi

echo "[smoke][OK] Rotas, CORS e endpoints criticos validados."
