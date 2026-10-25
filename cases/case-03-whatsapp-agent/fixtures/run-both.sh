#!/usr/bin/env bash
# Replays the same six Meta webhook payloads against both versions of the
# agent and prints what each one tried to send.
#
#   ./run-both.sh [n8n-base-url]
#
# Needs N8N_API_KEY in the environment to read the log table, and the table id
# below. No Meta credentials are needed: the local collector stands in for the
# send endpoint, so the metric is what the workflow *tried* to send.
#
# Before running:
#
# 1. Start the collector in another terminal:   node collector.js
# 2. Import both workflows and **publish** them. n8n does not serve the
#    production webhook path for an unpublished workflow; the replay below
#    then gets a 404 that says nothing about why.
# 3. In each workflow's `Config` node set `api_base` to the collector:
#      http://host.docker.internal:8099   n8n in Docker, collector on Windows
#      http://localhost:8099              n8n and collector on the same host
#    Set it back to https://graph.facebook.com/v26.0 for real use. This script
#    does not patch the workflow JSON, because a run that silently rewrote the
#    thing it is measuring would not be a measurement.
#
# Two notes on reading the output:
#
# * The response time per replay is part of the result. Version A holds the
#   connection open through its 3-second think step; version B answers 200 on
#   receipt. Meta retries a delivery it does not get a prompt 200 for.
# * Version B's deduplication history lives in n8n and survives runs. A second
#   pass of this script will show B sending nothing at all, because every
#   message id has been seen. To start B over, run the Remove Duplicates
#   node's "Clear Database" operation first. Clearing the log table does not
#   clear the dedupe store.

set -u
BASE="${1:-http://localhost:5678}"
COLLECTOR="${COLLECTOR:-http://localhost:8099}"
T_LOG="${T_LOG:-REPLACE_WITH_YOUR_MESSAGE_LOG_TABLE_ID}"
HERE="$(cd "$(dirname "$0")" && pwd)"

FIXTURES="01-inbound-text 02-same-message-retry 03-status-sent 04-status-delivered 05-inbound-second 06-inbound-sticker"

if [ -z "${N8N_API_KEY:-}" ]; then
  echo "set N8N_API_KEY first" >&2
  exit 1
fi

if ! curl -sS --max-time 3 "$COLLECTOR/__stats" -o /dev/null; then
  echo "no collector on $COLLECTOR — start it with: node $HERE/collector.js" >&2
  exit 1
fi

clear_table() {
  curl -sS -X DELETE -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$BASE/api/v1/data-tables/$1/rows/clear" -o /dev/null
}

replay() {
  # replay <webhook-path>
  for f in $FIXTURES; do
    printf "  %-24s " "$f"
    curl -sS -X POST "$BASE/webhook/$1" \
      -H 'Content-Type: application/json' \
      --data-binary "@$HERE/$f.json" \
      -o /dev/null --max-time 60 \
      -w "HTTP %{http_code} in %{time_total}s\n" \
      || echo "request failed"
  done
}

# Reads the collector's counters and clears them, so the next version starts
# from zero.
collected() {
  curl -sS "$COLLECTOR/__stats?reset=1" | node -e '
  let raw = "";
  process.stdin.on("data", (d) => (raw += d)).on("end", () => {
    const s = JSON.parse(raw);
    console.log("    send attempts: " + s.requests);
    for (const [to, n] of Object.entries(s.recipients)) {
      console.log("      to " + to + ": " + n);
    }
    for (const r of s.sent) {
      console.log("      " + String(r.n).padStart(2) + ". " + r.to + "  " +
        JSON.stringify(r.text.slice(0, 64)));
    }
  });
  '
}

log_rows() {
  node -e '
  (async () => {
    const [base, key, id] = process.argv.slice(1);
    let all = [], cursor = null;
    do {
      const u = base + "/api/v1/data-tables/" + id + "/rows?limit=250" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
      const d = await (await fetch(u, { headers: { "X-N8N-API-KEY": key } })).json();
      all = all.concat(d.data || []);
      cursor = d.nextCursor || null;
    } while (cursor);
    const ids = new Set(all.map((r) => r.message_id));
    console.log("    log rows: " + all.length + " / " + ids.size + " distinct message ids");
    for (const r of all) {
      console.log("      " + String(r.status).padEnd(12) + " " +
        String(r.message_id).slice(-6) + "  " +
        JSON.stringify(String(r.inbound_text || "").slice(0, 40)) + " -> " +
        JSON.stringify(String(r.outbound_text || "").slice(0, 40)));
    }
  })();
  ' "$BASE" "$N8N_API_KEY" "$T_LOG"
}

echo "=== version A (naive), six payloads, one pass ==="
clear_table "$T_LOG"
curl -sS "$COLLECTOR/__stats?reset=1" -o /dev/null
replay "whatsapp-naive"
echo "  what the collector saw:"
collected
echo "  what the log table says:"
log_rows

echo ""
echo "=== version B (robust), the same six payloads ==="
clear_table "$T_LOG"
replay "whatsapp"
echo "  what the collector saw:"
collected
echo "  what the log table says:"
log_rows

echo ""
echo "Expected: three send attempts from A, two of them to the same question,"
echo "and three payloads it cannot read at all. Three from B, one per distinct"
echo "inbound message, the sticker declined. Replace the predicted numbers in"
echo "results-A-vs-B.md with whatever actually printed above."
