#!/usr/bin/env node
// Runs version B's normalization/validation logic against the fixtures without
// starting n8n. The code is extracted from the "Normalize and validate" node of
// workflow-B-robust.json itself, so this test cannot drift out of sync with the
// workflow: edit the node and this runs the new code.
//
//   node test-normalization.js
//
// Exits 1 if anything fails.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const here = __dirname;
const wf = JSON.parse(fs.readFileSync(path.join(here, 'workflow-B-robust.json'), 'utf8'));

const codeNode = wf.nodes.find((n) => n.name === 'Normalize and validate');
assert.ok(codeNode, 'could not find the "Normalize and validate" node in the workflow');

const jsCode = codeNode.parameters.jsCode;
const run = new Function('$input', jsCode);

function normalize(body) {
  const fake = { all: () => [{ json: { body } }] };
  return run(fake)[0].json;
}

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));
}

let failures = 0;
function check(title, fn) {
  try {
    fn();
    console.log('  ok    ' + title);
  } catch (e) {
    failures++;
    console.log('  FAIL  ' + title);
    console.log('        ' + e.message.split('\n')[0]);
  }
}

console.log('\nNormalization and validation — version B\n');

check('01 valid payload passes', () => {
  const r = normalize(fixture('01-valid.json'));
  assert.strictEqual(r.ok, true, 'should be valid, errors: ' + JSON.stringify(r.errors));
  assert.strictEqual(r.lead.email, 'marta.figueroa@example.com');
  assert.strictEqual(r.lead.phone, '+59899123456');
});

check('02 invalid email is rejected', () => {
  const r = normalize(fixture('02-invalid-email.json'));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('invalid email')), 'errors: ' + JSON.stringify(r.errors));
});

check('03 email with whitespace and capitals is normalized instead of blowing up', () => {
  const r = normalize(fixture('03-messy-phone.json'));
  assert.strictEqual(r.ok, true, 'should pass, errors: ' + JSON.stringify(r.errors));
  assert.strictEqual(r.lead.email, 'lucia.benitez@example.com');
});

check('03 local phone number is normalized to E.164', () => {
  const r = normalize(fixture('03-messy-phone.json'));
  assert.strictEqual(r.lead.phone, '+59899445566');
});

check('04 missing fields are rejected, naming the field', () => {
  const r = normalize(fixture('04-missing-fields.json'));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('email')), 'errors: ' + JSON.stringify(r.errors));
});

check('05b dirty duplicate yields the SAME dedupe key as 01', () => {
  const a = normalize(fixture('01-valid.json'));
  const b = normalize(fixture('05b-dirty-duplicate.json'));
  assert.strictEqual(b.ok, true, 'the dirty duplicate should pass, errors: ' + JSON.stringify(b.errors));
  assert.strictEqual(a.dedupe_key, b.dedupe_key,
    'keys differ: "' + a.dedupe_key + '" vs "' + b.dedupe_key + '"');
});

check('06 injection: HTML is stripped', () => {
  const r = normalize(fixture('06-injection.json'));
  assert.ok(!/<[^>]+>/.test(r.lead.first_name + r.lead.message),
    'HTML survived: ' + JSON.stringify({ n: r.lead.first_name, m: r.lead.message }));
});

check('06 injection: spreadsheet formula is neutralized', () => {
  const r = normalize(fixture('06-injection.json'));
  assert.ok(r.lead.company.startsWith("'"),
    'company should start with an apostrophe: ' + JSON.stringify(r.lead.company));
});

check('07 oversized payload is rejected on size', () => {
  const r = normalize(fixture('07-oversized-payload.json'));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('too large')), 'errors: ' + JSON.stringify(r.errors));
});

check('07 is rejected BEFORE any attempt to call the CRM', () => {
  // An invalid payload is routed to the 400 branch by the IF node and never
  // reaches HubSpot.
  const r = normalize(fixture('07-oversized-payload.json'));
  assert.strictEqual(r.ok, false);
});

console.log('');
if (failures) {
  console.log(failures + ' check(s) failed\n');
  process.exit(1);
}
console.log('all green\n');
