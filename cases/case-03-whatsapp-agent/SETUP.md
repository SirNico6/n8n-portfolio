# Setup — WhatsApp Cloud API

Two halves, and they are independent:

- **The measured A/B comparison needs nothing from Meta.** Real webhook
  payload shapes are replayed against both workflows locally, and a local
  collector counts what each one tries to send. Anyone can reproduce it.
- **Running it on real WhatsApp** needs a Meta app, a test number and a public
  HTTPS webhook. That part is below.

Everything here uses the **official Cloud API** on Graph API **v26.0**
(introduced 29 Jul 2026, confirmed against Meta's changelog on 24 Oct 2026).
No unofficial library is involved at any point.

## 1. Meta app and test number

Nothing here needs the tunnel, so it can be done first.

1. developers.facebook.com → **My Apps** → **Create App**.
2. Add the **WhatsApp** product.
3. Open **WhatsApp → API Setup**. It gives you, for free and with no business
   verification:
   - a **test phone number** that can send
   - a **temporary access token**, valid about **24 hours**
   - a **Phone number ID** and a **WhatsApp Business Account ID**
4. Under the **To** field, add your own number to the recipient allowlist. The
   test number can only message numbers on that list (about five of them). You
   will get a WhatsApp code to confirm.
5. Send the `hello_world` template from that page to your phone. If it arrives,
   the outbound half works and the credentials are right.

Put these in `.env` (never committed):

```
WA_API_BASE=https://graph.facebook.com/v26.0
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_VERIFY_TOKEN=REPLACE_WITH_YOUR_VERIFY_TOKEN
WA_TEST_RECIPIENT=
```

`WA_VERIFY_TOKEN` is a shared secret between Meta and the webhook, not a Meta
credential. It is still a secret, so nothing usable is committed here.
Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

**The temporary token expires in about 24 hours.** For anything beyond a
demo, create a System User token instead, under Business Settings. A workflow
that stops working the next morning with a `401` and no explanation is the
first thing to check.

## 2. The webhook needs public HTTPS

Meta will not deliver to `localhost` and will not accept plain HTTP. So n8n
has to be reachable from the internet while you test.

**Understand the exposure before doing this.** The tunnel publishes the whole
n8n instance, editor included, not only the webhook path. It is behind your
n8n login, and the URL is random, but an internet-reachable automation tool
holding your credentials is real attack surface. Open it only while testing
and close it when you stop.

```bash
ngrok http 5678
```

Read the `https://` forwarding URL it prints, then point n8n at it — n8n
builds webhook URLs from this variable, so without it the URLs it shows are
localhost and useless to Meta:

```bash
# in .env
WEBHOOK_URL=https://<your-subdomain>.ngrok-free.app/
```

```bash
docker compose up -d --force-recreate
```

**A free ngrok URL changes every restart.** Each time it changes you have to
update `.env`, recreate the container, and re-enter the callback URL in the
Meta dashboard. Budget for that or pay for a static domain.

## 3. Point Meta at the webhook

In **WhatsApp → Configuration → Webhook**:

- **Callback URL:** `https://<subdomain>.ngrok-free.app/webhook/whatsapp`
- **Verify token:** the `WA_VERIFY_TOKEN` value from `.env`
- Then **Manage** the subscribed fields and subscribe to **`messages`**.

Meta verifies with a `GET` carrying `hub.mode=subscribe`, `hub.verify_token`
and `hub.challenge`. The endpoint has to compare the token and **echo
`hub.challenge` back as the plain response body**. Workflow B does this;
workflow A does not, which is the first thing you notice when a naive bot
never finishes setup.

**The workflow must be published before you verify.** n8n does not serve the
production webhook path for an unpublished workflow, and Meta reports that as
a generic verification failure that tells you nothing.

## 4. Confirm it end to end

Message the test number from your phone. Expected:

- A reply arrives.
- **Exactly one** reply arrives, even though Meta delivers the same event more
  than once. That is the whole point of version B.

## What Meta's own documentation says

Two lines from Meta's docs decide the design of this case.

On retries, from the Graph API webhooks guide: delivery that fails is retried
immediately, then at decreasing frequency **over the next 36 hours**, and
because of that the documentation says your server **should handle
deduplication**. The platform tells you in writing that you will receive the
same message twice. Most bots do not act on it.

On payload shape, from the webhook payload reference: an inbound message and a
delivery receipt **both arrive with `field` set to `"messages"`**. What
distinguishes them is which array is present under `value` — `messages` or
`statuses`. A workflow that branches on `field` processes its own delivery
receipts as if they were incoming questions.
