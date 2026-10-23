# Knowledge Base

El activo real del proyecto. La velocidad de entrega del proyecto N+1 depende
de lo que quedó escrito en el proyecto N. Alimentarlo no es documentación
opcional: es la mitad del trabajo.

## Estructura

**`patterns/`** — un archivo por patrón reutilizable. Qué problema resuelve,
cuándo aplicarlo, el JSON del fragmento, y cómo verificar que funciona.

**`gotchas/`** — un archivo por servicio o API. Esto es lo que vale oro y lo
que la competencia no tiene: autenticación y sus trampas, límites de rate y qué
devuelven cuando se exceden, cómo paginan, qué campos son obligatorios aunque
la doc diga que no, qué errores son transitorios y cuáles permanentes.
Una línea por hallazgo, con fecha.

**`snippets/`** — código de nodos Code listo para pegar.

## Regla de mantenimiento

Al cerrar cada caso o cada trabajo pagado, antes de dar por terminado:
**toda sorpresa encontrada se escribe acá.** Si algo falló de una manera que no
estaba documentada, esa es la entrada más valiosa del día.

## Idioma

KB y skill en español: son internos. Lo que ve el cliente, en inglés.
