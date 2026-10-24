# n8n automation portfolio

n8n workflows that survive the real world: input validation, deduplication,
retries, dead letter queues and error handling.

Every case is built twice:

- **A (naive)** — what you get from following a tutorial. Works in the happy-path demo.
- **B (robust)** — same business outcome, holding up against what actually happens.

Then both are measured against the same payloads. The value isn't in the
diagram. It's in the results table.

## Cases

| Case | What it solves | Status |
|---|---|---|
| [case-01 · lead intake](cases/case-01-lead-intake/) | Capturing web form leads into a CRM without losing any | Running and measured |
| [case-02 · API sync](cases/case-02-api-sync/) | A scheduled sync that reports success while delivering 8% of the data | Running and measured |

## The results, in one line each

**Case 01 — the loud failure.** The same eight realistic payloads against both
versions: the naive one ends six of eight in a generic `HTTP 500` and the lead
disappears without a trace. The hardened one returns no `500` at all, names the
field and the reason on every rejection, and keeps whatever still fails in a
replay queue.
[Full breakdown](cases/case-01-lead-intake/results-A-vs-B.md).

**Case 02 — the silent one.** A sync that never failed and never collected more
than 8% of its data: 30 of 355 records, 60 duplicate rows in three runs, and 90
log entries all reading success. The fixed version collects 355 of 355 and
refuses to write when it cannot verify that.
[Full breakdown](cases/case-02-api-sync/results-A-vs-B.md) ·
[the diagnosis a client receives](cases/case-02-api-sync/diagnosis/diagnosis-report.md).

Case 02 also opens with a measurement of the 40 most popular public n8n
templates: four have any retry configured, none has an error workflow, and of
the 23 that call an API, one handles pagination.

## Running it

### Requirements

- Docker, **or** Node 24+ (n8n 2.44.6 requires `node >=24.0.0`)
- A free HubSpot account
- A Telegram bot (optional — notifications only)

### With Docker

```bash
cp .env.example .env
# fill in N8N_ENCRYPTION_KEY with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
docker compose up -d
```

Verified on 23 Oct 2026 against Docker 29.9.2 on WSL2: the image pulls, the
container starts, `/healthz` returns `200`, the `.env` variables reach the
container and the `cases/` volume mounts. All three workflows import over the
API and the validation path returns the same status codes as the Node install.

### With Node

```bash
npm install -g n8n@2.44.6
cp .env.example .env
# fill in N8N_ENCRYPTION_KEY as above
set -a && . ./.env && set +a && n8n start
```

n8n comes up at `http://localhost:5678`. First launch asks you to create an
owner account; it is local and never leaves your machine.

### Importing the workflows

From the n8n UI, or over the API with a key created under
*Settings → n8n API*:

```bash
curl -X POST "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  --data-binary @cases/case-01-lead-intake/workflow-B-robust.json
```

Case 01 has its own [README](cases/case-01-lead-intake/README.md) with the full
walkthrough, including credentials and the replay queue table.

## Verifying without running anything

The normalization and validation logic is tested without n8n:

```bash
node cases/case-01-lead-intake/test-normalization.js
node kb/snippets/sanitize-text.js
node kb/snippets/phone-e164.js
```

The first one reads the code straight out of the workflow JSON, so it cannot
drift out of sync with the workflow it is testing.

## Layout

```
cases/      One directory per case: workflows, fixtures, measured results, demo
kb/         Reusable knowledge: patterns, per-service gotchas, snippets
```

The [knowledge base](kb/README.md) is the real asset. Its gotchas come from
breaking things and reading the error, not from reading documentation — for
example, that HubSpot trims whitespace out of its own error messages, so it
shows you an email that looks perfectly valid and tells you it is invalid.

## Where to start

The [case README](cases/case-01-lead-intake/README.md) explains the problem and
the decisions. [results-A-vs-B.md](cases/case-01-lead-intake/results-A-vs-B.md)
is the measured comparison. The
[client handover document](cases/case-01-lead-intake/client-handover.md) is what
a real client receives at the end of a job.

## What this is not

Not a product, and not a template to sell. It is material to show how the work
is built and how it is handed over. The workflows are meant to be read and
argued with, not installed blindly.
