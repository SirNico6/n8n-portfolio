# Caso 01 — Captura de leads que no pierde ninguno

Un formulario web manda leads a un CRM y avisa al equipo comercial. Cuatro
nodos. Es el flujo más pedido y el que más silenciosamente falla.

## El problema, en lenguaje de negocio

Un formulario de contacto que "funciona" puede estar perdiendo uno de cada
cuatro leads sin que nadie se entere.

No falla de forma visible. Falla así: alguien copia y pega su email y arrastra
un espacio. El CRM lo rechaza. El workflow devuelve un error genérico. El
visitante ve "algo salió mal", se va, y nadie vuelve a saber de esa persona.
No queda un registro, no salta una alerta, no hay nada que revisar.

Si el formulario recibe diez leads por día y dos vienen mal escritos, son dos
clientes potenciales diarios que el equipo comercial nunca ve. El síntoma
visible es cero.

**Por eso este caso no se vende mostrando un diagrama.** Se vende mostrando la
tabla de qué entró y qué sobrevivió.

## Lo que hay acá

| Archivo | Qué es |
|---|---|
| [`workflow-A-naive.json`](workflow-A-naive.json) | La versión de tutorial. Cuatro nodos, camino feliz. **Está mal a propósito** |
| [`workflow-B-robusto.json`](workflow-B-robusto.json) | El mismo resultado de negocio, aguantando la realidad |
| [`workflow-error-handler.json`](workflow-error-handler.json) | La red abajo de la red: atrapa lo que ningún manejo explícito previó |
| [`fixtures/`](fixtures/) | Ocho payloads que ejercitan cada rama. El guion de la demo |
| [`fallas-version-A.md`](fallas-version-A.md) | Cómo falla A, medido |
| [`resultados-A-vs-B.md`](resultados-A-vs-B.md) | Las dos versiones contra los mismos ocho payloads |
| [`demo-script.md`](demo-script.md) | Guion minuto a minuto del video |
| [`test-normalizacion.js`](test-normalizacion.js) | Prueba la lógica sin levantar n8n |

## El resultado, medido

| Fixture | Versión A | Versión B |
|---|---|---|
| Válido | `200` creado | `202` creado |
| Email con `@@` | **`500` genérico** | `400` `email invalido: "diego.pereyra@@example"` |
| Email con espacios | **`500`, lead perdido** | `202` normalizado y creado |
| Sin email | **`500` genérico** | `400` `falta el campo requerido: email` |
| Duplicado exacto | `200`, avisa dos veces | `202`, deduplicado |
| Duplicado mal escrito | **`500`, lead perdido** | `202`, deduplicado |
| Inyección HTML/SQL | **`500`, lead perdido** | `202`, bloqueado pero **guardado para reproceso** |
| Payload de 1 MB | **`500` genérico** | `400` `payload demasiado grande: 1048791 bytes` |

Seis de ocho contra cero de ocho.

## Las decisiones, y por qué

### Normalizar antes de validar, no después

El orden parece un detalle y es el caso entero.

`  Marta.Figueroa@EXAMPLE.com  ` y `marta.figueroa@example.com` son la misma
persona. Si validás antes de recortar, rechazás a una persona real. Si
deduplicás antes de recortar, la cargás dos veces.

Un `.trim().toLowerCase()` convierte dos fallas en dos éxitos. Dos llamadas.

### El CRM ya deduplica, y eso es parte del problema

HubSpot no tiene operación "crear contacto": solo *upsert* por email. Deduplica
solo. Eso suena a que el problema no existe, y es justamente lo que lo hace
invisible:

- La deduplicación es **por string exacto**. Un email con un espacio es otra
  persona para el CRM.
- Deduplica el contacto, **no los efectos secundarios**. El aviso al equipo
  sale igual dos veces, y alguien llama dos veces al mismo lead.
- El upsert **pisa datos en silencio**: un segundo envío con campos vacíos
  sobreescribe lo que había.

Detalle en [`kb/gotchas/hubspot.md`](../../kb/gotchas/hubspot.md).

### El visitante nunca espera al CRM

