# A vs B — the same source, three runs each

Real runs, 24 October 2026, n8n 2.44.6. Destination tables emptied before each
set. Source verified independently at **355 records**.

## Result

| | Version A (naive) | Version B (robust) |
|---|---|---|
| People collected | **30 of 355 (8%)** | **355 of 355 (100%)** |
| Rows in the table after 3 runs | 90 | 355 |
| Duplicate rows | **60** | **0** |
| Run-log entries for 3 runs | **90** | **3** |
| Every log entry says | `success · 30 records` | `success · 355 records · 4 pages` |
| API requests per run | 1 | 5 |
| Behaviour when data is incomplete | reports success | **refuses to write and fails loudly** |

Version A was never broken in a way anything could detect. It reported success
every run while delivering 8% of the data and quietly tripling its own table.

## What each fix changed

### Pagination, and asking for bigger pages

A makes one request and treats the first page as the whole data set. B paginates
and asks for `per_page=100` instead of accepting the default 30, so the full set
costs **4 requests instead of 12**.

The provider allows 60 requests per hour unauthenticated. At 5 requests per run
including the probe, B can run twelve times an hour. A, at 1 request per run,
was cheaper and wrong.

### Verifying the count against the source

B spends one extra request before fetching anything: it asks for the data with
`per_page=1` and reads the `Link` header, where the last page number **is** the
record count. That gives an expected total that does not come from the same
call being verified.

Then it asserts. If fetched is short of expected, nothing is written to the
destination and the run ends in a visible error.

This is the fix that matters. Every other change still leaves you trusting that
the sync is healthy because nothing errored — and it was never erroring.

### Reconciling instead of inserting

A inserts. Three runs, 90 rows, 30 people. B upserts on the login, so the third
run leaves the table exactly as the first did: 355 rows, 355 people.

### `executeOnce` on the logging step

A's logging node sits downstream of a multi-item node, so it runs once per
record: three runs produced 90 log rows, each claiming success.

B sets `executeOnce: true` on the same node. Three runs, three rows.

This is a one-property fix for the most misleading artifact in the system, and
n8n documents the property for exactly this purpose — "report construction,
rankings, summaries, or final one-message posts that should run once" — in a
guardrails file shipped inside the package itself.

## The part worth reading twice

While verifying B's results, the verification itself was silently truncated.

The check asked n8n's API for the destination rows with `limit=500`. The API
caps that at 250, returned 250 rows and a `nextCursor`, and raised nothing. The
first reading of this comparison therefore said **250 rows** — a number that is
wrong, looks plausible, and would have gone into this document as fact.

Reading the rows with the cursor gives the real answer: 355.

So the failure this case study is about happened to the case study, during the
step whose entire job was to be sure. It was caught for one reason: 250 is a
suspiciously round number next to an expected 355, and the number had an
independent source to be checked against.

That is the whole argument, demonstrated at our own expense:

> **A count you did not check against an independent source is not a
> measurement. It is a number that happens to be in front of you.**

Nothing about `limit=500` returning 250 is a bug in n8n. The cursor was right
there in the response. It is simply what every paginated API does, and what
version A never asked about.

## Reproducing this

```bash
docker compose up -d
# import both workflows, create the two data tables, publish
bash cases/case-02-api-sync/fixtures/run-both.sh
```

The source count, independent of either workflow:

```bash
curl -sSI "https://api.github.com/repos/n8n-io/n8n-docs/contributors?per_page=1" | grep -i '^link'
# the page number in rel="last" is the record count
```
