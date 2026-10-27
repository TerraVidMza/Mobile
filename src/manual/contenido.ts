/**
 * Manual de la app de campo — M-022.
 *
 * Es la fuente del manual del Capataz: la Web copia estas secciones en
 * `Web/src/features/ayuda/manual/contenido/capataz.md` y agrega las de la
 * Web. Si cambia algo acá, hay que actualizar también esa copia.
 *
 * Las secciones con `{permiso}` solo se muestran a quien lo tiene. Las
 * capturas se regeneran con `scripts/manual/capturas-manual.mjs`.
 */

export const VERSION_MANUAL = '27/10/2026';

export const MANUAL_APP = `
## Para qué sirve la app

La app de TerraVid es la herramienta de campo: con ella registrás **las labores** que se hacen en cada cuartel (poda, pulverización, riego…), **los insumos** que se usaron y **los pesajes** de la vendimia.

Todo se guarda primero **en el teléfono**, así que podés trabajar sin señal. Cuando el teléfono vuelve a tener conexión, los registros se envían solos al sistema y la oficina los ve en la Web.

> **Importante:** la app no muestra costos ni tarifas. Esos datos los maneja la oficina.

## Ingresar a la app

![Pantalla de ingreso](movil-login.jpg)

1. Abrí la app **TerraVid**.
2. Escribí tu **Email** y tu **Contraseña**. Con el ícono del ojo podés ver lo que escribiste.
3. Tocá **Iniciar sesión**.

Al entrar, la app descarga las fincas, los cuarteles, las cuadrillas, los tipos de labor y los insumos. **Esperá unos segundos con señal** antes de salir al campo: sin esa descarga los formularios aparecen vacíos.

> **La primera vez necesitás conexión.** Después, aunque cierres la app, la sesión queda guardada y podés abrirla sin señal.

### Si no podés entrar

- **Email o contraseña incorrectos**: revisá lo que escribiste. Si no recordás la contraseña, tocá **¿Olvidaste tu contraseña?** y seguí el enlace que te llega por correo.
- **Cuenta bloqueada por demasiados intentos**: después de 5 intentos fallidos hay que esperar 15 minutos.
- **Tu rol no tiene acceso a la app móvil**: tu usuario no es de campo. Pedile al Propietario que revise tu rol.
- **Cambiá tu contraseña**: si te dieron una contraseña temporal, la app te pide una nueva antes de seguir.

## La pantalla de inicio

![Pantalla de inicio](movil-inicio.jpg)

- **Estado de conexión**: arriba dice **Conectado** o **Sin conexión — Modo offline**, y cuántos registros quedan pendientes de enviar.
- **Acciones rápidas**: **Registrar labor** y **Registrar pesaje** abren directamente el formulario.
- **Resumen del día**: los kilos pesados hoy, las labores de hoy y el **avance de la campaña** contra la meta de cosecha.
- **Ajustes**: huella, modo solar y respaldo (ver más abajo).
- **Cerrar sesión**: al final de la pantalla.

Abajo está la barra con las pestañas **Inicio**, **Labores**, **Pesaje**, **Avisos** y **Ayuda**. Si hay registros sin enviar, la pestaña **Labores** muestra un número rojo.

## Registrar una labor {laboresRegistro}

![Formulario de nueva labor](movil-nueva-labor.jpg)

1. Tocá la pestaña **Labores** y después **+ Nueva Labor** (o **Registrar labor** desde el inicio).
2. Elegí la **Finca**, el **Cuartel** y el **Tipo de labor**. Al elegir la labor, el campo de cantidad muestra en qué se mide (jornales, horas, hectáreas).
3. La **Fecha** viene con el día de hoy. Cambiala solo si cargás algo de otro día.
4. Escribí la **Cantidad realizada**.
5. Si se usaron insumos, en **Insumos utilizados** elegí el insumo, escribí la cantidad y tocá **+**. Podés agregar varios; con el ícono de la papelera sacás uno.
6. Tocá **Guardar (Local)**.

![Labor completa con un insumo](movil-nueva-labor-completa.jpg)

Vas a ver el aviso **Labor guardada: el registro se guardó en el teléfono y se sincroniza automáticamente**. Si tenés señal, se envía en el momento; si no, queda pendiente.

> La app guarda también **la ubicación del teléfono** al registrar, para que la oficina vea dónde se hizo el trabajo. Si el teléfono no da la ubicación, el registro se guarda igual.

## Consultar tus labores {laboresRegistro}

![Labores del día](movil-labores-con-nueva.jpg)

La pestaña **Labores** tiene tres vistas:

- **Hoy**: lo que registraste hoy.
- **Pendientes**: lo que todavía no se envió al sistema.
- **Historial**: todo lo registrado en el teléfono, con filtro por finca y cuartel.

Cada registro muestra la labor, la finca y el cuartel, la cantidad, los insumos y su estado: **Sincronizado** o **Pendiente**.

### Detalle de una labor

Tocá un registro para ver el detalle. Si todavía no se envió:

- **Sincronizar ahora** intenta enviarlo en el momento.
- **Eliminar registro** lo borra del teléfono (pide confirmación). Solo se pueden borrar los que todavía no se enviaron.

Si el sistema lo rechazó, arriba aparece un recuadro rojo **No se pudo sincronizar** con el motivo y la cantidad de intentos. El registro **no se pierde**: queda pendiente y se reintenta solo.

![Detalle de una labor](movil-labor-detalle.jpg)

> **Motivo frecuente: No hay costo vigente para el tipo de labor a la fecha.** La oficina todavía no cargó el costo de esa labor para ese día. Avisale al Propietario o al Agrónomo.

## Registrar un pesaje {pesajesRegistro}

![Formulario de nuevo pesaje](movil-nuevo-pesaje.jpg)

1. Tocá la pestaña **Pesaje** y después **+ Nuevo Pesaje** (o **Registrar pesaje** desde el inicio).
2. Elegí la **Finca**, la **Cuadrilla** y el **Cuartel**.
3. Revisá la **Fecha** (viene con hoy).
4. Escribí el **Total cosechado (kg)**.
5. Tocá **Guardar Pesaje (Local)**.

Vas a ver el aviso **Pesaje guardado**. Igual que las labores, el pesaje se envía solo cuando hay señal.

> Si una cuadrilla nueva no aparece en la lista, abrí la app con señal para que se actualicen los datos. Las cuadrillas las da de alta la oficina o el capataz desde la Web.

## Consultar tus pesajes {pesajesRegistro}

![Pesajes del día](movil-pesajes-con-nuevo.jpg)

La pestaña **Pesaje** muestra arriba el **Total cosechado hoy** y tiene tres vistas:

- **Hoy**: los pesajes del día, con cuadrilla, cuartel y kilos.
- **Pendientes**: los que todavía no se enviaron.
- **Por cuadrilla**: el total de kilos de cada cuadrilla.

Después de enviados, la oficina agrupa los pesajes en un **remito** para la bodega. Si un remito se rechaza, te llega un aviso con el motivo.

## Trabajar sin señal y sincronizar

La app está pensada para el campo: **todo lo que registrás se guarda primero en el teléfono**.

- Sin conexión, arriba aparece **Sin conexión a internet. Los registros se guardarán en tu dispositivo y se sincronizarán al recuperar señal.**
- Cuando vuelve la señal, la app envía sola lo pendiente en pocos segundos.
- Mientras haya registros sin enviar, aparece la franja **N pendientes — Tocar para sincronizar**. Tocala para enviarlos en el momento.

> **No borres la app ni cierres sesión con registros pendientes**: se perderían. Antes, esperá a tener señal o hacé un **Respaldo** (ver Ajustes).

## Avisos

![Avisos](movil-avisos.jpg)

En la pestaña **Avisos** llegan las novedades que te tocan: por ejemplo, cuando la oficina **aprueba o rechaza un remito** con tus pesajes. El rechazo trae el motivo.

- Los avisos nuevos tienen la marca **Nueva**. Tocá **Marcar leída** en cada uno o **Marcar todas como leídas**.
- Si el teléfono tiene las notificaciones activadas para TerraVid, los avisos también llegan aunque la app esté cerrada.

## Ajustes: huella, modo solar y respaldo

Están en la pantalla de **Inicio**, abajo:

- **Desbloqueo con huella**: al abrir la app te pide la huella en vez de la contraseña. Si no te reconoce, tocá **Desbloquear** para reintentar o **Ingresar con contraseña**.
- **Modo solar**: alto contraste para leer la pantalla bajo el sol.
- **Respaldo**: tocá **Exportar** para guardar o compartir un archivo con **todos los registros del teléfono, incluidos los no enviados**. Usalo si vas a cambiar de teléfono o si un registro no se puede enviar.

## Pedir ayuda

Si algo no funciona y el manual no lo explica:

1. Entrá a la pestaña **Ayuda** y tocá **Pedir ayuda** al final.
2. Elegí **en qué parte** pasó (labores, pesajes, acceso…).
3. Contá **qué pasó**: qué estabas haciendo, qué esperabas y qué pasó en su lugar (al menos 10 caracteres).
4. Tocá **Enviar pedido**. Necesita conexión.

El pedido llega al correo de soporte de tu empresa, con la versión de la app.

## Preguntas frecuentes

**Los selectores de finca, cuartel o labor aparecen vacíos.**
La app no terminó de descargar los datos. Conectate a internet, volvé a **Inicio** y esperá unos segundos. Si sigue igual, cerrá sesión y volvé a entrar con señal.

**Registré algo sin señal. ¿Se perdió?**
No. Queda en el teléfono como **Pendiente** y se envía solo cuando vuelve la conexión. Lo ves en **Labores → Pendientes** o **Pesaje → Pendientes**.

**Un registro dice "No se pudo sincronizar".**
Abrí el detalle para ver el motivo. Si dice **No hay costo vigente** o algo de la tarifa, avisale a la oficina: lo tienen que cargar ellos. El registro se reintenta solo.

**Me equivoqué en un registro.**
Si todavía no se envió, abrilo y tocá **Eliminar registro**, y cargalo de nuevo. Si ya se envió, avisale al Agrónomo o al Propietario.

**No me aparece una cuadrilla, un cuartel o una labor nueva.**
La app actualiza los datos al entrar y al volver la señal. Abrila con conexión y esperá unos segundos.

**Cambié de teléfono.**
Antes, en el teléfono viejo, esperá a que no queden pendientes (o hacé un **Respaldo**). Después instalá la app en el nuevo y entrá con tu email y contraseña.
`;
