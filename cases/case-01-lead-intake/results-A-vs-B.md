# A vs B — the same eight payloads

Real run, 23 Oct 2026, n8n 2.44.6, free HubSpot account.
Telegram node disabled in both versions to isolate the CRM.

## The HTTP response the form sees

| Fixture | Version A (naive) | Version B (robust) |
|---|---|---|
| `01-valid` | `200` created | `202` created |
| `02-invalid-email` | **`500` `{"message":"Error in workflow"}`** | `400` `invalid email: "diego.pereyra@@example"` |
| `03-messy-phone` | **`500` generic, lead lost** | `202` normalized and created |
| `04-missing-fields` | **`500` generic** | `400` `missing required field: email` |
| `05-exact-duplicate` | `200`, side effects duplicated | `202`, deduplicated, no second write |
| `05b-dirty-duplicate` | **`500` generic, lead lost** | `202`, deduplicated: same key as `01` |
| `06-injection` | **`500` generic, lead lost** | `202`, blocked downstream but **kept in the DLQ** |
| `07-oversized-payload` | **`500` generic** | `400` `payload too large: 1048791 bytes, maximum 65536` |

**A: six out of eight end in `500` with the same useless body.**
**B: no `500` at all. Every rejection names the field and the reason.**

## What happened after the response

Real trace of version B's executions (`dedupe_out` = items that survived the
deduplication node):

```
 9  01   marta.figueroa@example.com   dedupe_out:1  hubspot:YES  dlq:no
10  02   diego.pereyra@@example       (rejected at validation)
11  03   lucia.benitez@example.com    dedupe_out:1  hubspot:YES  dlq:no
12  04   (no email)                   (rejected at validation)
13  05   marta.figueroa@example.com   dedupe_out:0  hubspot:no   dlq:no
14  05b  marta.figueroa@example.com   dedupe_out:0  hubspot:no   dlq:no
15  06   injection.test@example.com   dedupe_out:1  hubspot:YES  dlq:YES
16  07   payload.grande@example.com   (rejected on size)
```

### Execution 14 — the core argument of the case

`05b` came in with the email `  Marta.Figueroa@EXAMPLE.com  `: whitespace and
capitals. The deduplication node's output was **0 items**. It recognised the
same lead as `01`, because it normalized before comparing.

The exact same payload, in version A, returned `500` and the lead disappeared.

It is not that the CRM got better or worse. It is the same HubSpot in both
cases. The only thing that changed is that somebody trimmed a space before
asking.

### Execution 15 — why `06` still fails, and why that is correct

The injection payload is **still rejected** in version B. Cloudflare blocks it
all the same: once the HTML is stripped, `Robert'); DROP TABLE leads;--` is
still in the surname field, and that trips the WAF.

**It was deliberately not "fixed" by deleting that text.** Silently rewriting
what a person typed breaks any legitimate surname with an apostrophe — O'Brien,
D'Angelo. Sanitizing means neutralizing what executes (HTML, spreadsheet
formulas), not censoring content.

What changed is where the data ends up:

| | Version A | Version B |
|---|---|---|
| Response to the visitor | generic `500` | `202` accepted |
| Lead is recorded | no, it evaporates | yes, in `lead_dead_letter` |
| You know what failed | no | yes: payload, error and `execution_id` |
| It can be replayed | no | yes |

The real row in the dead letter queue:

```
email:         injection.test@example.com
error_message: Forbidden - perhaps check your credentials?
error_node:    Create contact in HubSpot
```

And there is the second lesson: the stored message is still Cloudflare's
misleading one. A dead letter queue does not fix an error badly worded by
somebody else. What it does is make sure the error is **written down somewhere**
instead of disappearing, so a human can read it and work it out. See
`kb/gotchas/hubspot.md`.

## What this sells to a client

It is not "my workflow is prettier". It is:

- **You stop losing leads that are valid.** `03` and `05b` are real people with
  one extra space. In A they disappear. In B they come through.
- **You stop calling the same lead twice.** `05` and `05b` are the same contact;
  B catches it even when it is typed differently.
- **When something fails, you know.** `06` fails in both versions. In A it is a
  `500` with no trace. In B it is a row with the complete payload.
- **The visitor never sees an error caused by your CRM.** The response is sent as
  soon as the payload is valid, decoupled from HubSpot.

## Verifying without starting n8n

The normalization logic has its own check, which extracts the node's code
straight from the workflow JSON so it cannot drift out of date:

```bash
node cases/case-01-lead-intake/test-normalization.js
```

Ten assertions. The most important one: that `01` and `05b` produce the same
deduplication key.
