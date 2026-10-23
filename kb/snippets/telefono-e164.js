// Normaliza un telefono a E.164 (+ seguido de 8 a 15 digitos).
//
// Devuelve null si no se puede normalizar, en vez de devolver basura.
// Eso permite distinguir "no vino telefono" de "vino algo que no es telefono",
// que son dos casos distintos: el primero suele ser aceptable y el segundo es
// un error de validacion que hay que reportarle a quien integra.

function normalizePhone(raw, defaultCountry = '598') {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  let d = raw.replace(/[^\d+]/g, '');        // fuera espacios, guiones, parentesis

  if (d.startsWith('00')) d = '+' + d.slice(2);   // prefijo internacional viejo
  if (!d.startsWith('+')) {
    d = '+' + defaultCountry + d.replace(/^0+/, ''); // 0 troncal local
  }

  return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
}

// Decision de diseno: `defaultCountry` es un parametro, no una constante.
// Un workflow que asume el pais del integrador falla el dia que el cliente
// recibe un lead de afuera. Cuando se entrega a un cliente, este valor sale de
// su configuracion, no del codigo.
//
// Limitacion conocida, dicha de frente: esto valida FORMA, no existencia. Un
// numero puede quedar en E.164 perfecto y no existir. Para verificacion real
// hace falta un servicio de lookup, que se cobra aparte.
// ponytail: regex sobre E.164; si el cliente necesita validar de verdad, usar
// libphonenumber-js, que entiende largos por pais.

// --- check ---
// node telefono-e164.js
if (require.main === module) {
  const assert = require('assert');

  assert.strictEqual(normalizePhone('+59899123456'), '+59899123456');
  assert.strictEqual(normalizePhone('099123456'), '+59899123456', 'quita el 0 troncal');
  assert.strictEqual(normalizePhone('099 123 456'), '+59899123456', 'ignora espacios');
  assert.strictEqual(normalizePhone('00598 (99) 44-55-66'), '+59899445566', 'convierte 00 en +');
  assert.strictEqual(normalizePhone('+1 415 555 0123'), '+14155550123', 'respeta otro pais');

  // El caso peligroso: numero extranjero SIN "+". Se le pega el pais por
  // defecto y el resultado pasa la validacion de forma siendo incorrecto.
  assert.strictEqual(normalizePhone('4155550123', '598'), '+5984155550123',
    'un numero de EEUU sin + queda como uruguayo valido. Ver nota abajo.');

  // Si el numero extranjero es largo, el limite de E.164 lo salva por accidente:
  assert.strictEqual(normalizePhone('5491123456789', '598'), null,
    '17 digitos superan el maximo de E.164, asi que se rechaza');

  assert.strictEqual(normalizePhone(''), null);
  assert.strictEqual(normalizePhone('   '), null);
  assert.strictEqual(normalizePhone('no tengo'), null);
  assert.strictEqual(normalizePhone('123'), null, 'demasiado corto');
  assert.strictEqual(normalizePhone(null), null);
  assert.strictEqual(normalizePhone(undefined), null);

  console.log('telefono-e164: todo verde');
}

// NOTA sobre el caso peligroso de arriba. Si llega un numero extranjero sin el
// "+", no hay forma de saber que es extranjero y se le pega el pais por
// defecto. `4155550123` (EEUU) sale como `+5984155550123`: forma valida, numero
// equivocado. Nadie se entera hasta que alguien llama.
//
// El limite de largo de E.164 tapa el problema solo cuando el numero es largo
// (ver el caso de 17 digitos). Eso es suerte, no diseno.
//
// Mitigacion barata y del lado correcto: en el formulario, campo de pais
// separado o placeholder que pida formato internacional. No se arregla desde el
// workflow, y conviene decirselo al cliente en vez de prometer que si.

module.exports = { normalizePhone };