La versión A responde recién cuando HubSpot contestó. Si el CRM está lento, el
formulario queda colgado y la persona aprieta "Enviar" de nuevo. Ahí nace el
duplicado. Si el CRM está caído, la persona ve un error que no es suyo.

La versión B responde `202` apenas el payload es válido y sigue procesando
después. Eso obliga a lo otro: un `202` sin cola de reproceso es una mentira.
Ver [`kb/patterns/respuesta-desacoplada.md`](../../kb/patterns/respuesta-desacoplada.md).

### Sanitizar no es censurar

El payload de inyección **sigue fallando en la versión B**, a propósito.

Se neutraliza lo que se *ejecuta*: etiquetas HTML, y fórmulas de planilla —un
campo que arranca con `=` se evalúa al abrir el archivo—. No se borra texto del
usuario. Filtrar "palabras peligrosas" rompe a cualquier O'Brien o D'Angelo,
que son apellidos legítimos.

Resultado: el WAF del CRM lo bloquea igual. Pero en A el lead se evaporaba, y
en B queda en la cola con el payload completo y el link a la ejecución. **Eso
es lo que significa robusto: no que nada falle, sino que nada se pierda.**

### La cola de reproceso no necesita otra cuenta

Usa las *data tables* nativas de n8n 2.x. Cero credenciales externas.

Si el cliente necesita mirar la cola sin entrar a n8n, el mismo patrón va
contra Google Sheets o Airtable sin cambiar nada más. La pregunta para
decidirlo es quién la va a mirar.

## Cómo reproducirlo

Requisitos y arranque de n8n: [README del repo](../../README.md).

**1. Credencial de HubSpot.** Cuenta gratis → *Development → Keys → Service
Keys* → crear una con `crm.objects.contacts.read` y
`crm.objects.contacts.write`, nada más. En n8n, credencial tipo **App Token**.

> HubSpot discontinuó las *private apps*: una cuenta nueva solo puede crear
> *service keys*. Es el mismo Bearer token y entra en el mismo campo. Toda la
> documentación que vas a encontrar apunta al camino viejo.

**2. La tabla de la cola.**

```bash
curl -X POST "http://localhost:5678/api/v1/data-tables" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"lead_dead_letter","columns":[
        {"name":"received_at","type":"string"},{"name":"email","type":"string"},
        {"name":"payload","type":"string"},{"name":"error_message","type":"string"},
        {"name":"error_node","type":"string"},{"name":"execution_id","type":"string"},
        {"name":"workflow_name","type":"string"}]}'
```

Poné el `id` que devuelve en el nodo *Guardar en dead letter queue* de B y en
*Registrar el fallo* del manejador de errores.

**3. Importar y publicar** los tres workflows. El manejador de errores va
primero: n8n no deja seleccionar como *error workflow* uno que no esté
publicado.

**4. Disparar los fixtures.**

```bash
bash fixtures/enviar.sh http://localhost:5678/webhook/lead-intake-naive   # version A
bash fixtures/enviar.sh http://localhost:5678/webhook/lead-intake         # version B
```

El orden importa: `05` y `05b` son duplicados de `01`, así que `01` tiene que
haber pasado antes para que la deduplicación tenga contra qué comparar.

## Limitaciones conocidas

Dichas de frente, porque un entregable que no las dice no es honesto:

- **Teléfonos sin prefijo internacional.** Un número extranjero sin `+` recibe
  el país por defecto y queda con forma válida y valor equivocado. Se arregla
  en el formulario, no en el workflow. Ver
  [`kb/snippets/telefono-e164.js`](../../kb/snippets/telefono-e164.js).
- **La deduplicación es por email.** Dos personas distintas que comparten un
  email corporativo se funden en un contacto. Para dedupe por email + teléfono
  hay que cambiar la clave.
- **El historial de deduplicación vive en el workflow.** Si se borra el
  workflow, se pierde. Para retención larga va contra una tabla.
- **Las credenciales son por instancia.** Levantar el repo en una máquina nueva
  importa los workflows pero no las credenciales: hay que volver a cargar el
  service key de HubSpot y el token de Telegram. Es así por diseño — las
  credenciales nunca viajan en el repo.
