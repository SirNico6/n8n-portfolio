#!/usr/bin/env bash
# Dispara fixtures contra un webhook de n8n y muestra codigo HTTP + respuesta.
#
#   ./enviar.sh <webhook-url>              -> manda todos, en orden
#   ./enviar.sh <webhook-url> 05           -> manda solo el fixture 05
#
# El orden importa: 05 es el duplicado de 01, asi que 01 tiene que haber
# pasado antes para que la deduplicacion tenga contra que comparar.

set -u
URL="${1:-}"
ONLY="${2:-}"

if [ -z "$URL" ]; then
  echo "uso: $0 <webhook-url> [numero-de-fixture]" >&2
  exit 1
fi

cd "$(dirname "$0")"

for f in $(ls [0-9][0-9]-*.json | sort); do
  n="${f%%-*}"
  if [ -n "$ONLY" ] && [ "$n" != "$ONLY" ]; then
    continue
  fi

  printf '\n=== %s ===\n' "$f"
  code=$(curl -sS -o /tmp/n8n-resp.txt -w '%{http_code}' \
    -X POST "$URL" \
    -H 'Content-Type: application/json' \
    --data-binary "@$f")

  printf 'HTTP %s\n' "$code"
  head -c 600 /tmp/n8n-resp.txt
  printf '\n'
done
