# A vs B — los mismos ocho payloads

Corrida real, 23/10/2026, n8n 2.44.6, cuenta HubSpot free.
Nodo de Telegram deshabilitado en ambas versiones para aislar el CRM.

## Respuesta HTTP que ve el formulario

| Fixture | Versión A (naive) | Versión B (robusta) |
|---|---|---|
| `01-valido` | `200` creado | `202` creado |
| `02-email-invalido` | **`500` `{"message":"Error in workflow"}`** | `400` `email invalido: "diego.pereyra@@example"` |
| `03-telefono-raro` | **`500` genérico, lead perdido** | `202` normalizado y creado |
| `04-campos-faltantes` | **`500` genérico** | `400` `falta el campo requerido: email` |
| `05-duplicado-exacto` | `200`, efectos secundarios duplicados | `202`, deduplicado, sin segunda escritura |
| `05b-duplicado-sucio` | **`500` genérico, lead perdido** | `202`, deduplicado: misma clave que `01` |
| `06-inyeccion` | **`500` genérico, lead perdido** | `202`, bloqueado aguas abajo pero **guardado en la DLQ** |
| `07-payload-gigante` | **`500` genérico** | `400` `payload demasiado grande: 1048791 bytes, maximo 65536` |

**A: seis de ocho terminan en `500` con el mismo cuerpo inútil.**
**B: ningún `500`. Cada rechazo nombra el campo y el motivo.**

## Qué pasó después de la respuesta

Traza real de las ejecuciones de B (`dedup_salida` = items que sobrevivieron
al nodo de deduplicación):

```
 9  01   marta.figueroa@example.com   dedup_salida:1  hubspot:SI  dlq:no
10  02   diego.pereyra@@example       (rechazado en validacion)
11  03   lucia.benitez@example.com    dedup_salida:1  hubspot:SI  dlq:no
12  04   (sin email)                  (rechazado en validacion)
13  05   marta.figueroa@example.com   dedup_salida:0  hubspot:no  dlq:no
14  05b  marta.figueroa@example.com   dedup_salida:0  hubspot:no  dlq:no
15  06   injection.test@example.com   dedup_salida:1  hubspot:SI  dlq:SI
16  07   payload.grande@example.com   (rechazado por tamanio)
```

### Ejecución 14 — el argumento central del caso

`05b` entró con el email `  Marta.Figueroa@EXAMPLE.com  `: espacios y
mayúsculas. La salida del nodo de deduplicación fue **0 items**. Lo reconoció
como el mismo lead que `01` porque normalizó antes de comparar.

El mismo payload, en la versión A, devolvía `500` y el lead desaparecía.

No es que el CRM sea mejor o peor. Es la misma HubSpot en los dos casos. Lo
único que cambió es que alguien recortó un espacio antes de preguntar.

### Ejecución 15 — por qué `06` sigue fallando, y por qué está bien

El payload de inyección **sigue siendo rechazado** en la versión B. Cloudflare
lo bloquea igual: después de quitar el HTML queda `Robert'); DROP TABLE
leads;--` en el apellido, y eso dispara el WAF.

**No se "arregló" borrando ese texto, a propósito.** Reescribir en silencio lo
que escribió una persona rompe a cualquier apellido legítimo con apóstrofe —
O'Brien, D'Angelo. Sanitizar significa neutralizar lo que se ejecuta (HTML,
fórmulas de planilla), no censurar el contenido.

Lo que cambió es el destino del dato:

| | Versión A | Versión B |
|---|---|---|
| Respuesta al visitante | `500` genérico | `202` aceptado |
| El lead queda registrado | no, se evapora | sí, en `lead_dead_letter` |
| Se sabe qué falló | no | sí: payload, error y `execution_id` |
| Se puede reprocesar | no | sí |

Fila real en la dead letter queue:

```
email:         injection.test@example.com
error_message: Forbidden - perhaps check your credentials?
error_node:    Crear contacto en HubSpot
```

Y ahí está la segunda lección: el mensaje guardado sigue siendo el engañoso de
Cloudflare. La dead letter queue no arregla un error mal redactado por un
tercero. Lo que hace es que el error quede **escrito en algún lado** en vez de
desaparecer, para que alguien lo pueda leer y entender. Ver
`kb/gotchas/hubspot.md`.

## Lo que esto le vende a un cliente

No es "mi workflow es más lindo". Es:

- **Dejás de perder leads que son válidos.** `03` y `05b` son personas reales
  con un espacio de más. En A desaparecen. En B entran.
- **Dejás de llamar dos veces al mismo lead.** `05` y `05b` son el mismo
  contacto; B lo detecta aunque venga escrito distinto.
- **Cuando algo falla, lo sabés.** `06` falla en las dos versiones. En A es un
  `500` sin rastro. En B es una fila con el payload completo.
- **El visitante nunca ve un error por culpa de tu CRM.** La respuesta se
  manda apenas el payload es válido, desacoplada de HubSpot.

## Verificación sin levantar n8n

La lógica de normalización tiene su propio check, que extrae el código del
nodo directamente del workflow JSON para que no pueda quedar desfasado:

```bash
node casos/caso-01-lead-intake/test-normalizacion.js
```

Diez comprobaciones. La más importante: que `01` y `05b` produzcan la misma
clave de deduplicación.
