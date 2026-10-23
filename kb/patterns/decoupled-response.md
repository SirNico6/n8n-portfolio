# Response decoupled from processing

## What problem it solves

The person filling in the form sees an error because an internal system is slow
or down. The CRM is not the visitor's problem.

Measured in case-01: with the response coupled, every HubSpot failure turns into
a `500` in the face of whoever submitted the form. Six out of eight submissions.

And the other way round: if the CRM takes eight seconds, the form hangs for
eight seconds. The visitor presses Submit again. That is where the duplicate is
born.

## When to apply it

Whenever a human or an external system is waiting on the webhook's response. If
the caller is a cron job or an internal queue, you do not need it.

## The pattern

On the Webhook node:

```json
{ "httpMethod": "POST", "path": "lead-intake", "responseMode": "responseNode" }
```

`responseMode: responseNode` lets a **Respond to Webhook** node send the
response, and **execution continues past that node**. That is the key: anything
hanging downstream of the Respond node no longer affects the caller.

Shape:

```
Webhook -> Normalize and validate -> IF valid?
                                      |- yes -> Respond 202 -> dedupe -> CRM -> ...
                                      |- no  -> Respond 400 with detail
```

`202 Accepted` is the correct code, not `200`: it says "I have it and I will
process it", which is exactly what happened. `200` promises it is already done.

The invalid branch answers `400` **before** touching anything, with the reason:

```js
// responseBody of the Respond 400 node
={{ JSON.stringify({ status: "rejected", errors: $json.errors }) }}
```

A `400` that names the field is useful to whoever is integrating. A generic
`500` is useful to nobody.

## The cost, stated up front

Decoupling means the caller gets a `202` and **you do not yet know whether the
CRM accepted it**. That is correct, but it forces the other half:

- If it fails later, it has to go to the dead letter queue. A `202` without a
  DLQ is a lie: you told the visitor you had it and then you lost it.
- Somebody has to watch that queue, or receive an alert.

**This pattern is never implemented alone.** It always ships with
`dead-letter-queue`.

## How to verify it works

Break the external service on purpose (invalid credential, or point the host at
a dead port) and send a valid payload. The webhook must still return `202`, and
the row must appear in the DLQ.

If the webhook returns `500` when the CRM is down, the decoupling is not
working: most likely `responseMode` is still set to `lastNode`.
