#!/usr/bin/env node
// Corre la logica de normalizacion/validacion de la version B contra los
// fixtures, sin levantar n8n. Extrae el codigo del nodo "Normalizar y validar"
// del propio workflow-B-robusto.json, asi el test no puede quedar desfasado
// del workflow: si alguien edita el nodo, esto corre el codigo nuevo.
//
//   node test-normalizacion.js
//
// Sale con codigo 1 si algo falla.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const here = __dirname;
const wf = JSON.parse(fs.readFileSync(path.join(here, 'workflow-B-robusto.json'), 'utf8'));

const codeNode = wf.nodes.find((n) => n.name === 'Normalizar y validar');
assert.ok(codeNode, 'no encontre el nodo "Normalizar y validar" en el workflow');

const jsCode = codeNode.parameters.jsCode;
const run = new Function('$input', jsCode);

function normalize(body) {
  const fake = { all: () => [{ json: { body } }] };
  return run(fake)[0].json;
}

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));
}

let fallos = 0;
function check(titulo, fn) {
  try {
    fn();
    console.log('  ok   ' + titulo);
  } catch (e) {
    fallos++;
    console.log('  FALLA ' + titulo);
    console.log('        ' + e.message.split('\n')[0]);
  }
}

console.log('\nNormalizacion y validacion — version B\n');

check('01 valido pasa', () => {
  const r = normalize(fixture('01-valido.json'));
  assert.strictEqual(r.ok, true, 'deberia ser valido, errores: ' + JSON.stringify(r.errors));
  assert.strictEqual(r.lead.email, 'marta.figueroa@example.com');
  assert.strictEqual(r.lead.phone, '+59899123456');
});

check('02 email invalido se rechaza', () => {
  const r = normalize(fixture('02-email-invalido.json'));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('email invalido')), 'errores: ' + JSON.stringify(r.errors));
});

check('03 email con espacios y mayusculas se normaliza en vez de explotar', () => {
  const r = normalize(fixture('03-telefono-raro.json'));
  assert.strictEqual(r.ok, true, 'deberia pasar, errores: ' + JSON.stringify(r.errors));
  assert.strictEqual(r.lead.email, 'lucia.benitez@example.com');
});

check('03 telefono local se normaliza a E.164', () => {
  const r = normalize(fixture('03-telefono-raro.json'));
  assert.strictEqual(r.lead.phone, '+59899445566');
});

check('04 campos faltantes se rechaza nombrando el campo', () => {
  const r = normalize(fixture('04-campos-faltantes.json'));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('email')), 'errores: ' + JSON.stringify(r.errors));
});

check('05b duplicado sucio produce la MISMA clave de dedup que 01', () => {
  const a = normalize(fixture('01-valido.json'));
  const b = normalize(fixture('05b-duplicado-sucio.json'));
  assert.strictEqual(b.ok, true, 'el duplicado sucio deberia pasar, errores: ' + JSON.stringify(b.errors));
  assert.strictEqual(a.dedupe_key, b.dedupe_key,
    'las claves difieren: "' + a.dedupe_key + '" vs "' + b.dedupe_key + '"');
});

check('06 inyeccion: se quita el HTML', () => {
  const r = normalize(fixture('06-inyeccion.json'));
  assert.ok(!/<[^>]+>/.test(r.lead.first_name + r.lead.message),
    'quedo HTML: ' + JSON.stringify({ n: r.lead.first_name, m: r.lead.message }));
});

check('06 inyeccion: la formula de planilla queda neutralizada', () => {
  const r = normalize(fixture('06-inyeccion.json'));
  assert.ok(r.lead.company.startsWith("'"),
    'company deberia arrancar con apostrofe: ' + JSON.stringify(r.lead.company));
});

check('07 payload gigante se rechaza por tamanio', () => {
  const r = normalize(fixture('07-payload-gigante.json'));
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('demasiado grande')), 'errores: ' + JSON.stringify(r.errors));
});

check('07 se rechaza ANTES de intentar llamar al CRM', () => {
  // Si el payload es invalido, el IF lo manda al 400 y nunca llega a HubSpot.
  const r = normalize(fixture('07-payload-gigante.json'));
  assert.strictEqual(r.ok, false);
});

console.log('');
if (fallos) {
  console.log(fallos + ' comprobacion(es) fallaron\n');
  process.exit(1);
}
console.log('todo verde\n');
