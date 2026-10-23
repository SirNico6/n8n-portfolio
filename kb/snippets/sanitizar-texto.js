// Sanitiza texto libre antes de escribirlo en cualquier sistema.
//
// Neutraliza lo que se EJECUTA, no censura lo que se escribe.
// Borrar caracteres "sospechosos" del apellido de alguien rompe a O'Brien y a
// D'Angelo, que son personas reales con apellidos legitimos.
//
// Cubre tres riesgos distintos:
//   1. HTML/JS  -> se renderiza en el panel del CRM o en un mail (XSS almacenado)
//   2. Control  -> rompe parsers y logs
//   3. Formulas -> un campo que arranca con = + - @ se EVALUA al abrir la
//                  planilla destino (CSV injection). Esto importa cuando la
//                  dead letter queue escribe en Google Sheets o Excel.

function sanitize(v) {
  if (typeof v !== 'string') return '';
  let s = v.replace(/<[^>]*>/g, '');                 // etiquetas HTML
  s = s.replace(/[\u0000-\u001F\u007F]/g, ' ');      // caracteres de control
  s = s.replace(/\s+/g, ' ').trim();                 // espacios colapsados
  if (/^[=+\-@]/.test(s)) s = "'" + s;               // formula -> texto literal
  return s;
}

// Lo que NO hace, a proposito:
//
// No intenta filtrar SQL. Medido en el caso-01: un payload con
// "Robert'); DROP TABLE leads;--" lo bloquea el WAF de HubSpot (Cloudflare)
// aunque el texto sea inofensivo para vos, porque vos no ejecutas ese SQL.
// Intentar adivinar que string va a molestarle a un WAF ajeno es una pelea
// que no se gana. Lo correcto es capturar el fallo en la dead letter queue.
//
// Tampoco escapa para HTML de salida. Eso es responsabilidad de quien
// renderiza, no de quien guarda.

// --- check ---
// node sanitizar-texto.js
if (require.main === module) {
  const assert = require('assert');

  assert.strictEqual(sanitize('<script>alert(1)</script>hola'), 'alert(1)hola');
  assert.strictEqual(sanitize('<img src=x onerror=alert(1)> texto'), 'texto');
  assert.strictEqual(sanitize('=HYPERLINK("http://x","click")'), '\'=HYPERLINK("http://x","click")');
  assert.strictEqual(sanitize('+54 9 11'), "'+54 9 11");
  assert.strictEqual(sanitize('  varios   espacios  '), 'varios espacios');
  assert.strictEqual(sanitize("O'Brien"), "O'Brien", 'no debe tocar apellidos legitimos');
  assert.strictEqual(sanitize("D'Angelo"), "D'Angelo");
  assert.strictEqual(sanitize(null), '');
  assert.strictEqual(sanitize(42), '');

  console.log('sanitizar-texto: todo verde');
}

module.exports = { sanitize };
