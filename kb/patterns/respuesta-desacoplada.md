# Respuesta desacoplada del procesamiento

## Qué problema resuelve

El visitante del formulario ve un error porque un sistema interno está lento o
caído. El CRM no es problema del visitante.

Medido en el caso-01: con la respuesta acoplada, cada fallo de HubSpot se
convierte en un `500` en la cara de quien completó el formulario. Seis de ocho
envíos.

Y al revés: si el CRM tarda ocho segundos, el formulario queda ocho segundos
colgado. El visitante aprieta "Enviar" de nuevo. Ahí nace el duplicado.

## Cuándo aplicarlo

Siempre que un humano o un sistema externo esté esperando la respuesta del
webhook. Si el llamador es un cron o una cola interna, no hace falta.

## El patrón

En el nodo Webhook:

```json
{ "httpMethod": "POST", "path": "lead-intake", "responseMode": "responseNode" }
```

`responseMode: responseNode` deja que un nodo **Respond to Webhook** mande la
respuesta, y **la ejecución sigue después de ese nodo**. Esa es la clave: todo
lo que cuelga aguas abajo del Respond ya no afecta al llamador.

Estructura:

```
Webhook -> Normalizar y validar -> IF valido?
                                    |- si -> Respond 202 -> dedup -> CRM -> ...
                                    |- no -> Respond 400 con el detalle
```

El `202 Accepted` es el código correcto, no `200`: dice "lo recibí y lo voy a
procesar", que es exactamente lo que pasó. `200` promete que ya está hecho.

La rama inválida responde `400` **antes** de tocar nada, con el motivo:

```js
// responseBody del Respond 400
={{ JSON.stringify({ status: "rejected", errors: $json.errors }) }}
```

Un `400` que nombra el campo le sirve al que integra. Un `500` genérico no le
sirve a nadie.

## El costo, dicho de frente

Desacoplar significa que el llamador recibe `202` y **todavía no sabés si el
CRM lo aceptó**. Eso es correcto, pero obliga a lo otro:

- Si después falla, tiene que ir a la dead letter queue. Un `202` sin DLQ es
  una mentira: le dijiste al visitante que lo recibiste y después lo perdiste.
- Alguien tiene que mirar esa cola, o recibir una alerta.

**Este patrón no se implementa solo.** Va siempre con `dead-letter-queue`.

## Cómo verificar que funciona

Cortar el servicio externo a propósito (credencial inválida, o el host
apuntando a un puerto muerto) y mandar un payload válido. El webhook tiene que
devolver `202` igual, y la fila tiene que aparecer en la DLQ.

Si el webhook devuelve `500` cuando el CRM está caído, el desacople no está
funcionando: lo más probable es que el `responseMode` haya quedado en
`lastNode`.
