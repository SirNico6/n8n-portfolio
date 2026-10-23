# HubSpot — gotchas

Una línea por hallazgo, con fecha.

## 2026-10-23 — El nodo de contactos es upsert, no create

El nodo `n8n-nodes-base.hubspot` (v2.2) **no tiene operación "create"** para
contactos. La única operación de escritura es `upsert` ("Create or Update"):
crea el contacto, o actualiza el existente si el email ya está.

Tres consecuencias que cambian cómo se diseña el workflow:

1. **HubSpot ya deduplica por email.** No hace falta deduplicar el contacto en
   sí. Pero eso engaña: el workflow puede seguir disparando efectos
   secundarios duplicados (notificaciones, tareas, deals, filas de log). El
   daño de un doble submit no es el contacto repetido, es que el equipo
   comercial llama dos veces al mismo lead.

2. **El upsert pisa datos en silencio.** Si el mismo email vuelve a entrar con
   campos vacíos o peores, HubSpot actualiza el contacto existente y se pierde
   lo que había. No falla, no avisa. Es pérdida de datos invisible.

3. **La deduplicación es por string exacto de email.** `lucia@example.com`,
   `  LUCIA@Example.com  ` y `lucia@example.com ` son tres contactos distintos
   para HubSpot. **Normalizar el email es responsabilidad del workflow.** Si no
   se hace, el CRM duplica aunque tenga deduplicación incorporada — y el
   cliente culpa al CRM.

El campo `email` es el único obligatorio. El resto va en `additionalFields`.

## 2026-10-23 — Autenticación: usar appToken

El nodo ofrece tres modos: `apiKey`, `appToken`, `oAuth2`. Las API keys de
HubSpot están discontinuadas. Para una integración propia, `appToken` (private
app token) es el camino: se genera en Settings → Integrations → Private Apps,
da un token directo y evita el baile de OAuth. Scopes mínimos para este caso:
`crm.objects.contacts.read` y `crm.objects.contacts.write`.
