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

## 2026-10-23 — Las private apps murieron: ahora son "service keys"

Una cuenta de HubSpot creada hoy **no puede crear private apps**. La pantalla
de Legacy Apps dice textual: *"Legacy apps aren't available on this account.
Service keys and project-based apps have replaced legacy apps."*

Fechas del corte: creación de private apps termina el 28/09/2026 para cuentas
nuevas y el 26/10/2026 para las existentes. Las private apps ya creadas
siguen funcionando.

**Dónde se crean ahora:** Development → Keys → Service Keys. No está en
Settings → Integrations, que es donde lo pone toda la documentación y todos
los tutoriales que vas a encontrar.

**Lo que importa para n8n:** la service key es un Bearer token, igual que el
private app token. Va en la credencial **App Token** del nodo de HubSpot, sin
cambiar nada más. n8n ya la lista como la opción recomendada.

**Limitación que hay que saber antes de prometerle algo a un cliente:** las
service keys **no soportan webhooks**. Sirven para llamar a la API de HubSpot
desde tu código. Si el cliente necesita que HubSpot le avise de un evento
(contacto creado, deal movido), hace falta una project-based app, que es otro
mecanismo y otro setup.

**Scopes:** una service key solo puede recibir scopes que ya tenga quien la
crea. Para escribir contactos alcanzan `crm.objects.contacts.read` y
`crm.objects.contacts.write`. Las variantes `sensitive.read` y
`highly_sensitive.read` no hacen falta y vienen con advertencia: no tildarlas.

**Estado:** service keys seguían en beta pública en las notas de release de
HubSpot del otoño 2026. Verificar antes de apoyarse en esto para un cliente.
