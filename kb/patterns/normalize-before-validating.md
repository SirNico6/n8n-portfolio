# Normalize before validating

## What problem it solves

Data that is valid but badly typed gets rejected as if it were invalid, and the
lead is lost. The classic case: an email with a leading space because the
visitor copied and pasted it.

Measured in case-01: `  Marta.Figueroa@EXAMPLE.com  ` makes HubSpot return
`400 Property values were not valid`. The lead disappears. That is a real person
with one extra space.

## When to apply it

Any time human-typed text comes in: forms, CSVs, imports, text pasted out of an
email. Which is to say, almost always.

The order matters and is counter-intuitive:

```
normalize  ->  validate  ->  deduplicate  ->  write
```

Validate before normalizing and you reject good data.
Deduplicate before normalizing and `Juan@x.com` and `juan@x.com ` come in as two
different people.

## The pattern

```js
// Email: trim and lowercase BEFORE validating.
const email = typeof body.email === 'string'
  ? body.email.trim().toLowerCase()
  : '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
if (!email) errors.push('missing required field: email');
else if (!EMAIL_RE.test(email)) errors.push('invalid email: "' + email + '"');
```

That `.trim().toLowerCase()` is the entire fix. Two calls.

For phone numbers, see `kb/snippets/phone-e164.js`.

## What NOT to normalize

Do not touch semantic content. Trimming whitespace and lowercasing an email is
normalization. Deleting characters from someone's surname because they "look
dangerous" is not: it breaks O'Brien and D'Angelo. For risky content, see
`kb/snippets/sanitize-text.js`.

## How to verify it works

The test that matters is that two different spellings of the same data produce
the same key:

```js
assert.strictEqual(
  normalize(cleanLead).dedupe_key,
  normalize(dirtyLead).dedupe_key
);
```

Implemented in `cases/case-01-lead-intake/test-normalization.js`.

## Related gotchas

- `kb/gotchas/hubspot.md` — HubSpot trims the whitespace out of its own error
  message, so it shows you an email that looks valid and calls it invalid.
  Without this pattern you chase that ghost for an hour.
