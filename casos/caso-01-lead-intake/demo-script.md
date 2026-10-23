# Guion de demo — caso 01

Video de 4 minutos. Pantalla grabada, sin cara, sin música, sin intro animada.

**La regla:** nada de esto se cuenta. Todo se muestra pasando en vivo. Si un
momento no se puede mostrar, no va.

## Antes de grabar

- [ ] n8n corriendo, los tres workflows publicados
- [ ] HubSpot abierto en *Contacts*, ordenado por fecha de creación descendente
- [ ] La tabla `lead_dead_letter` **vacía** (`clear` desde el nodo o la API)
- [ ] Contactos de prueba borrados de HubSpot, salvo los dos de ejemplo
- [ ] Terminal con fuente grande, en el directorio del caso
- [ ] Telegram a la vista si las notificaciones están configuradas
- [ ] Dos ventanas: terminal a la izquierda, navegador a la derecha

Ensayalo una vez entero antes de grabar. El valor está en el ritmo, no en el
contenido: el contenido ya está medido.

---

## 0:00 – 0:25 · El gancho

**En pantalla:** el workflow A en el canvas de n8n. Cuatro nodos, prolijo.

**Decís:**

> Este es el flujo de captura de leads más común que existe. Formulario,
> mapear campos, CRM, aviso al equipo. Cuatro nodos. Funciona.
>
> Le voy a mandar ocho formularios reales. No inventados: reales. Un email con
> un espacio de más, alguien que apretó Enviar dos veces, un campo vacío.
>
> Mirá cuántos llegan.

No menciones todavía que hay una segunda versión.

---

## 0:25 – 1:20 · Romper A en vivo

**Hacés:**

```bash
bash fixtures/enviar.sh http://localhost:5678/webhook/lead-intake-naive
```

**En pantalla:** la salida corriendo. Se ve `HTTP 500` seis veces.

**Decís, mientras corre:**

> Doscientos. Quinientos. Quinientos. Quinientos. Doscientos. Quinientos.
> Quinientos. Quinientos.
>
> Seis de ocho. Y fijate el cuerpo del error: `Error in workflow`. Eso es todo
> lo que recibe el formulario. Eso es todo lo que ve el visitante.

**Pausá un segundo sobre la salida.** Que se lea.

---

## 1:20 – 2:00 · Dónde fue a parar el lead

**En pantalla:** HubSpot, lista de contactos. Hay un contacto nuevo. Uno.

**Decís:**

> Ocho personas completaron el formulario. En el CRM hay una.

**Cambiás a n8n → Executions de A.** Abrís la ejecución del fixture `03`.
Hacés zoom en el nodo rojo de HubSpot.

**Decís:**

> Acá está el mejor de todos. El email que entró fue —señalás el input—
> `espacio espacio L-U-C-I-A punto B-E-N-I-T-E-Z arroba...`, con espacios
> adelante y atrás.
>
> Y el error que devuelve HubSpot dice: *Email address LUCIA.BENITEZ@Example.COM
> is invalid*. Sin los espacios.
>
> O sea: te muestra un email que se ve perfectamente válido y te dice que es
> inválido. El espacio, que es la causa, no aparece en ningún lado del mensaje.
>
> Si te llaman por esto, vas a mirar el email, lo vas a ver bien, y vas a
> perder una hora buscando en el lugar equivocado.

**Esta es la parte más importante del video.** No la apures.

---

## 2:00 – 2:20 · El giro

**Decís, sin cambiar de pantalla:**

> Ahora. Nada de lo que viene cambia el CRM. Es la misma HubSpot, la misma
> cuenta, los mismos ocho formularios.
>
> Lo único distinto es el workflow.

---

## 2:20 – 3:10 · Los mismos ocho contra B

**En pantalla:** el canvas de B. Dejalo dos segundos: se ve que tiene más
nodos, pero no lo expliques nodo por nodo. A nadie le importa.

**Hacés:**

```bash
bash fixtures/enviar.sh http://localhost:5678/webhook/lead-intake
```

**En pantalla:** la salida. Ningún `500`.

**Decís:**

> Ningún quinientos.
>
> Los que entran, entran. Los que se rechazan, se rechazan diciendo por qué
> —señalás— `email invalido: diego.pereyra@@example`. `falta el campo
> requerido: email`. `payload demasiado grande`.
>
> Eso es un error que le sirve a alguien.

---

## 3:10 – 3:35 · El duplicado, que es el argumento

**En pantalla:** n8n → Executions de B → la ejecución del fixture `05b`.
Abrís el nodo *Descartar duplicados*. **Mostrás que la salida es 0 items.**

**Decís:**

> Este es el mismo lead de antes, pero escrito distinto: mayúsculas y espacios.
>
> En la versión anterior esto daba error quinientos y el lead desaparecía.
> Acá el nodo de deduplicación lo reconoció como repetido. Salida: cero.
>
> No se cargó dos veces. Y no le van a llamar dos veces.
>
> ¿Qué cambió? Que alguien recortó un espacio antes de preguntar.

---

## 3:35 – 4:00 · Lo que igual falla

**En pantalla:** la tabla `lead_dead_letter` con sus filas.

**Decís:**

> Y este es el que igual falló. Un payload con código adentro, que el CRM
> bloquea. En la versión anterior se evaporaba.
>
> Acá está: el email, el payload completo, qué nodo falló, y el link a la
> ejecución.
>
> No es que nada falle. Es que nada se pierde.

Si Telegram está configurado, mostrá la alerta llegando, con el link.

---

## 4:00 – 4:20 · Cierre

**En pantalla:** la tabla A vs B de `resultados-A-vs-B.md`.

**Decís:**

> Seis de ocho contra cero de ocho. Mismos datos, mismo CRM.
>
> Si tenés una automatización que funciona casi siempre, esa es la que quiero
> ver. Mandame qué se rompe y te digo si lo puedo arreglar.

**Cortá ahí.** Sin "suscribite", sin logo, sin pantalla final.

---

## Notas de edición

- **Sin música.** Compite con la voz y el contenido no la necesita.
- **Cortá los tiempos muertos.** Cada `curl` que tarda dos segundos, cortalo.
  Pero **no cortes la salida de los fixtures**: que se vea corriendo de verdad
  es la prueba de que no está armado.
- **Zoom donde importa.** Tres momentos: el mensaje de error de HubSpot sin los
  espacios, la salida `0` del nodo de deduplicación, la fila de la cola. Esos
  tres planos son el video.
- **Sin texto en pantalla**, salvo subtítulos. Los carteles con flechas hacen
  que parezca anuncio.
- **Mostrá los errores que quedan.** No edites el `500` del fixture de
  inyección en B. Que la versión robusta también tenga un caso que falla es lo
  que hace creíble al resto.

## Versión corta de 60 segundos

Para publicar suelto o mandar en una propuesta:

1. `0:00-0:10` — "Ocho formularios reales contra un flujo de captura de leads normal."
2. `0:10-0:25` — La corrida de A. Seis `500` pasando.
3. `0:25-0:40` — El error de HubSpot sin los espacios. Zoom.
4. `0:40-0:55` — La corrida de B. Ningún `500`.
5. `0:55-1:00` — "Mismo CRM, mismos datos. Lo único distinto es el workflow."
