// Normalizes a phone number to E.164 (+ followed by 8 to 15 digits).
//
// Returns null when it cannot be normalized, rather than returning garbage.
// That lets you tell "no phone was supplied" apart from "something that is not
// a phone was supplied" — two different cases. The first is usually acceptable;
// the second is a validation error worth reporting back to whoever integrates.

function normalizePhone(raw, defaultCountry = '598') {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  let d = raw.replace(/[^\d+]/g, '');        // drop spaces, dashes, parentheses

  if (d.startsWith('00')) d = '+' + d.slice(2);        // old international prefix
  if (!d.startsWith('+')) {
    d = '+' + defaultCountry + d.replace(/^0+/, '');   // local trunk zero
  }

  return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
}

// Design decision: `defaultCountry` is a parameter, not a constant.
// A workflow that assumes the integrator's country breaks the day the client
// gets a lead from abroad. When delivered to a client, this value comes from
// their configuration, not from the code.
//
// Known limitation, stated plainly: this validates SHAPE, not existence. A
// number can be perfect E.164 and not exist. Real verification needs a lookup
// service, which is quoted separately.
// ponytail: regex over E.164; if a client needs real validation, use
// libphonenumber-js, which knows per-country lengths.

// --- check ---
// node phone-e164.js
if (require.main === module) {
  const assert = require('assert');

  assert.strictEqual(normalizePhone('+59899123456'), '+59899123456');
  assert.strictEqual(normalizePhone('099123456'), '+59899123456', 'drops the trunk zero');
  assert.strictEqual(normalizePhone('099 123 456'), '+59899123456', 'ignores spaces');
  assert.strictEqual(normalizePhone('00598 (99) 44-55-66'), '+59899445566', 'turns 00 into +');
  assert.strictEqual(normalizePhone('+1 415 555 0123'), '+14155550123', 'respects other countries');

  // The dangerous case: a foreign number WITHOUT the "+". It gets the default
  // country code and the result passes shape validation while being wrong.
  assert.strictEqual(normalizePhone('4155550123', '598'), '+5984155550123',
    'a US number without + ends up looking like a valid Uruguayan one. See note below.');

  // When the foreign number is long, the E.164 ceiling saves us by accident:
  assert.strictEqual(normalizePhone('5491123456789', '598'), null,
    '17 digits exceed the E.164 maximum, so it is rejected');

  assert.strictEqual(normalizePhone(''), null);
  assert.strictEqual(normalizePhone('   '), null);
  assert.strictEqual(normalizePhone('no phone'), null);
  assert.strictEqual(normalizePhone('123'), null, 'too short');
  assert.strictEqual(normalizePhone(null), null);
  assert.strictEqual(normalizePhone(undefined), null);

  console.log('phone-e164: all green');
}

// NOTE on the dangerous case above. If a foreign number arrives without the
// "+", there is no way to know it is foreign and it gets the default country
// code. `4155550123` (US) comes out as `+5984155550123`: valid shape, wrong
// number. Nobody finds out until somebody dials it.
//
// The length ceiling only hides the problem when the number happens to be long
// (see the 17-digit case). That is luck, not design.
//
// Cheap mitigation, on the correct side: a separate country field in the form,
// or a placeholder asking for international format. This cannot be fixed from
// the workflow, and it is worth telling the client so instead of promising it can.

module.exports = { normalizePhone };
