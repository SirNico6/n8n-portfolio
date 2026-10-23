# Versión A (naive) — cómo falla, medido

Corrida real contra n8n 2.44.6 y una cuenta HubSpot free, el 23/10/2026.
Workflow activo, nodo de Telegram deshabilitado para aislar el comportamiento
del CRM. Los ocho payloads salieron de `fixtures/` sin modificar.

## Resultado

| Fixture | HTTP | Qué pasó realmente |
|---|---|---|
| `01-valido` | 200 | Contacto creado. `vid 257397661819` |
| `02-email-invalido` | **500** | HubSpot: *Email address diego.pereyra@@example is invalid* |
| `03-telefono-raro` | **500** | Rechazado por el **email con espacios**, no por el teléfono |
| `04-campos-faltantes` | **500** | *Email address null is invalid* |
| `05-duplicado-exacto` | 200 | Mismo `vid 257397661819`: HubSpot deduplicó |
| `05b-duplicado-sucio` | **500** | Rechazado. **No creó un duplicado: perdió el lead** |
| `06-inyeccion` | **500** | *Forbidden - perhaps check your credentials?* + HTML de Cloudflare |
| `07-payload-gigante` | **500** | *Bad request* / *Property values were not valid* |

**Seis de ocho envíos terminan en HTTP 500 con el cuerpo `{"message":"Error in
workflow"}`.** El visitante del formulario ve un error genérico. El lead no
queda registrado en ningún lado. No hay forma de saber qué entró ni de
reprocesarlo.

## Las tres cosas que se demuestran

### 1. El lead desaparece y nadie se entera

No es que se guarde mal: no se guarda. El dato que el visitante escribió deja
de existir en el momento en que HubSpot responde 400. No hay log con el
payload, no hay cola de reproceso, no hay alerta. Si el formulario recibe diez
leads por día y dos tienen un espacio de más en el email, son dos clientes
potenciales por día que el equipo comercial nunca ve, sin ningún síntoma
visible.

### 2. Los mensajes de error mandan a diagnosticar el lugar equivocado

Dos de los ocho casos tienen errores activamente engañosos:

- **`03` y `05b`:** se envía `  LUCIA.BENITEZ@Example.COM  ` (con espacios).
  HubSpot responde *"Email address LUCIA.BENITEZ@Example.COM is invalid"* —
  **sin los espacios**. El mensaje muestra un email que se ve válido y lo
  declara inválido. El espacio, que es la causa, no aparece por ningún lado.

- **`06`:** el payload con `<script>` y SQL no lo rechaza HubSpot, lo bloquea
  **Cloudflare** en el borde. El error que llega a n8n es *"Forbidden - perhaps
  check your credentials?"* con una página HTML de respuesta. La credencial
  está perfecta. Quien debuguee esto va a revisar la API key primero, y la API
  key no tiene nada que ver.

Esto importa comercialmente: el cliente que llama porque "la automatización
falla" ya perdió horas siguiendo estas pistas falsas.

### 3. La deduplicación del CRM no alcanza

`05` confirma que HubSpot deduplica: el duplicado exacto devolvió el mismo
`vid`, no creó un segundo contacto. Suena bien, y engaña.

Lo que la deduplicación del CRM **no** cubre:

- Los efectos secundarios. En la versión completa, cada envío dispara la
  notificación al equipo. Dos envíos, dos avisos, dos llamadas al mismo lead.
- El upsert pisa datos en silencio: el segundo envío sobreescribe el contacto
  existente. Si viene con campos vacíos, se pierde lo que había.
- `05b` muestra el límite real: con el email sucio, HubSpot ni siquiera llega a
  deduplicar. Rechaza. Y el lead se pierde.

## Lo que la versión B tiene que resolver

Derivado de lo medido, no de una lista teórica:

1. **Normalizar antes de validar.** Recortar espacios y bajar el email a
   minúsculas. Eso solo convierte `03` y `05b` de error 500 en éxito.
2. **Validar antes de llamar al CRM.** `02` y `04` no tienen por qué consumir
   una llamada a la API: se rechazan en el borde con 400 y un cuerpo que
   nombra el campo problemático.
3. **Sanitizar el contenido.** `06` ni siquiera debería salir hacia HubSpot con
   ese payload.
4. **Limitar el tamaño.** `07` se corta antes de la llamada.
5. **Deduplicar por email normalizado**, y deduplicar los efectos secundarios,
   no solo la escritura.
6. **Dead letter queue.** Lo que igual falle después de reintentos tiene que
   quedar registrado con payload, error y timestamp, para reproceso.
7. **Desacoplar la respuesta.** El visitante recibe 200 apenas el payload es
   válido, sin esperar a HubSpot.
8. **Workflow de error separado** que avise con workflow, nodo, mensaje y link
   a la ejecución.

## Cómo reproducir

```bash
docker compose up -d                 # o: n8n start
# importar casos/caso-01-lead-intake/workflow-A-naive.json
# cargar la credencial de HubSpot (App Token, service key pat-)
# activar el workflow
bash casos/caso-01-lead-intake/fixtures/enviar.sh \
  http://localhost:5678/webhook/lead-intake-naive
```
