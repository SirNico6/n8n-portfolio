#!/usr/bin/env bash
# Fires the fixtures at an n8n webhook and prints the HTTP code and response.
#
#   ./send.sh <webhook-url>              -> sends all of them, in order
#   ./send.sh <webhook-url> 05           -> sends only fixture 05
#
# Order matters: 05 and 05b are duplicates of 01, so 01 has to have gone
# through first for deduplication to have anything to compare against.

set -u
URL="${1:-}"
ONLY="${2:-}"

if [ -z "$URL" ]; then
  echo "usage: $0 <webhook-url> [fixture-number]" >&2
  exit 1
fi

cd "$(dirname "$0")"

for f in $(ls [0-9][0-9]*.json | sort); do
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
