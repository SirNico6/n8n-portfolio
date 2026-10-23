# Dead letter queue

## What problem it solves

Whatever fails after the retries disappears. Nobody knows what came in, how
many, why, or how to replay it.

Measured in case-01: the naive version loses six out of eight submissions. The
visitor sees a generic `500` and the data stops existing. If the form takes ten
leads a day and two fail, that is two potential customers a day nobody sees,
with no visible symptom at all.

## When to apply it

In every workflow that writes to an external system. If the service's response
can fail and the input is not stored anywhere else, you need a DLQ.

You do not need one when the source of the data is replayable (a table you can
read again). You do need one when the data arrived by webhook and is ephemeral:
that is any form submission.

## The pattern

On the node that calls the external service:

```json
{
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000,
  "onError": "continueErrorOutput"
}
```

`continueErrorOutput` adds a second output to the node. Output 0 is the happy
path; output 1 receives whatever failed after exhausting the retries. That
output goes to the DLQ.

What to store, at minimum:

| Column | Why |
|---|---|
| `received_at` | To sort, and to know how long it has been stuck |
| `email` (or the business key) | To search without reading the payload |
| `payload` | The original raw data. Without it you cannot replay |
| `error_message` | What the service said |
| `error_node` | Which step failed |
| `execution_id` | To open the full run in n8n |

## Where to store it

In n8n 2.x, **native data tables** (`n8n-nodes-base.dataTable`). No external
credentials, no accounts to create, and it is queryable over the API.

Create the table once:

```bash
curl -X POST "$N8N_API_URL/data-tables" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"lead_dead_letter","columns":[
        {"name":"received_at","type":"string"},
        {"name":"email","type":"string"},
        {"name":"payload","type":"string"},
        {"name":"error_message","type":"string"},
        {"name":"error_node","type":"string"},
        {"name":"execution_id","type":"string"},
        {"name":"workflow_name","type":"string"}]}'
```

Google Sheets or Airtable work just as well and have one advantage: the client
can look at the queue without going into n8n. The downside is one more
credential. For a client deliverable, ask who is going to be watching that queue.

**If the DLQ writes to a spreadsheet, sanitize formulas first.** A field starting
with `=` is evaluated when the file is opened. See `kb/snippets/sanitize-text.js`.

## What a DLQ does not fix

It does not improve a badly worded error from a third party. In case-01 the
stored row reads `Forbidden - perhaps check your credentials?`, which is
misleading: the problem was the WAF, not the credential.

What the DLQ guarantees is that the error is **written down somewhere** instead
of evaporating. Interpreting it is still human work. That is why `payload` is
the most important column in the table: with the original data you can
reconstruct what happened even when the message lies.

## How to verify it works

Force a real failure and watch the row appear:

```bash
curl -X POST "http://localhost:5678/webhook/lead-intake" \
  -H 'Content-Type: application/json' \
  --data-binary @fixtures/06-injection.json

curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_API_URL/data-tables/<id>/rows?limit=5"
```

A DLQ that was never tested against a real failure is not a DLQ: it is a node
nobody has ever executed.
