# Case 03 — The bot that passes its own demo

You message the WhatsApp number. It replies. The demo is over and everything
worked.

None of the three failures in this case can happen during that demo.

## The problem, in business terms

A WhatsApp agent is demonstrated by sending it one message and watching one
reply arrive. That is also the only condition under which a naive one behaves.

Three things are true of the WhatsApp Cloud API, all of them in Meta's own
documentation, all of them invisible in a one-message demo. They were
confirmed against Meta's docs on 24 October 2026.

**Meta delivers the same message more than once.** A webhook delivery that
does not get a prompt 200 is retried immediately and then at decreasing
frequency **over the next 36 hours**. Meta's documentation does not leave this
to be discovered: it states that the receiver **should handle
deduplication**. So the platform tells you in writing that you will be handed
the same customer message again, and a bot with no dedupe answers it again,
and the customer sees the answer twice.

**A delivery receipt looks exactly like a message.** An inbound message and a
delivery receipt both arrive with `field` set to `"messages"`. The only thing
that distinguishes them is which array is present under `value`: `messages`
or `statuses`. A workflow that branches on `field` treats its own delivery
receipts as new inbound questions. The patient here does something slightly
different and worse, and that is in the results.

**The reply is sent on the same connection Meta is waiting on.** A bot that
thinks for three seconds before answering has held Meta's delivery open for
three seconds. Meta is waiting for a 200, not for the reply.

In a demo you send one text message, get one reply, and none of this appears.
It appears in week two, as customers complaining they were answered twice, as
an execution list full of errors nobody ordered, and as a bot that goes silent
whenever someone sends a sticker.

## What is here

| File | What it is |
|---|---|
| [`workflow-A-naive.json`](workflow-A-naive.json) | The patient. **Deliberately representative**, not copied from any one template |
| [`workflow-B-robust.json`](workflow-B-robust.json) | The same agent, with the three documented failures handled |
| [`SETUP.md`](SETUP.md) | Meta app, test number, tunnel, webhook verification |
| [`results-A-vs-B.md`](results-A-vs-B.md) | Per-payload expectations, **predicted, not yet measured** |
| [`fixtures/`](fixtures/README.md) | The six real payload shapes, the collector, the runner |

## The result — expected, not yet measured

**These numbers are predictions. Neither workflow has been run.** The
JavaScript in both versions' Code nodes was extracted and run against the six
fixtures outside n8n, which is where the send counts come from; the webhook
response codes, the HTTP node, the retries, the dedupe store and the table
writes are all n8n and none of them has been exercised. The predictions are
written down before the run on purpose, so that the run can contradict them.
When [`fixtures/run-both.sh`](fixtures/run-both.sh) has been executed, the
measured numbers replace this table and this warning comes out.

Six payloads, one pass each. The reasoning for every row is in
[`results-A-vs-B.md`](results-A-vs-B.md).

| | Version A (expected) | Version B (expected) |
|---|---|---|
| Send attempts for 6 payloads | **3** | **3** |
| Replies to the same customer question | **2** | **1** |
| Payloads that return HTTP 500 | **3 of 6** | **0** |
| Delivery receipts handled without an error | **0 of 2** | 2 of 2 |
| A sticker gets | nothing, ever | a reply saying only text is read |
| Response time Meta sees | held through a 3-second think step | 200 before any work starts |
| Log rows | 3, all `sent` | 6: 3 `accepted`, 3 `sent` |
| Reply that could not be delivered | lost | written to the log as `send_failed` |

Case 02 in this repo has a section on a count that was silently truncated and
very nearly published as a measured fact. The lesson applies in the other
direction here: a prediction dressed up as a finding is the same mistake with
better manners. Until the runner has been executed, every number above is
reasoning about code, not evidence about behaviour.

## Why the patient is built rather than borrowed

Same two reasons as case 02, with one addition specific to this case.

The practical one: every community WhatsApp template depends on a Meta app, a
token and a verified number, so nobody cloning this repo could reproduce
anything. This comparison needs none of them. The payloads are replayed
locally and a local collector counts what each version tried to send.

The other one: naming somebody's published work as the bad example is a poor
way to introduce yourself.

The addition: a borrowed template would not let the three failures be shown
separately. The patient is built so that each fixture isolates exactly one of
them, which is what makes the comparison readable.

Version A is not a strawman. It is the shape a WhatsApp bot takes when it is
built to pass the demo: read the message, think, reply, log it.

## The fixes

### Answer Meta first, work afterwards

A's webhook uses `responseMode: lastNode`, so Meta's delivery stays open
through the 3-second think step and the send call before it gets a 200.

B's uses `responseMode: onReceived` with a 200 and no body. Meta is answered
before anything else happens, and the rest of the workflow runs on its own
time.

This is the fix that stops the others from compounding. A slow or failed
response puts the delivery back on Meta's 36-hour retry schedule, and every
retry that arrives is another inbound message to answer.

### Branch on which array is present, not on `field`

