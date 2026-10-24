#!/usr/bin/env bash
# Runs both versions of the sync three times each and prints what landed.
#
#   ./run-both.sh [n8n-base-url]
#
# Needs N8N_API_KEY in the environment to read the destination tables, and the
# two data table ids below. Both workflows must be imported and published.
#
# The read loop here paginates on purpose: n8n's API caps `limit` at 250 and
# returns a cursor without warning. Asking for 500 and trusting the answer is
# exactly the bug this case is about, and it is how the first draft of the
# results got a wrong number.

set -u
BASE="${1:-http://localhost:5678}"
T_CONTRIB="${T_CONTRIB:-REPLACE_WITH_YOUR_CONTRIBUTORS_TABLE_ID}"
T_RUNS="${T_RUNS:-REPLACE_WITH_YOUR_SYNC_RUNS_TABLE_ID}"

if [ -z "${N8N_API_KEY:-}" ]; then
  echo "set N8N_API_KEY first" >&2
  exit 1
fi

clear_table() {
  curl -sS -X DELETE -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$BASE/api/v1/data-tables/$1/rows/clear" -o /dev/null
}

report() {
  node -e '
  (async () => {
    const [base, key, tc, tr, label] = process.argv.slice(1);
    const readAll = async (id) => {
      let all = [], cursor = null;
      do {
        const u = base + "/api/v1/data-tables/" + id + "/rows?limit=250" +
          (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
        const d = await (await fetch(u, { headers: { "X-N8N-API-KEY": key } })).json();
        all = all.concat(d.data || []);
        cursor = d.nextCursor || null;
      } while (cursor);
      return all;
    };
    const people = await readAll(tc);
    const runs = await readAll(tr);
    const distinct = new Set(people.map((r) => r.login)).size;
    console.log("  " + label);
    console.log("    destination: " + people.length + " rows / " + distinct +
      " people / " + (people.length - distinct) + " duplicates");
    console.log("    run log:     " + runs.length + " entries");
    for (const r of runs.slice(0, 4)) {
      console.log("       " + String(r.records_fetched).padStart(4) + " records, " +
        r.pages_fetched + " page(s), " + r.status + " - " + r.note);
    }
  })();
  ' "$BASE" "$N8N_API_KEY" "$T_CONTRIB" "$T_RUNS" "$1"
}

echo "=== version A (naive), three runs ==="
clear_table "$T_CONTRIB"; clear_table "$T_RUNS"
for i in 1 2 3; do
  curl -sS -X POST "$BASE/webhook/sync-contributors-naive" \
    -H 'Content-Type: application/json' -d '{}' -o /dev/null -w "  run $i: HTTP %{http_code}\n"
done
report "after three naive runs:"

echo ""
echo "=== version B (robust), three runs ==="
clear_table "$T_CONTRIB"; clear_table "$T_RUNS"
for i in 1 2 3; do
  curl -sS -X POST "$BASE/webhook/sync-contributors" \
    -H 'Content-Type: application/json' -d '{}' -o /dev/null -w "  run $i: HTTP %{http_code}\n" --max-time 180
done
report "after three robust runs:"

echo ""
echo "source of truth, independent of both workflows:"
curl -sSI "https://api.github.com/repos/n8n-io/n8n-docs/contributors?per_page=1" \
  | grep -i '^link' | grep -o 'page=[0-9]*>; rel="last"' | sed 's/^/  /'
