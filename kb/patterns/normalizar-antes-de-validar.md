# Normalizar antes de validar

## Qué problema resuelve

Un dato que es válido pero viene mal escrito es rechazado como si fuera
inválido, y el lead se pierde. El caso típico: un email con un espacio al
principio porque el visitante copió y pegó.

Medido en el caso-01: `  Marta.Figueroa@EXAMPLE.com  ` hace que HubSpot
devuelva `400 Property values were not valid`. El lead desaparece. Es una
persona real con un espacio de más.

## Cuándo aplicarlo

Siempre que entre texto escrito por un humano: formularios, CSVs, importaciones,
pegado desde un mail. O sea, casi siempre.

El orden importa y es contraintuitivo:

```
normalizar  ->  validar  ->  deduplicar  ->  escribir
```

Si validás antes de normalizar, rechazás datos buenos.
Si deduplicás antes de normalizar, `Juan@x.com` y `juan@x.com ` te entran como
dos personas distintas.

## El patrón

```js
// Email: recortar y bajar a minusculas ANTES de validar.
const email = typeof body.email === 'string'
  ? body.email.trim().toLowerCase()
  : '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
if (!email) errors.push('falta el campo requerido: email');
else if (!EMAIL_RE.test(email)) errors.push('email invalido: "' + email + '"');
```

Ese `.trim().toLowerCase()` es todo el arreglo. Dos llamadas.

Para teléfonos, ver `kb/snippets/telefono-e164.js`.

## Qué NO normalizar

No toques el contenido semántico. Recortar espacios y bajar mayúsculas de un
email es normalización. Borrar caracteres del apellido de alguien porque
"parecen peligrosos" no lo es: rompe a O'Brien y a D'Angelo. Para contenido
riesgoso, ver `sanitizar-sin-censurar`.

## Cómo verificar que funciona

La prueba que vale es que dos escrituras distintas del mismo dato produzcan la
misma clave:

```js
assert.strictEqual(
  normalize(leadLimpio).dedupe_key,
  normalize(leadSucio).dedupe_key
);
```

Implementado en `casos/caso-01-lead-intake/test-normalizacion.js`.

## Gotchas relacionados

- `kb/gotchas/hubspot.md` — HubSpot recorta los espacios en el mensaje de
  error, así que te muestra un email que parece válido y lo llama inválido. Sin
  este patrón, perseguís ese fantasma una hora.