Both an inbound message and a delivery receipt arrive with `field:
"messages"`. B's first decision is whether `value.messages` is a non-empty
array. If it is not, the payload goes to a branch that records what it
ignored and stops.

A does not branch at all. It reads `value.messages[0]` directly, which on a
delivery receipt is a property of `undefined`, so the workflow throws and the
webhook returns 500 — and a 500 is precisely what makes Meta retry it for the
next 36 hours.

A bot that branches on `field` instead answers its own receipts. This one
errors on them. Both are failures the demo cannot produce, because a demo
never looks at the second webhook call.

### Deduplicate on Meta's message id

Meta's retry carries the same `messages[0].id`. That id is the only thing in
the payload that distinguishes a retry from a new question, and it is the
natural dedupe key.

B uses the `removeDuplicates` node in
`removeItemsSeenInPreviousExecutions` mode, keyed on `message_id`, scoped to
the workflow. A second delivery of the same message is dropped before the
reply is composed, so there is nothing to send and nothing to log.

A has no dedupe, so `02-same-message-retry.json` — byte-identical to `01`,
same id — produces a second reply to a question already answered.

### Normalise before anything reads the message

`text.body` exists on a text message. It does not exist on a sticker, an
image, a location, or a button reply, where the text lives somewhere else or
does not exist at all.

A reads `message.text.body` and throws on anything that is not text. B
normalises first: it pulls text from whichever field holds it, records the
message type, and sets a `supported` flag. An unsupported type is declined
with a short reply rather than answered with a generic one, which would read
as if the bot had understood.

### Retry the send, and keep what could not be sent

B's send node has `retryOnFail` with three tries a second apart, and an error
output. A reply that still fails after three tries is written to the log table
with status `send_failed` and the error message, so there is a record of a
customer who asked something and got nothing.

A's send node has no retry and no error path. A failed send loses the reply
and the log row both, because the log step sits downstream of the send.

### Log the inbound separately from the outbound

B writes a row when a message is accepted and another when a reply is
delivered. The first row is the consent and inbound record, and it exists
whether or not the reply ever goes out.

A writes one row, after the send, saying `sent`. Every row in A's log
describes a success, which is the same property that made case 02's run log
useless.

## Known limitations

- **The 24-hour customer service window.** This agent only ever replies to an
  inbound message, so it is always inside the window Meta allows for free-form
  replies. That is why it never needs a template. An outbound-initiated
  message, or a reply sent more than 24 hours after the customer's last
  message, requires an approved message template. This is a documented
  boundary the workflow stays inside, not something it handles. A follow-up
  campaign is a different build.
- **The temporary access token expires in about 24 hours.** A demo set up in
  the afternoon stops working the next morning with a `401` and no
  explanation. Anything beyond a demo needs a System User token.
- **Deduplication is keyed on Meta's message id, in n8n's own store.** It is
  the right key, and the store is not durable infrastructure: clearing the
  dedupe history replays everything Meta sends next. Two n8n instances behind
  one webhook would not share it either.
- **A free tunnel URL changes on restart.** Every restart means editing
  `.env`, recreating the container and re-entering the callback URL in the
  Meta dashboard. There is no way around it other than paying for a static
  domain.
- **The sticker is detected and declined, not answered.** B replies that it
  only reads text. It does not download the sticker, caption an image or read
  a location. Declining clearly is the deliberate behaviour; handling those
  types is not in scope here.
- **The think step is a stand-in.** Both versions use the same three-second
  string match, so the comparison measures the plumbing and not a model. A
  real agent replaces that one node and inherits everything else.
- **The numbers in this case are predictions.** See the result table.

## Reproducing it

Requirements and starting n8n: [repo README](../../README.md).

No Meta account is needed for the comparison. Only the real end-to-end run
in [`SETUP.md`](SETUP.md) needs one.

1. Create a data table `whatsapp_messages` (`received_at`, `workflow`,
   `message_id`, `wa_from`, `inbound_text`, `outbound_text`, `status`,
   `note`).
2. Put its id in place of the `REPLACE_WITH_YOUR_TABLE_ID` placeholders in
   both workflow files, and create a Header Auth credential for the send node.
   For the local comparison its value is never checked, so
   `Authorization: Bearer dummy` is enough; the node still refuses to run
   without one.
3. Import and publish both. An unpublished workflow does not serve its
   production webhook path, and the replay gets a 404 that explains nothing.
4. In each `Config` node set `api_base` to the collector:
   `http://host.docker.internal:8099` when n8n runs in Docker and the
   collector on the Windows host, `http://localhost:8099` when both are on the
   same host. Set it back to `https://graph.facebook.com/v26.0` for real use.
5. `node fixtures/collector.js` in one terminal.
6. `T_LOG=<id> N8N_API_KEY=<key> bash fixtures/run-both.sh` in another.

The collector prints a summary on Ctrl-C and serves the same thing as JSON on
`GET /__stats`.
