// Sanitizes free text before writing it into any system.
//
// Neutralizes what EXECUTES; it does not censor what people wrote.
// Stripping "suspicious" characters out of someone's surname breaks O'Brien
// and D'Angelo, who are real people with legitimate names.
//
// Covers three distinct risks:
//   1. HTML/JS   -> renders in the CRM panel or in an email (stored XSS)
//   2. Control   -> breaks parsers and logs
//   3. Formulas  -> a field starting with = + - @ is EVALUATED when the target
//                   spreadsheet is opened (CSV injection). This matters when the
//                   dead letter queue writes to Google Sheets or Excel.

function sanitize(v) {
  if (typeof v !== 'string') return '';
  let s = v.replace(/<[^>]*>/g, '');                 // HTML tags
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');      // control characters
  s = s.replace(/\s+/g, ' ').trim();                 // collapse whitespace
  if (/^[=+\-@]/.test(s)) s = "'" + s;               // formula -> literal text
  return s;
}

// What it deliberately does NOT do:
//
// It does not try to filter SQL. Measured in case-01: a payload containing
// "Robert'); DROP TABLE leads;--" is blocked by HubSpot's WAF (Cloudflare) even
// though the text is harmless to you, because you are not executing that SQL.
// Guessing which string will upset somebody else's WAF is a fight you cannot
// win. The right move is to capture the failure in the dead letter queue.
//
// It also does not escape for HTML output. That belongs to whoever renders the
// value, not to whoever stores it.

// --- check ---
// node sanitize-text.js
if (require.main === module) {
  const assert = require('assert');

  assert.strictEqual(sanitize('<script>alert(1)</script>hi'), 'alert(1)hi');
  assert.strictEqual(sanitize('<img src=x onerror=alert(1)> text'), 'text');
  assert.strictEqual(sanitize('=HYPERLINK("http://x","click")'), '\'=HYPERLINK("http://x","click")');
  assert.strictEqual(sanitize('+54 9 11'), "'+54 9 11");
  assert.strictEqual(sanitize('  lots   of   spaces  '), 'lots of spaces');
  assert.strictEqual(sanitize("O'Brien"), "O'Brien", 'must not touch legitimate surnames');
  assert.strictEqual(sanitize("D'Angelo"), "D'Angelo");
  assert.strictEqual(sanitize(null), '');
  assert.strictEqual(sanitize(42), '');

  console.log('sanitize-text: all green');
}

module.exports = { sanitize };
