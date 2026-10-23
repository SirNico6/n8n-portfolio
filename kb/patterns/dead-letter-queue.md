# Dead letter queue

## Qué problema resuelve

Lo que falla después de los reintentos desaparece. Nadie sabe qué entró, ni
cuántos, ni por qué, ni puede reprocesarlo.

Medido en el caso-01: la versión naive pierde seis de ocho envíos. El visitante
ve un `500` genérico y el dato deja de existir. Si el formulario recibe diez
leads por día y dos fallan, son dos clientes potenciales diarios que nadie ve,
sin ningún síntoma visible.

## Cuándo aplicarlo

En todo workflow que escriba en un sistema externo. Si la respuesta del
servicio puede fallar y el dato de entrada no está guardado en otro lado, hace
falta una DLQ.

No hace falta si el origen del dato es recuperable (una tabla que podés volver
a leer). Sí hace falta si el dato llegó por webhook y es efímero: ese es el
caso de cualquier formulario.

## El patrón

En el nodo que llama al servicio externo:

```json
{
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000,
  "onError": "continueErrorOutput"
}
```

`continueErrorOutput` agrega una segunda salida al nodo. La salida 0 es el
camino feliz; la salida 1 recibe lo que falló después de agotar los reintentos.
Esa salida va a la DLQ.

Qué guardar, como mínimo:

| Columna | Por qué |
|---|---|
| `received_at` | Para ordenar y para saber cuánto hace que está trabado |
| `email` (o la clave de negocio) | Para buscar sin leer el payload |
| `payload` | El dato original crudo. Sin esto no podés reprocesar |
| `error_message` | Qué dijo el servicio |
| `error_node` | Qué paso falló |
| `execution_id` | Para abrir la ejecución completa en n8n |

## Dónde guardarla

En n8n 2.x, **data tables nativas** (`n8n-nodes-base.dataTable`). Cero
credenciales externas, cero cuentas que crear, y se consulta desde la API.

Crear la tabla una vez:

```bash
curl -X POST "$N8N_API_URL/data-tables" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"lead_dead_letter","columns":[
        {"name":"received_at","type":"string"},
        {"name":"email","type":"string"},
        {"name":"payload","type":"string"},
        {"name":"error_message","type":"string"},
        {"name":"error_node","type":"string"},
        {"name":"execution_id","type":"string"},
        {"name":"workflow_name","type":"string"}]}'
```

Google Sheets o Airtable sirven igual y tienen una ventaja: el cliente puede
mirar la tabla sin entrar a n8n. La desventaja es una credencial más. Para un
entregable a cliente, preguntar quién va a mirar esa cola.

**Si la DLQ escribe en una planilla, sanitizar las fórmulas antes.** Un campo
que arranca con `=` se evalúa al abrir el archivo. Ver
`kb/snippets/sanitizar-texto.js`.

## Lo que la DLQ no arregla

No mejora un mensaje de error mal redactado por un tercero. En el caso-01, la
fila guardada dice `Forbidden - perhaps check your credentials?`, que es
engañoso: el problema era el WAF, no la credencial.

Lo que la DLQ garantiza es que ese error quede **escrito en algún lado** en vez
de evaporarse. Interpretarlo sigue siendo trabajo humano. Por eso el campo
`payload` es el más importante de la tabla: con el dato original se puede
reconstruir qué pasó aunque el mensaje mienta.

## Cómo verificar que funciona

Forzar un fallo real y mirar que la fila aparezca:

```bash
curl -X POST "$N8N_API_URL/../webhook/lead-intake" \
  -H 'Content-Type: application/json' \
  --data-binary @fixtures/06-inyeccion.json

curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_API_URL/data-tables/<id>/rows?limit=5"
```

Una DLQ que nunca se probó con un fallo real no es una DLQ: es un nodo que
nadie ejecutó nunca.
