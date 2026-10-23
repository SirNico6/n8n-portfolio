# Fixtures

The script for the demo. Each file exercises a different branch.

| File | What it tests | Version A (naive) | Version B (robust) |
|---|---|---|---|
| `01-valid.json` | Happy path | Creates the contact | Creates the contact |
| `02-invalid-email.json` | Syntactically broken email | Sends it to HubSpot anyway | Rejects with `400` and an explanation |
| `03-messy-phone.json` | Local phone, whitespace, capitals | Stores the dirty data as-is | Normalizes to E.164, trims, lowercases |
| `04-missing-fields.json` | Email and phone absent | Breaks: HubSpot requires an email | Rejects with `400` naming the missing field |
| `05-exact-duplicate.json` | Identical resubmission of `01` | HubSpot dedupes the contact, **but the notification fires anyway** | Detected: no write, no notification |
| `05b-dirty-duplicate.json` | Same lead, email with whitespace and capitals | **Creates a second contact**: HubSpot dedupes on the exact string | Normalizes first, then dedupes: one contact |
| `06-injection.json` | HTML/JS, SQL and a spreadsheet formula | Writes it raw wherever it lands | Sanitizes before writing |
| `07-oversized-payload.json` | 1 MB field | Tries to send the whole thing | Rejects on size before calling the CRM |

## Why there are two duplicate fixtures

Because the HubSpot node has no `create` operation, only `upsert`: the CRM
already dedupes by email. An exact duplicate does not produce two contacts, and
if the demo only used that case, the naive version would look correct.

Together they tell the real story:

- **`05`** shows that deduplicating the record is not enough: the side effects
  still fire, and the sales team calls the same lead twice.
- **`05b`** shows that the CRM's deduplication is on the exact string, so all it
  takes is not normalizing the email for it to duplicate anyway. The client
  blames the CRM; the fault was in the workflow.

Details in `kb/gotchas/hubspot.md`.

## A note on `06-injection.json`

The `company` field starts with `=`. If the destination is a spreadsheet, that
is evaluated as a formula when the file is opened: formula injection, not just
XSS. It is in the demo because the dead letter queue can write to Google Sheets.

## Data

Every name, email and phone number is invented. No real data.
