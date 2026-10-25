# Fixtures

Six webhook payloads in the shape Meta's Cloud API actually delivers, plus the
collector that stands in for Meta's send endpoint and the script that replays
them.

Every payload has `object`, `entry[].changes[].value` and `field: "messages"`,
because that is what Meta sends. Ids are placeholders and both phone numbers
are in the `+1 555` range, which cannot belong to anyone.

The message bodies are in Spanish. The end users of this agent write Spanish;
the payloads are evidence, not documentation.

## What each one is

| File | What it is | Version A does | Version B does |
|---|---|---|---|
| [`01-inbound-text.json`](01-inbound-text.json) | A customer asking about pricing | Replies, after holding the connection open for the 3-second think step | Answers 200 on receipt, then replies once |
| [`02-same-message-retry.json`](02-same-message-retry.json) | Byte-identical to 01, same `messages[0].id`. This is Meta's retry of the same event, not a second question | Replies again. The customer gets the same answer twice | Recognises the message id and sends nothing |
| [`03-status-sent.json`](03-status-sent.json) | A delivery receipt, `statuses[0].status = "sent"` | Crashes reading `value.messages[0]`, returns 500 | Sees no `messages` array, takes the ignore branch, sends nothing |
| [`04-status-delivered.json`](04-status-delivered.json) | A delivery receipt, `status = "delivered"` | Crashes the same way, returns 500 | Ignored the same way |
| [`05-inbound-second.json`](05-inbound-second.json) | A genuinely different question, different `id` | Replies | Replies once |
| [`06-inbound-sticker.json`](06-inbound-sticker.json) | An inbound `type: "sticker"` with no `text` field at all | Crashes reading `message.text.body`, returns 500. Meta then retries this for 36 hours and every retry crashes again, so the customer is never answered | Normalises it, marks it unsupported, and replies that it only reads text |

`01` and `02` are byte-identical on purpose. `cmp 01-inbound-text.json
02-same-message-retry.json` confirms it. Meta's retry is the same payload,
including the message id, which is the only thing that makes deduplication
possible.

The two status payloads carry no `contacts` array. Meta does not send one with
a delivery receipt, and a workflow that assumes `contacts[0]` is always there
has a second bug waiting behind the first.

## The collector

[`collector.js`](collector.js) answers every request 200 with a plausible
Cloud API send response and counts what it was asked to send. It needs no
dependencies and no Meta account.

```bash
node collector.js            # listens on 8099
node collector.js --help
curl -s localhost:8099/__stats
```

Counting what a workflow *tried* to send is the whole measurement. Pointing
the workflow at a local server instead of Meta removes the token, the
recipient allowlist and the 24-hour expiry from the comparison, and lets
anybody reproduce it.

## The runner

[`run-both.sh`](run-both.sh) replays all six against each version's webhook in
turn and prints what the collector counted plus what landed in the log table.
Read its header first: both workflows have to be imported and **published**,
and each `Config` node's `api_base` has to point at the collector.
