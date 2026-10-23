# Fixtures

El guion de la demo. Cada archivo ejercita una rama distinta.

| Archivo | Qué prueba | Versión A (naive) | Versión B (robusta) |
|---|---|---|---|
| `01-valido.json` | Camino feliz | Crea el contacto | Crea el contacto |
| `02-email-invalido.json` | Email sintácticamente roto | Lo manda igual a HubSpot | Rechaza con 400 y cuerpo explicativo |
| `03-telefono-raro.json` | Teléfono local, espacios, mayúsculas | Guarda el dato sucio tal cual | Normaliza a E.164, recorta, baja a minúsculas |
| `04-campos-faltantes.json` | Faltan email y teléfono | Rompe: HubSpot exige email | Rechaza con 400 nombrando los campos faltantes |
| `05-duplicado-exacto.json` | Reenvío idéntico de `01` | HubSpot deduplica el contacto, **pero la notificación se dispara igual** | Detecta el duplicado: ni escritura ni notificación |
| `05b-duplicado-sucio.json` | Mismo lead, email con espacios y mayúsculas | **Crea un segundo contacto**: HubSpot deduplica por string exacto | Normaliza primero, después deduplica: un solo contacto |
| `06-inyeccion.json` | HTML/JS, SQL y fórmula de planilla | Lo escribe crudo donde caiga | Sanitiza antes de escribir |
| `07-payload-gigante.json` | Campo de 1 MB | Lo intenta mandar entero | Rechaza por tamaño antes de llamar al CRM |

## Por qué hay dos fixtures de duplicado

Porque el nodo de HubSpot no tiene `create`, solo `upsert`: el CRM ya
deduplica por email. Un duplicado exacto no produce dos contactos, y si la
demo usara solo ese caso, la versión naive parecería correcta.

Los dos juntos cuentan la historia real:

- **`05`** muestra que deduplicar el registro no alcanza: los efectos
  secundarios igual se duplican y el equipo llama dos veces al mismo lead.
- **`05b`** muestra que la deduplicación del CRM es por string exacto, así que
  alcanza con no normalizar el email para que duplique igual. El cliente culpa
  al CRM; la culpa era del workflow.

Detalle en `kb/gotchas/hubspot.md`.

## Nota sobre `06-inyeccion.json`

El campo `company` arranca con `=`. Si el destino es una planilla, eso se
evalúa como fórmula al abrirla: es inyección de fórmula (CSV injection), no
solo XSS. Entra en la demo porque la dead letter queue escribe en Google Sheets.

## Datos

Todos los nombres, emails y teléfonos son inventados. Cero datos reales.
