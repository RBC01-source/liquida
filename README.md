# Liquida — sitio estático

## Publicar en GitHub Pages
1. Crea un repositorio nuevo (por ejemplo `liquida`) y sube todo el contenido de esta carpeta a la raíz.
2. En el repositorio: Settings → Pages → Source: "Deploy from a branch" → rama `main`, carpeta `/ (root)`.
3. La dirección será `https://TU-USUARIO.github.io/liquida/`.

## Antes de publicar (config.json, en el proyecto que genera el sitio)
- `base_url`: tu dirección final (afecta sitemap y canonical).
- `form_endpoint`: URL de un servicio de formularios (Formspree, Getform, etc.) que recibe correos por POST JSON. Si queda vacío, usa `contact_email` (abre el correo del visitante).
- `goatcounter_code`: código gratuito de goatcounter.com para medir visitas sin cookies (opcional).

## Después
- Envía `sitemap.xml` a Google Search Console.
- Revisa las cifras (RMV, UIT) cada año y cuando salga un decreto.

## Cobrar Premium con códigos de acceso
Premium se vende con pago manual: el cliente paga por tu enlace de pago, tú le envías un **código de acceso** y él lo pega en la calculadora («Plan Gratis» → «Ya tengo un código»).

Cada código es `LQ1.<datos>.<firma>`. Los datos son el correo, el plan (`mensual` o `anual`) y el último día de uso; la firma es ECDSA P-256. La calculadora solo contiene la **clave pública**, que sirve para comprobar firmas pero no para crear códigos. La clave **privada** queda únicamente en tu computador, así que nadie puede fabricar códigos viendo el código del sitio. El código se vuelve a verificar cada vez que se abre la página y deja de valer al pasar su fecha de vencimiento.

**Puesta en marcha (una sola vez)**
1. Descarga `herramientas/generador-codigos.html` y ábrelo con doble clic en tu computador (funciona sin conexión).
2. En «1. Crear mis claves» toca **Crear mis claves**. Se descarga `liquida-clave-privada.json`: guárdalo en un lugar seguro (nube privada + USB). **No lo subas a GitHub ni lo compartas.** Si lo pierdes hay que crear claves nuevas y los códigos anteriores dejan de funcionar.
3. Copia la **clave pública** que aparece en pantalla y pégala en `calculadora.html`, en `window.LIQUIDA_LIC`, en el campo `"pub"` (hoy dice `null`).
4. En el mismo bloque, agrega tus enlaces de pago en `"pay"` (`mensual` y `anual`, deben empezar con `https://`) y, si quieres, tu número de WhatsApp en `"whatsapp"` (con código de país, solo dígitos, por ejemplo `51999888777`).

Si cobras por Yape o Plin, deja `"pay"` vacío y llena `"yape"` (y `"whatsapp"`) con tu número, con código de país y solo dígitos: la hoja de Premium mostrará el monto y el número, y el cliente te enviará el comprobante por WhatsApp.

Mientras `"pub"` sea `null`, Premium sigue en **modo demo** (el botón lo activa gratis). Al poner la clave, el cobro queda activo y el Premium de prueba que cualquiera tenía guardado deja de valer.

**Cada venta**
1. El cliente paga y te avisa (correo o WhatsApp).
2. Abre el generador, elige tu archivo de clave privada (paso 2), escribe el correo del cliente, el plan y el vencimiento (31 días el mensual, 366 el anual, editable) y toca **Generar código**.
3. Copia el **mensaje completo** y envíaselo al cliente: ya incluye el código y las instrucciones.
4. Para renovar, emite un código nuevo; el cliente lo pega en «Tengo un código nuevo (renovar)».

**Límites a tener en cuenta**
- Un código se puede compartir con otras personas (lleva el correo del cliente, pero la calculadora no lo exige). Con códigos de 31 días el daño es acotado.
- No se pueden revocar códigos antes de su vencimiento. Si hay un reembolso, el código sigue valiendo hasta su fecha.
- La fecha se compara con el reloj del dispositivo del cliente.
- Para suscripciones automáticas, cuentas de usuario y revocación hace falta un servidor (ver siguiente paso del plan).

