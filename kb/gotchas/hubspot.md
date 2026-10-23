# HubSpot — gotchas

One line per finding, dated.

## 2026-10-23 — The contact node is upsert, not create

The `n8n-nodes-base.hubspot` node (v2.2) has **no "create" operation** for
contacts. The only write operation is `upsert` ("Create or Update"): it creates
the contact, or updates the existing one if the email is already there.

Three consequences that change how the workflow is designed:

1. **HubSpot already dedupes by email.** You do not need to deduplicate the
   contact itself. But that is deceptive: the workflow can still fire duplicate
   side effects — notifications, tasks, deals, log rows. The damage from a
   double submit is not the repeated contact, it is the sales team calling the
   same lead twice.

2. **Upsert overwrites data silently.** If the same email comes back in with
   empty or worse fields, HubSpot updates the existing contact and what was
   there is lost. No failure, no warning. Invisible data loss.

3. **Deduplication is on the exact email string.** `lucia@example.com`,
   `  LUCIA@Example.com  ` and `lucia@example.com ` are three different contacts
   to HubSpot. **Normalizing the email is the workflow's job.** Skip it and the
   CRM duplicates despite having deduplication built in — and the client blames
   the CRM.

`email` is the only required field. Everything else goes in `additionalFields`.

## 2026-10-23 — Authentication: use appToken

The node offers three modes: `apiKey`, `appToken`, `oAuth2`. HubSpot API keys
are discontinued. For your own integration, `appToken` is the way: it takes a
direct token and skips the OAuth dance. Minimum scopes for this case:
`crm.objects.contacts.read` and `crm.objects.contacts.write`.

## 2026-10-23 — Private apps are gone: it is "service keys" now

A HubSpot account created today **cannot create private apps**. The Legacy Apps
screen says it verbatim: *"Legacy apps aren't available on this account. Service
keys and project-based apps have replaced legacy apps."*

Cutoff dates: private app creation ended 28 Sep 2026 for new accounts and
26 Oct 2026 for existing ones. Already-created private apps keep working.

**Where they live now:** Development → Keys → Service Keys. Not under
Settings → Integrations, which is where every tutorial and every piece of
documentation you will find still points.

**What matters for n8n:** a service key is a Bearer token, exactly like a private
app token. It goes in the node's **App Token** credential with nothing else
changed. n8n already lists it as the recommended option.

**Limitation to know before promising anything to a client:** service keys
**do not support webhooks**. They are for calling HubSpot's API from your own
code. If the client needs HubSpot to notify them of an event (contact created,
deal moved), that requires a project-based app, which is a different mechanism
and a different setup.

**Scopes:** a service key can only receive scopes the creator already holds. For
writing contacts, `crm.objects.contacts.read` and `crm.objects.contacts.write`
are enough. The `sensitive.read` and `highly_sensitive.read` variants are not
needed and come with a warning: leave them unchecked.

**Status:** service keys were still in public beta as of HubSpot's Fall 2026
developer release notes. Verify before relying on this for a client.

### Verified live (2026-10-23)

A service key issued today has a **`pat-` prefix and 44 characters**: the same
format as a private app token. That is why n8n's App Token credential accepts it
unchanged.

Tested against the real API:

```bash
curl -H "Authorization: Bearer $HUBSPOT_SERVICE_KEY" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=2&properties=email,firstname,lastname"
# HTTP 200, returns the contacts
```

That curl is the fast way to rule the credential out when a workflow fails: if
the curl returns 200 and the node still fails, the problem is in the node, not
the key.

## 2026-10-23 — The "invalid email" message trims the whitespace away

Send an email with leading or trailing whitespace and HubSpot rejects it with
`Property values were not valid`, and the message reads:

    Email address LUCIA.BENITEZ@Example.COM is invalid

**without the whitespace.** It shows you a syntactically valid email and calls it
invalid. The actual cause — the space — appears nowhere in the error.

Practical consequence: when a client reports "HubSpot says the email is invalid
and the email is fine", whitespace is the first suspect. Ask for the raw
payload, not for what they see on screen.

Capitals are **not** the problem: HubSpot accepts them. Only whitespace breaks it.

## 2026-10-23 — "Forbidden - check your credentials" can be Cloudflare, not auth

A payload containing `<script>`, `onerror=` or SQL in its text fields is not
rejected by HubSpot's API: it is blocked by **Cloudflare at the edge**, before it
gets there.

What n8n shows:

    Forbidden - perhaps check your credentials?

and in the detail, a full HTML page (`<!DOCTYPE html>` with `ie6 oldie` classes,
the classic Cloudflare block template).

**The credential has nothing to do with it.** It is the payload content.

How to tell in thirty seconds: if the error body is HTML instead of JSON, that
is not HubSpot's API talking. It is the WAF. No HubSpot API returns HTML.

This does double duty in case-01: it justifies sanitizing input (which is what
gets sold) and it is the most expensive error to diagnose of everything measured.
