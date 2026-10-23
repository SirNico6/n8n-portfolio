# Version A (naive) — how it fails, measured

Real run against n8n 2.44.6 and a free HubSpot account, 23 Oct 2026. Workflow
published, Telegram node disabled to isolate the CRM's behaviour. All eight
payloads came straight out of `fixtures/` unmodified.

## Result

| Fixture | HTTP | What actually happened |
|---|---|---|
| `01-valid` | 200 | Contact created. `vid 257397661819` |
| `02-invalid-email` | **500** | HubSpot: *Email address diego.pereyra@@example is invalid* |
| `03-messy-phone` | **500** | Rejected because of the **whitespace in the email**, not the phone |
| `04-missing-fields` | **500** | *Email address null is invalid* |
| `05-exact-duplicate` | 200 | Same `vid 257397661819`: HubSpot deduplicated |
| `05b-dirty-duplicate` | **500** | Rejected. **It did not create a duplicate: it lost the lead** |
| `06-injection` | **500** | *Forbidden - perhaps check your credentials?* plus a Cloudflare HTML page |
| `07-oversized-payload` | **500** | *Bad request* / *Property values were not valid* |

**Six out of eight submissions end in HTTP `500` with the body
`{"message":"Error in workflow"}`.** The visitor sees a generic error. The lead
is not recorded anywhere. There is no way to know what came in or to replay it.

## The three things this demonstrates

### 1. The lead disappears and nobody finds out

It is not stored badly: it is not stored at all. What the visitor typed stops
existing the moment HubSpot returns a 400. No log with the payload, no replay
queue, no alert. If the form takes ten leads a day and two have an extra space
in the email, that is two potential customers a day the sales team never sees,
with no visible symptom.

### 2. The error messages send you to diagnose the wrong place

Two of the eight cases have actively misleading errors:

- **`03` and `05b`:** the email sent is `  LUCIA.BENITEZ@Example.COM  ` (with
  whitespace). HubSpot replies *"Email address LUCIA.BENITEZ@Example.COM is
  invalid"* — **without the whitespace**. The message shows an email that looks
  valid and declares it invalid. The space, which is the cause, appears nowhere.

- **`06`:** the payload with `<script>` and SQL is not rejected by HubSpot, it is
  blocked by **Cloudflare** at the edge. The error reaching n8n is *"Forbidden -
  perhaps check your credentials?"* with an HTML body. The credential is
  perfectly fine. Whoever debugs this will check the API key first, and the API
  key has nothing to do with it.

This matters commercially: the client who calls because "the automation is
broken" has already burned hours following these false trails.

### 3. The CRM's deduplication is not enough

`05` confirms HubSpot deduplicates: the exact duplicate returned the same `vid`
and did not create a second contact. That sounds reassuring, and it is
deceptive.

What the CRM's deduplication does **not** cover:

- Side effects. In the full version every submission fires the team
  notification. Two submissions, two alerts, two calls to the same lead.
- Upsert overwrites silently: the second submission updates the existing
  contact. If it comes in with empty fields, what was there is lost.
- `05b` shows the real limit: with the dirty email, HubSpot never even gets to
  deduplicate. It rejects. And the lead is lost.

## What version B has to solve

Derived from what was measured, not from a theoretical list:

1. **Normalize before validating.** Trim whitespace and lowercase the email.
   That alone turns `03` and `05b` from a 500 into a success.
2. **Validate before calling the CRM.** `02` and `04` have no business consuming
   an API call: they get rejected at the edge with a `400` and a body naming the
   offending field.
3. **Sanitize the content.** `06` should never leave for HubSpot with that
   payload.
4. **Cap the size.** `07` gets cut before the call.
5. **Deduplicate on the normalized email**, and deduplicate the side effects, not
   just the write.
6. **Dead letter queue.** Whatever still fails after retries has to be recorded
   with its payload, error and timestamp, ready for replay.
7. **Decouple the response.** The visitor gets a `200`-class response as soon as
   the payload is valid, without waiting for HubSpot.
8. **A separate error workflow** that alerts with workflow, node, message and a
   link to the execution.

## How to reproduce

```bash
docker compose up -d                 # or: n8n start
# import cases/case-01-lead-intake/workflow-A-naive.json
# add the HubSpot credential (App Token, a pat- service key)
# publish the workflow
bash cases/case-01-lead-intake/fixtures/send.sh \
  http://localhost:5678/webhook/lead-intake-naive
```
