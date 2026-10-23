---
name: n8n-delivery
description: Cómo se construye y se entrega en este repo. Convenciones de workflows n8n, checklist de entrega, estructura de la documentación al cliente y regla de cotización. Usar antes de construir o entregar cualquier workflow.
---

# n8n delivery

Esto no es conocimiento sobre n8n (eso vive en `kb/`). Esto es **cómo se
trabaja acá**.

## Antes de construir

Revisar `kb/gotchas/` del servicio que vas a integrar. Si no hay archivo, se
crea al terminar.

## Convenciones de construcción

- **Nombres de nodos:** qué hace, no qué nodo es. `Validar payload`, no `Code1`.
- **Validación primero.** Entra algo → se valida antes de tocar cualquier
  sistema externo. Un webhook público sin validación es una vulnerabilidad.
- **Manejo de errores siempre.** Ningún workflow se da por terminado sin un
  camino de error explícito y un Error Trigger que notifique.
- **Nada de credenciales hardcodeadas.** Van en credenciales de n8n, nunca en
  nodos Code ni en URLs.
- **Nodo nativo antes que nodo Code.** El Code se justifica cuando no hay nativo.
- **Un workflow hace una cosa.** El manejo de errores va en workflow separado.

## Checklist de entrega

- [ ] Corre de punta a punta con datos reales de prueba
- [ ] Falla de forma controlada ante payload inválido, servicio caído y rate limit
- [ ] Nada se pierde: lo que falla después de reintentos queda registrado
- [ ] El cliente puede ver qué pasó con cada ejecución
- [ ] Sin credenciales en el JSON exportado
- [ ] Documentación entregada (ver abajo)

## Qué recibe el cliente

Nunca JSON crudo sin explicación. El entregable es:

1. **Workflow Design & Integration Mapping** — qué nodos, qué integraciones, cómo fluye el dato
2. **Process Flow Diagram** — el flujo en visual
3. **Testing Notes & Validation Checklist** — qué escenarios se probaron, resultados, limitaciones conocidas
4. **Handover Summary** — setup, configuración de credenciales, cómo activarlo, mantenimiento
5. **JSON importable** del workflow terminado

Esta lista no es invento: es la que piden textualmente los clientes buenos de
Upwork. Copiarla es alinear el entregable con lo que el mercado ya pide.

## Cotización

**Precio fijo por alcance fijo. Nunca por hora.** Por hora se paga la lentitud
y se castiga la velocidad, que es justamente la ventaja.

Para cotizar:
1. Descomponer el pedido en entregables concretos y enumerables
2. Escribir explícitamente qué **no** incluye
3. Definir qué cuenta como cambio de alcance y qué se cobra aparte
4. Si no se puede acotar, el primer entregable es un diagnóstico pago acotado

## Idioma

Código, commits y documentación interna en español. Todo lo que ve el cliente,
en inglés.
