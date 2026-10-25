# Liquida — sitio estático

## Publicar en GitHub Pages
1. Crea un repositorio nuevo (por ejemplo `liquida`) y sube todo el contenido de esta carpeta a la raíz.
2. En el repositorio: Settings → Pages → Source: "Deploy from a branch" → rama `main`, carpeta `/ (root)`.
3. La dirección será `https://rbc01-source.github.io/liquida/`.

## Antes de publicar (config.json, en el proyecto que genera el sitio)
- `base_url`: tu dirección final (afecta sitemap y canonical).
- `form_endpoint`: URL de un servicio de formularios (Formspree, Getform, etc.) que recibe correos por POST JSON. Si queda vacío, usa `contact_email` (abre el correo del visitante).
- `goatcounter_code`: código gratuito de goatcounter.com para medir visitas sin cookies (opcional).

## Después
- Envía `sitemap.xml` a Google Search Console.
- Revisa las cifras (RMV, UIT) cada año y cuando salga un decreto.
