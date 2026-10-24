# Case 02 — The sync that never failed

A scheduled job pulls records from an API into a table. It has reported success
every run since it was deployed. It is delivering 8% of the data.

## The problem, in business terms

Case 01 was about a workflow that lost data loudly: an error code, a visitor
seeing "something went wrong". This one is worse, because there is nothing to
see.

The sync runs. It reports success. The destination table grows a little every
day. Every signal available says it is healthy. And it has never once collected
more than the first page of results.

The missing records are not a random sample — they are whichever ones the
provider puts after the first page. Any decision made from that table is biased
in exactly the direction that is hardest to notice.

**This is the failure that error handling cannot catch**, because nothing
errors. Retries do not catch it. A replay queue does not catch it: nothing
failed to be written. Only one thing catches it, and it is in version B.

## What is here

| File | What it is |
|---|---|
| [`workflow-A-naive.json`](workflow-A-naive.json) | The patient. **Deliberately representative**, not copied from any one template |
| [`workflow-B-robust.json`](workflow-B-robust.json) | The same job, measured and asserted |
| [`diagnosis/diagnosis-report.md`](diagnosis/diagnosis-report.md) | **The deliverable a client pays for before any fix** |
| [`results-A-vs-B.md`](results-A-vs-B.md) | Both versions, three runs each, measured |
| [`fixtures/run-both.sh`](fixtures/run-both.sh) | Reproduces the whole comparison |

## The result, measured

Source verified independently at 355 records.

| | Version A | Version B |
|---|---|---|
| People collected | **30 of 355 (8%)** | **355 of 355** |
| Rows after 3 runs | 90 | 355 |
| Duplicates | **60** | **0** |
| Run-log entries for 3 runs | **90** | **3** |
| Requests per run | 1 | 5 |
| When data is incomplete | reports success | refuses to write, fails loudly |

## Why the patient is built rather than borrowed

The honest alternative was to take a real community template and fix it in
public. We did not, for two reasons.

The practical one: every popular template we looked at depends on credentials
for paid services, so nobody cloning this repo could reproduce anything. This
one runs against an endpoint that needs no authentication at all.

The other one: naming somebody's published work as the bad example is a poor
way to introduce yourself.

The evidence for the pattern being widespread does not require either. We
measured the 40 most popular public templates directly:

- **4 of 40** have any retry configured
- **0 of 40** have an error workflow
- of the 23 that call an API, **1** handles pagination

The patient here was built to match that pattern. It is not a strawman; it is
the median.

## The four fixes

### Paginate, and ask for bigger pages

A requests once and treats page one as the whole set. B paginates using the
HTTP node's native support and sets `per_page=100` instead of accepting the
default 30 — **4 requests instead of 12** for the same data.

### Verify the count against an independent source

B spends one extra request asking for the data with `per_page=1` and reading
the `Link` header, where the last page number **is** the record count. That
gives an expected total that did not come from the call being checked.

Then it asserts. Short of expected, nothing is written and the run ends in a
visible error.

**This is the fix that matters.** Every other change still leaves you trusting
that the sync is healthy because nothing errored.

### Reconcile instead of insert

A inserts every time. B upserts on a stable key, so the third run leaves the
table exactly as the first did.

### Log once per run, not once per record

A's logging step sits downstream of a multi-item node, so it runs once per
record: 3 runs wrote 90 entries, each claiming success. B sets
`executeOnce: true` on the same node.

One property, and the single most misleading artifact in the system becomes the
most useful one.

## The part worth reading twice

While verifying version B, the verification itself was silently truncated.

The check asked n8n's API for the destination rows with `limit=500`. The API
caps that at 250, returned 250 rows and a cursor, and warned about nothing. The
first reading of the results said **250 rows** — wrong, plausible, and on its
way into this case study as fact.

It was caught because 250 is a suspiciously round number next to an expected
355, and because an independent expected value existed to compare against.

> **A count you did not check against an independent source is not a
> measurement. It is a number that happens to be in front of you.**

That is the argument of this case, and it cost us to learn it on our own work
rather than a client's.

## Reproducing it

Requirements and starting n8n: [repo README](../../README.md).

1. Create two data tables: `github_contributors` (`login`, `github_id`,
   `contributions`, `synced_at`) and `sync_runs` (`run_at`, `workflow`,
   `records_fetched`, `pages_fetched`, `status`, `note`).
2. Put their ids in place of the `REPLACE_WITH_YOUR_*` placeholders in both
   workflow files.
3. Import and publish both.
4. `T_CONTRIB=<id> T_RUNS=<id> N8N_API_KEY=<key> bash fixtures/run-both.sh`

No credentials are needed for the data source. It is a public endpoint.

## Known limitations

- **The source is unauthenticated, which is a property of today.** GitHub's
  stargazers endpoint required no auth until recently and now returns 401. Any
  workflow depending on public access should say so in its handover as a
  dependency that can be withdrawn.
- **60 requests per hour** unauthenticated. At 5 per run this allows twelve
  runs an hour, which is fine for a daily sync and not fine for a busy one.
  Authenticating raises it to 5,000.
- **The completeness check trusts the provider's own count.** If the provider's
  pagination metadata is wrong, the assertion inherits that. It defends against
  the workflow not asking, which is the common case, not against the source
  lying.
- **Deduplication is on one key.** Two records sharing that key collapse into
  one.
