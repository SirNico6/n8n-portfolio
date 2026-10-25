# A vs B — six payloads, one pass each

**Nothing here has been run yet. Every number in this document is a
prediction.** It was written on 24 October 2026 by reading
`workflow-A-naive.json` and `workflow-B-robust.json` against the six fixtures,
before either workflow was executed. The point of writing it first is that the
run can contradict it.

When `fixtures/run-both.sh` has been executed, the measured numbers replace
these and this warning comes out. Until then, treat the table as an argument
about code, not a result.

One thing stronger than reading was done, and it is worth being exact about
what it covers. The JavaScript inside both versions' Code nodes was extracted
from the workflow files and run against all six fixtures outside n8n, with the
IF and dedupe nodes stood in for by equivalent conditions. That is where the
send counts and the two `TypeError` messages below come from. It says nothing
about the webhook response codes, the HTTP node, the retry behaviour, the
dedupe node's own store or the data table writes, all of which are n8n and
none of which has been exercised. So: the arithmetic has been checked, the
workflow has not been run.

## Expected result

Six payloads replayed once each against each version. Both versions point at
the local collector, so a "send attempt" is a request the workflow made to
what it believes is Meta.

| | Version A (expected) | Version B (expected) |
|---|---|---|
| Send attempts | **3** | **3** |
| Replies to the same customer question | **2** | **1** |
| Payloads answered HTTP 200 | 3 of 6 | **6 of 6** |
| Payloads answered HTTP 500 | **3 of 6** | 0 |
| Delivery receipts handled without an error | **0 of 2** | 2 of 2 |
| Inbound types other than text handled | **0** | declined explicitly |
| Response time Meta sees on an accepted payload | **~3 s** | immediate |
| Log rows written | 3, every one `sent` | 6: 3 `accepted`, 3 `sent` |

## Expected result, payload by payload

### Version A

| Fixture | HTTP | Send attempts | Why |
|---|---|---|---|
| `01-inbound-text` | 200 after ~3 s | 1 | Works. The connection is held through the think step before Meta gets its 200 |
| `02-same-message-retry` | 200 after ~3 s | **1** | Same `messages[0].id` as `01`, no dedupe. **The customer is answered twice** |
| `03-status-sent` | **500** | 0 | `value.messages[0]` on a payload with no `messages` array. `TypeError: Cannot read properties of undefined (reading '0')`, node fails, webhook returns 500 |
| `04-status-delivered` | **500** | 0 | Same |
| `05-inbound-second` | 200 after ~3 s | 1 | Works |
| `06-inbound-sticker` | **500** | **0** | `message.text.body` on a message with no `text` field. `TypeError: Cannot read properties of undefined (reading 'body')`. **The customer is never answered** |
| | | **3 total** | 2 of them to the same question |

### Version B

| Fixture | HTTP | Send attempts | Why |
|---|---|---|---|
| `01-inbound-text` | 200 immediately | 1 | `onReceived` answers Meta first. New message id, replies once |
| `02-same-message-retry` | 200 immediately | **0** | `removeDuplicates` has seen the id. Dropped before a reply is composed |
| `03-status-sent` | 200 immediately | 0 | No `messages` array, so the ignore branch records `status callback: sent` |
| `04-status-delivered` | 200 immediately | 0 | Same, `delivered` |
| `05-inbound-second` | 200 immediately | 1 | New id, replies once |
| `06-inbound-sticker` | 200 immediately | 1 | Normalised, `supported: false`, declined with a reply saying only text is read |
| | | **3 total** | one per distinct inbound message |

Both versions attempt three sends. The number is the same and means something
different: A's three are two answers and one duplicate, with a customer left
unanswered. B's three are three distinct customers, one of them told plainly
that a sticker cannot be handled.

## What the single pass understates

The replay delivers each payload once. Meta does not.

A returns 500 on three of the six, so in real operation Meta puts all three
back on its retry schedule, immediately and then at decreasing frequency over
the next 36 hours. Every retry of the sticker crashes again. Every retry of a
delivery receipt crashes again. The execution list fills with errors that have
nothing to do with any customer.

A also holds Meta's delivery open for the duration of the think step plus the
send. Meta's documentation requires a prompt 200 and does not publish the
deadline as a number, so whether a given 3-second response is counted as
failed is not something that can be asserted here. What can be asserted: a
response that is counted as failed is retried, a retry is another inbound
message, and A has nothing that would notice.

So `02-same-message-retry` is not an exaggeration. It is one retry, which is
the smallest number Meta's documented behaviour produces.

## What each fix changed

### `responseMode: onReceived`

A uses `lastNode`, so the reply path runs inside Meta's request. B answers 200
with no body before any work starts.

One property. It is the fix that keeps the other failures from compounding,
because it takes A's slow response off the retry schedule entirely.

### The guard is on the array, not on `field`

Both kinds of payload arrive with `field: "messages"`. B's first IF asks
whether `value.messages` is a non-empty array. A asks nothing and indexes
into it.

### `removeDuplicates`, keyed on `message_id`

`removeItemsSeenInPreviousExecutions` with `removeItemsWithAlreadySeenKeyValues`,
keyed on Meta's `messages[0].id`, scoped to the workflow with a 10,000-entry
history.

The key is the only correct one available: Meta's retry is byte-identical to
the original, so a hash of the payload or a timestamp would work equally well
by accident, and the message id works on purpose.

### Normalise first

B's normaliser reads text from `text.body`, `button.text`,
`interactive.button_reply.title` or `interactive.list_reply.title`, whichever
is present, strips control characters, and sets `supported`. A reads
`message.text.body` and nothing else.

### Retry and dead-letter the send

`retryOnFail`, three tries, one second apart, with an error output that writes
the undelivered reply to the log table as `send_failed` with the error
message. A has neither, and its log step is downstream of the send, so a
failed send loses the reply and the record of it.

### Two log rows, not one

B logs on acceptance and again on delivery. A logs once, after the send,
always as `sent` — so every row in A's log is a success by construction, which
is the same thing that made case 02's run log worthless.

## What would falsify this document

Worth stating before the run, since it is cheap now and expensive later:

- If A's send attempts come out at anything other than 3, the reading of its
  crash paths is wrong.
- If B's come out at anything other than 3, either the dedupe node is not
  keyed where this document says, or the sticker is not reaching the decline.
- If B shows a send for `02`, the dedupe store had been cleared or the scope
  is not the workflow.
- If B shows **no** sends at all, the dedupe store is carrying ids from an
  earlier pass. It survives runs, and clearing the log table does not clear
  it.

## Reproducing this

```bash
# one terminal
node cases/case-03-whatsapp-agent/fixtures/collector.js

# another, with both workflows imported, published, and api_base pointed at
# the collector
T_LOG=<table-id> N8N_API_KEY=<key> \
  bash cases/case-03-whatsapp-agent/fixtures/run-both.sh
```

No Meta credentials are involved. The collector stands in for the send
endpoint and answers everything 200.
