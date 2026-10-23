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
| [case-01 · lead intake](casos/caso-01-lead-intake/) | Capturing web form leads into a CRM without losing any | Running and measured |

## Case 01 result, in one line

The same eight payloads against both versions:

- **A:** six out of eight end in a generic `HTTP 500`. The lead disappears with no trace.
- **B:** no `500` at all. Every rejection names the field and the reason, and whatever still fails lands in a replay queue.

Full breakdown: [resultados-A-vs-B.md](casos/caso-01-lead-intake/resultados-A-vs-B.md).

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
container and the `casos/` volume mounts. All three workflows import over the
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
  --data-binary @casos/caso-01-lead-intake/workflow-B-robusto.json
```

Case 01 has its own [README](casos/caso-01-lead-intake/README.md) with the full
walkthrough, including credentials and the replay queue table.

## Verifying without running anything

The normalization and validation logic is tested without n8n:

```bash
node casos/caso-01-lead-intake/test-normalizacion.js
node kb/snippets/sanitizar-texto.js
node kb/snippets/telefono-e164.js
```

The first one reads the code straight out of the workflow JSON, so it cannot
drift out of sync with the workflow it is testing.

## Layout

```
casos/      One directory per case: workflows, fixtures, measured results, demo
kb/         Reusable knowledge: patterns, per-service gotchas, snippets
venta/      Commercial material
```

The [knowledge base](kb/README.md) is the real asset. Its gotchas come from
breaking things and reading the error, not from reading documentation — for
example, that HubSpot trims whitespace out of its own error messages, so it
shows you an email that looks perfectly valid and tells you it is invalid.

## A note on language

Client-facing documents are in English. Internal material — the knowledge base,
the demo script, commercial notes — is in Spanish, which is the working
language here. Start with the case README and the
[client handover document](casos/caso-01-lead-intake/entregable-cliente.md).

## What this is not

Not a product, and not a template to sell. It is material to show how the work
is built and how it is handed over. The workflows are meant to be read and
argued with, not installed blindly.