## Planilla mensual (régimen general, D. Leg. 728)
La pestaña **Planilla** de `calculadora.html` calcula la planilla y la boleta de pago de los trabajadores guardados en **Equipo** que están en el régimen general (los de REMYPE se excluyen). Las funciones de cálculo están en el bloque `/*PURE*/ … /*ENDPURE*/` (`boleta`, `planillaMes`, `ret5ta`).

Qué calcula por trabajador y mes:
- Ingresos: remuneración básica y asignación familiar (prorrateadas por días sin goce), horas extras (25% las 2 primeras horas, 35% desde la 3.ª; valor hora = remuneración ÷ 30 ÷ 8), bonos y, en julio y diciembre, gratificación + bonificación extraordinaria (9% o 6.75% con EPS).
- Descuentos: ONP 13% o AFP (aporte 10% + comisión según AFP + prima 1.37%, con tope de remuneración asegurable), tardanzas, otros descuentos y retención de 5.ª categoría con el procedimiento de SUNAT (divisores 12-12-12-9-8-8-8-5-4-4-4-saldo; 7 UIT; base con lo ya percibido y gratificaciones proyectadas).
- Aporte del empleador: EsSalud 9% (no aplica a la gratificación) y depósito de CTS en mayo y noviembre.

Acceso: la planilla y las novedades son gratis (hasta 3 trabajadores). **Premium** habilita boletas de pago imprimibles y la exportación de la planilla a PDF/CSV.

Constantes que hay que revisar periódicamente (están en el bloque `PURE`):
- `AFP` (comisión por flujo de cada AFP), `AFP_APORTE`, `AFP_PRIMA` y `AFP_TOPE`: la SBS los actualiza; el tope cambia cada trimestre.
- `RMV` y `UIT`: cada vez que salga un decreto.

Supuestos: si no se informan los acumulados del año, la retención de 5.ª categoría asume que el trabajador cobró lo mismo todos los meses. No incluye SCTR, Vida Ley, subsidios de EsSalud, participación en utilidades ni la generación de archivos PLAME/T-Registro.

## Página de precios
`precios.html` muestra el plan gratis y Premium (S/ 29 mensual, S/ 290 anual), cómo pagar por Yape/Plin y preguntas frecuentes. Si cambias precios o número, actualiza también `precios.html` y los textos de `calculadora.html` (`planButtons` y `openPremium`).

## Firma electrónica simple de boletas
Con Premium, cada boleta se firma con una llave ECDSA P-256 que se crea y se guarda **en el navegador** del usuario (`liquida.sign.v1`). La boleta muestra un código QR con un enlace a `verificar.html`, que comprueba la firma y muestra RUC, DNI, periodo, ingresos, descuentos y neto. El trabajador puede firmar en pantalla (imagen guardada solo en su navegador, `liquida.firmas.v1`).

Alcances y límites:
- Detecta cualquier cambio de importes, DNI, periodo o RUC después de emitir la boleta.
- **No** es una firma digital con certificado de una entidad acreditada ni prueba por sí sola quién es el empleador; la «llave» permite comparar boletas de un mismo emisor.
- Si el usuario borra los datos del navegador, se crea una llave nueva (las boletas anteriores siguen verificándose con su llave original).
- El generador de QR (`qrEncode`, en el bloque `PURE`) soporta hasta la versión 20 con corrección de errores L.

## Pendiente: archivos PLAME y T-Registro
Aún no se generan. Requieren las estructuras oficiales de SUNAT (T-Registro: archivos `RP_<RUC>.ide`, `.tra`, `.per`, `.est`, `.cta`, campos separados por «|»; PLAME: `.jor`, `.snl`, `.rem`, …) y sus tablas paramétricas de códigos, que deben validarse con el PVS de SUNAT antes de usarse.
