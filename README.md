# Portafolio de automatización n8n

Workflows de n8n que aguantan el mundo real: validación, deduplicación,
reintentos, colas de reproceso y manejo de errores.

Cada caso se entrega en dos versiones del mismo flujo:

- **A (naive)** — lo que sale de seguir un tutorial. Funciona en la demo feliz.
- **B (robusta)** — el mismo resultado de negocio, aguantando lo que pasa de verdad.

Y los dos se miden contra los mismos payloads. El valor no está en el diagrama:
está en la tabla de resultados.

## Casos

| Caso | Qué resuelve | Estado |
|---|---|---|
| [caso-01 · lead intake](casos/caso-01-lead-intake/) | Captura de leads de un formulario web hacia un CRM, sin perder ninguno | Workflows corriendo y medidos |

## Resultado del caso-01, en una línea

Los mismos ocho payloads contra las dos versiones:

- **A:** seis de ocho terminan en `HTTP 500` genérico. El lead desaparece sin rastro.
- **B:** ningún `500`. Cada rechazo nombra el campo y el motivo, y lo que igual falla queda en una cola de reproceso.

Detalle en [resultados-A-vs-B.md](casos/caso-01-lead-intake/resultados-A-vs-B.md).

## Cómo levantarlo

### Requisitos

- Docker, **o** Node 24 o superior (n8n 2.44.6 requiere `node >=24.0.0`)
- Una cuenta gratuita de HubSpot
- Un bot de Telegram (opcional: solo para las notificaciones)

### Con Docker

```bash
cp .env.example .env
# completar N8N_ENCRYPTION_KEY con:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
docker compose up -d
```

Verificado el 23/10/2026 contra Docker 29.9.2 sobre WSL2: la imagen baja, el
contenedor levanta, `/healthz` responde `200`, las variables del `.env` llegan
adentro del contenedor y el volumen de `casos/` queda montado. Los tres
workflows importan por API y la ruta de validación devuelve los mismos códigos
que la instalación por Node.

### Con Node

```bash
npm install -g n8n@2.44.6
cp .env.example .env
# completar N8N_ENCRYPTION_KEY igual que arriba
set -a && . ./.env && set +a && n8n start
```

n8n queda en `http://localhost:5678`. En el primer arranque pide crear una
cuenta dueña; es local, no sale de tu máquina.

### Importar los workflows

Desde la interfaz de n8n, o por API con una key creada en
*Settings → n8n API*:

```bash
curl -X POST "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  --data-binary @casos/caso-01-lead-intake/workflow-B-robusto.json
```

El caso-01 tiene su propio [README](casos/caso-01-lead-intake/README.md) con
los pasos completos, incluidas las credenciales y la tabla de la cola de
reproceso.

## Verificar sin levantar nada

La lógica de normalización y validación se prueba sin n8n:

```bash
node casos/caso-01-lead-intake/test-normalizacion.js
node kb/snippets/sanitizar-texto.js
node kb/snippets/telefono-e164.js
```

El primero extrae el código del nodo directamente del workflow JSON, así que
no puede quedar desfasado del workflow.

## Estructura

```
casos/      Un directorio por caso: workflows, fixtures, resultados medidos y demo
kb/         Conocimiento reutilizable: patrones, gotchas por servicio y snippets
venta/      Material comercial
```

El [knowledge base](kb/README.md) es el activo real. Los gotchas son hallazgos
de romper cosas y leer el error, no de leer documentación — por ejemplo, que
HubSpot recorta los espacios en sus mensajes de error y te muestra un email que
parece válido diciéndote que es inválido.

## Qué no es esto

No es un producto ni una plantilla para vender. Es material para demostrar
cómo se construye y cómo se entrega. Los workflows están pensados para leerse
y discutirse, no para instalarse a ciegas.
