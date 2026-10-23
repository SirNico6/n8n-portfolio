# Case 01 — Lead capture that loses nothing

A web form sends leads into a CRM and notifies the sales team. Four nodes. It is
the most requested flow there is, and the one that fails most quietly.

## The problem, in business terms

A contact form that "works" can be losing one lead in four without anyone
noticing.

It does not fail visibly. It fails like this: somebody copies and pastes their
email and drags a space along with it. The CRM rejects it. The workflow returns
a generic error. The visitor sees "something went wrong", leaves, and nobody
ever hears from that person again. No record is kept, no alert fires, there is
nothing to review.

If the form takes ten leads a day and two come in badly typed, that is two
potential customers a day the sales team never sees. The visible symptom is zero.

**That is why this case is not sold by showing a diagram.** It is sold by showing
the table of what went in and what survived.

## What is here

| File | What it is |
|---|---|
| [`workflow-A-naive.json`](workflow-A-naive.json) | The tutorial version. Four nodes, happy path. **Deliberately wrong** |
| [`workflow-B-robust.json`](workflow-B-robust.json) | Same business outcome, holding up against reality |
| [`workflow-error-handler.json`](workflow-error-handler.json) | The net under the net: catches what no explicit handling anticipated |
| [`fixtures/`](fixtures/) | Eight payloads exercising every branch. The script for the demo |
| [`version-A-failures.md`](version-A-failures.md) | How A fails, measured |
| [`results-A-vs-B.md`](results-A-vs-B.md) | Both versions against the same eight payloads |
| [`demo-script.md`](demo-script.md) | Minute-by-minute script for the video |
| [`client-handover.md`](client-handover.md) | The document a real client receives |
| [`test-normalization.js`](test-normalization.js) | Tests the logic without starting n8n |

## The result, measured

| Fixture | Version A | Version B |
|---|---|---|
| Valid | `200` created | `202` created |
| Email with `@@` | **`500` generic** | `400` `invalid email: "diego.pereyra@@example"` |
| Email with whitespace | **`500`, lead lost** | `202` normalized and created |
| No email | **`500` generic** | `400` `missing required field: email` |
| Exact duplicate | `200`, notifies twice | `202`, deduplicated |
| Badly typed duplicate | **`500`, lead lost** | `202`, deduplicated |
| HTML/SQL injection | **`500`, lead lost** | `202`, blocked but **kept for replay** |
| 1 MB payload | **`500` generic** | `400` `payload too large: 1048791 bytes` |

Six out of eight against zero out of eight.

## The decisions, and why

### Normalize before validating, not after

The order looks like a detail and it is the whole case.

`  Marta.Figueroa@EXAMPLE.com  ` and `marta.figueroa@example.com` are the same
person. Validate before trimming and you reject a real person. Deduplicate
before trimming and you load them twice.

A single `.trim().toLowerCase()` turns two failures into two successes. Two calls.

### The CRM already dedupes, and that is part of the problem

HubSpot has no "create contact" operation: only *upsert* by email. It dedupes on
its own. That sounds like the problem does not exist, which is exactly what makes
it invisible:

- Deduplication is **on the exact string**. An email with a space is a different
  person to the CRM.
- It dedupes the contact, **not the side effects**. The team notification fires
  twice anyway, and somebody calls the same lead twice.
- Upsert **overwrites silently**: a second submission with empty fields wipes
  what was there.

Details in [`kb/gotchas/hubspot.md`](../../kb/gotchas/hubspot.md).

### The visitor never waits on the CRM

Version A only responds once HubSpot has answered. If the CRM is slow, the form
hangs and the person presses Submit again. That is where the duplicate is born.
If the CRM is down, the person sees an error that is not theirs.

Version B responds `202` as soon as the payload is valid and keeps processing
afterwards. That forces the other half: a `202` without a replay queue is a lie.
See [`kb/patterns/decoupled-response.md`](../../kb/patterns/decoupled-response.md).

### Sanitizing is not censoring

The injection payload **still fails in version B**, on purpose.

What executes gets neutralized: HTML tags, and spreadsheet formulas — a field
starting with `=` is evaluated when the file is opened. User text does not get
deleted. Filtering "dangerous words" breaks any O'Brien or D'Angelo, which are
legitimate surnames.

The result: the CRM's WAF blocks it anyway. But in A the lead evaporated, and in
B it sits in the queue with the full payload and a link to the execution.
**That is what robust means: not that nothing fails, but that nothing is lost.**

### The replay queue needs no extra account

It uses n8n 2.x native *data tables*. No external credentials.

If the client needs to look at the queue without going into n8n, the same
pattern works against Google Sheets or Airtable with nothing else changed. The
question that decides it is who is going to be looking at it.

## Reproducing it

Requirements and starting n8n: [repo README](../../README.md).

**1. HubSpot credential.** Free account → *Development → Keys → Service Keys* →
create one with `crm.objects.contacts.read` and `crm.objects.contacts.write`,
nothing else. In n8n, an **App Token** credential.

> HubSpot discontinued *private apps*: a new account can only create *service
> keys*. It is the same Bearer token and goes in the same field. Every piece of
> documentation you will find still points at the old path.

**2. The queue table.**

```bash
curl -X POST "http://localhost:5678/api/v1/data-tables" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"lead_dead_letter","columns":[
        {"name":"received_at","type":"string"},{"name":"email","type":"string"},
        {"name":"payload","type":"string"},{"name":"error_message","type":"string"},
        {"name":"error_node","type":"string"},{"name":"execution_id","type":"string"},
        {"name":"workflow_name","type":"string"}]}'
```

Put the returned `id` in place of `REPLACE_WITH_YOUR_DATA_TABLE_ID` in the
*Save to dead letter queue* node of B and the *Log the failure* node of the error
handler. Same for `REPLACE_WITH_YOUR_CHAT_ID` in the Telegram nodes.

**3. Import and publish** the three workflows. The error handler goes first: n8n
will not let you select an unpublished workflow as an error workflow.

**4. Fire the fixtures.**

```bash
bash fixtures/send.sh http://localhost:5678/webhook/lead-intake-naive   # version A
bash fixtures/send.sh http://localhost:5678/webhook/lead-intake         # version B
```

Order matters: `05` and `05b` are duplicates of `01`, so `01` has to have gone
through first for deduplication to have anything to compare against.

## Known limitations

Stated up front, because a deliverable that hides them is not honest:

- **Phone numbers without an international prefix.** A foreign number without `+`
  gets the default country code and ends up with a valid shape and the wrong
  value. That is fixed in the form, not in the workflow. See
  [`kb/snippets/phone-e164.js`](../../kb/snippets/phone-e164.js).
- **Deduplication is on the email.** Two different people sharing a company inbox
  merge into one contact. Deduplicating on email + phone means changing the key.
- **Deduplication history lives in the workflow.** Delete the workflow and it is
  gone. For long retention it belongs in a table.
- **Credentials are per instance.** Bringing the repo up on a new machine imports
  the workflows but not the credentials: the HubSpot service key and the Telegram
  token have to be added again. That is by design — credentials never travel in
  the repo.
