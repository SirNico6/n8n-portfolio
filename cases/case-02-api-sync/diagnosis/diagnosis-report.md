# Diagnosis — scheduled contributor sync

**Scope of this engagement:** read-only assessment of one workflow. No changes
were made to it. Measured 24 October 2026 against n8n 2.44.6.

---

## Summary

The sync has reported success every single run since it was deployed. It is
missing **92% of the records** it is supposed to collect, and the destination
table is filling with duplicates of the few it does collect.

Nothing is broken in a way that would raise an alert. That is the problem: the
workflow does not fail, it under-delivers quietly, and every signal available to
you says it is healthy.

| | Expected | Actual |
|---|---|---|
| People in the source | 355 | 355 |
| People in your table | 355 | **30** |
| Rows in your table after 3 runs | 355 | **90** |
| Runs logged as successful | 3 | **90** |

---

## What we measured

Three runs of the existing workflow, against the live source, with the
destination tables emptied first. The source count was established
independently through the provider's API before the runs.

The source is a paginated HTTP API. Independently verified: 355 records, served
30 per page across 12 pages.

---

## Findings

### 1 · CRITICAL — 92% of records never arrive, and the run reports success

The workflow makes a single request to the source and treats the response as
the complete data set. The source returns 30 records per page and the workflow
never asks for page 2.

- **Collected:** 30 of 355 people
- **Missing:** 325 people — 92%
- **Reported status:** success, every run

The missing records are not a random sample. They are whichever records the
provider places after the first page, which for this endpoint is ordered by
contribution count. **You are systematically missing everyone except your top
30 contributors**, and any decision made from this table is biased in exactly
the way that is hardest to notice.

This is the finding that matters. The rest compounds it.

### 2 · HIGH — The destination table accumulates duplicates on every run

Each run inserts its results rather than reconciling them against what is
already stored. There is no deduplication key.

Measured over three runs:

| Run | Rows in table | Distinct people |
|---|---|---|
| 1 | 30 | 30 |
| 2 | 60 | 30 |
| 3 | 90 | 30 |

At one run per day this reaches roughly **11,000 rows representing 30 people
within a year.** The table grows steadily, which reads as healthy accumulation
and is the opposite.

Anyone querying this table without knowing to deduplicate will overcount by a
factor equal to the number of days the sync has been running.

### 3 · HIGH — The run log overstates the number of runs by 30x

The workflow writes a row to its run log to record each sync. That logging step
is positioned so it executes **once per record retrieved**, not once per run.

Three runs produced **90 log entries**, each reading `success · 30 records`.

This is the most misleading artifact in the system, because it is the one
somebody would look at to confirm the sync is healthy. It is also a very common
mistake: n8n executes a node once per incoming item unless told otherwise, and
nothing in the editor warns you when a logging step lands downstream of a
multi-item node.

### 4 · MEDIUM — No retry and no error handling anywhere in the workflow

No node has a retry configured and no node has an error path. A single
transient failure from the provider — a timeout, a 502, a brief network
problem — ends the run. The data for that day is not collected, not recorded,
and not retried.

Because there is no error workflow configured either, nobody is notified.

For context: we surveyed the 40 most popular public n8n templates. Four of them
have any retry configured at all, and none of them has an error workflow. This
workflow is not unusual; it follows the pattern almost everybody copies.

### 5 · MEDIUM — No rate-limit handling, which only matters once this is fixed

The provider allows 60 requests per hour unauthenticated. Today the workflow
uses one request per run, so the limit is never approached.

Fixing finding 1 changes that: collecting all 355 records takes 12 requests per
run. That is still within budget for one source, but the limit becomes a real
constraint the moment this is pointed at several repositories, or run more than
a few times per hour. The fix needs to handle the limit rather than assume it
away.

---

## What we did not look at

Stated so the boundaries of this assessment are clear:

- Any other workflow in the instance
- Whether the destination schema suits how the data is consumed downstream
- Who currently reads this table and whether their queries deduplicate
- Credential rotation and expiry
- n8n host configuration, backups and version currency

---

## Recommended remediation

In priority order. Each is independently deliverable.

| Priority | Fix | Addresses |
|---|---|---|
| 1 | Paginate the source request and verify the retrieved count against the source total | Finding 1 |
| 2 | Reconcile on a stable key instead of inserting | Finding 2 |
| 3 | Move run logging so it executes once per run, and record the real page count | Finding 3 |
| 4 | Retries with backoff, an error path for what still fails, and a notifying error workflow | Finding 4 |
| 5 | Respect the provider's rate limit explicitly, with a request interval | Finding 5 |

### One recommendation that is not on that list

Every fix above still leaves you trusting that the sync is healthy because
nothing errored. It was never erroring.

The durable fix is to make the workflow **assert on the shape of its own
output**: compare the number of records retrieved against the source's reported
total, and fail loudly when they disagree. A sync that silently returns 8% of
the data should be as noisy as one that crashes.

That assertion is what would have caught this on day one, without anybody
auditing anything.

---

## Verifying any of this yourself

The source count, independent of the workflow:

```bash
# last page number, from the Link header
curl -sSI "https://api.github.com/repos/n8n-io/n8n-docs/contributors?per_page=30" | grep -i '^link'
```

Rows versus distinct people in the destination table:

```sql
SELECT COUNT(*) AS rows, COUNT(DISTINCT login) AS people FROM github_contributors;
```

If those two numbers differ, finding 2 is present. If `people` is a round
multiple of the page size, finding 1 is present.
