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
