# Fixtures

El guion de la demo. Cada archivo ejercita una rama distinta.

| Archivo | Qué prueba | Qué hace la versión A (naive) | Qué debe hacer la versión B |
|---|---|---|---|
| `01-valido.json` | Camino feliz | Crea el contacto | Crea el contacto |
| `02-email-invalido.json` | Email sintácticamente roto | Lo escribe igual en el CRM | Rechaza con 400 y cuerpo explicativo |
| `03-telefono-raro.json` | Formato de teléfono local, espacios, mayúsculas | Guarda el dato sucio tal cual | Normaliza a E.164, recorta strings, baja el email a minúsculas |
| `04-campos-faltantes.json` | Faltan email y teléfono | Rompe o crea un contacto inútil | Rechaza con 400 nombrando los campos faltantes |
| `05-duplicado.json` | Reenvío idéntico de `01` | Crea un segundo contacto | Detecta el duplicado y no lo crea de nuevo |
| `06-inyeccion.json` | HTML/JS, SQL y fórmula de planilla en campos de texto | Lo escribe crudo donde caiga | Sanitiza antes de escribir en cualquier sistema |
| `07-payload-gigante.json` | Campo de 1 MB | Lo intenta mandar entero | Rechaza por tamaño antes de llamar al CRM |

## Nota sobre `06-inyeccion.json`

El campo `company` arranca con `=`. Si el destino es una planilla, eso se
evalúa como fórmula al abrirla: es inyección de fórmula (CSV injection), no
solo XSS. Entra en la demo porque la dead letter queue del caso escribe en
Google Sheets.

## Datos

Todos los nombres, emails y teléfonos son inventados. Cero datos reales.
