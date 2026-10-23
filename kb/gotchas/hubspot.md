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

### Verificado en vivo (2026-10-23)

La service key emitida hoy tiene **prefijo `pat-` y 44 caracteres**: el mismo
formato que un private app token. Por eso la credencial App Token de n8n la
toma sin cambios.

Probada contra la API real:

```bash
curl -H "Authorization: Bearer $HUBSPOT_SERVICE_KEY" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=2&properties=email,firstname,lastname"
# HTTP 200, devuelve los contactos
```

Ese curl es la forma rápida de descartar la credencial como causa cuando un
workflow falla: si el curl da 200 y el nodo falla igual, el problema está en
el nodo, no en la key.

## 2026-10-23 — El mensaje de "email inválido" recorta los espacios

Si se manda un email con espacios al principio o al final, HubSpot lo rechaza
con `Property values were not valid`, y el mensaje dice:

    Email address LUCIA.BENITEZ@Example.COM is invalid

**sin los espacios.** O sea: muestra un email sintácticamente válido y lo
declara inválido. La causa real —el espacio— no aparece en ningún lado del
error.

Consecuencia práctica: cuando un cliente reporta "HubSpot dice que el email es
inválido y el email está bien", el primer sospechoso es whitespace. Pedirle el
payload crudo, no lo que ve en pantalla.

Las mayúsculas **no** son el problema: HubSpot acepta mayúsculas en el email.
Solo molesta el whitespace.

## 2026-10-23 — "Forbidden - check your credentials" puede ser Cloudflare, no auth

Un payload con `<script>`, `onerror=` o SQL en campos de texto no lo rechaza la
API de HubSpot: lo bloquea **Cloudflare en el borde**, antes de llegar.

Lo que n8n muestra:

    Forbidden - perhaps check your credentials?

y en el detalle, una página HTML completa (`<!DOCTYPE html>` con clases `ie6
oldie`, la plantilla clásica de bloqueo de Cloudflare).

**La credencial no tiene nada que ver.** Es el contenido del payload.

Cómo distinguirlo en treinta segundos: si el cuerpo del error es HTML en vez de
JSON, no es la API de HubSpot hablando. Es el WAF. Ninguna API de HubSpot
devuelve HTML.

Esto hace doble trabajo en el caso-01: justifica sanitizar la entrada (que es
lo que se vende) y además es el error más caro de diagnosticar de todos los
medidos.
