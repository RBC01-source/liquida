# Liquida: puesta en marcha con Netlify, Namecheap y Supabase

Esta guía tiene **tus pasos** (compras, cuentas, permisos). El código ya está listo en este repositorio.

Orden recomendado: **A → B → C → D → E**. Cada parte se puede hacer por separado.

---

## A. Comprar el dominio en Namecheap
1. Entra a namecheap.com, crea tu cuenta y busca el nombre que quieras (por ejemplo `liquida.com`).
2. Agrégalo al carrito y paga. **Quita** los extras que no necesitas (hosting, correo, SSL pagado): Netlify da el HTTPS gratis.
3. Deja activada la protección de privacidad del dominio (WhoisGuard), suele ser gratis.
4. Activa la verificación en dos pasos en tu cuenta de Namecheap (Profile → Security).

## B. Publicar en Netlify
1. Entra a app.netlify.com y regístrate con tu cuenta de GitHub.
2. **Add new site → Import an existing project → GitHub** y elige el repositorio `liquida` (autoriza el acceso solo a ese repositorio).
3. Rama `main`. No pongas comando de build; el directorio de publicación es `.` (ya lo indica `netlify.toml`). Toca **Deploy**.
4. Te dará una dirección `algo.netlify.app`. Ábrela y comprueba que la calculadora funciona.

## C. Conectar el dominio
1. En Netlify: **Domain management → Add a domain** y escribe el que compraste.
2. Elige **Use Netlify DNS** y copia los 4 servidores de nombres (nameservers) que te muestre.
3. En Namecheap: **Domain List → Manage → Nameservers → Custom DNS**, pega los 4 y guarda con la palomita verde.
4. Espera de 10 minutos a unas horas. En Netlify: **HTTPS → Verify DNS → Provision certificate** (se activa solo cuando el dominio ya apunta).
5. Activa **Force HTTPS**.
6. Dime tu dominio (por ejemplo `https://liquida.com`) para que lo cambie en todo el sitio (enlaces, sitemap, QR de boletas).

## D. Crear la base de datos en Supabase
1. Entra a supabase.com, regístrate, **New project**. Nombre `liquida`, región **South America (São Paulo)**, y una contraseña de base de datos larga (guárdala; no me la envíes).
2. **SQL Editor → New query**: pega todo el contenido de `supabase/schema.sql` y toca **Run**. Debe decir *Success*.
3. **Authentication → Providers → Email**: deja activado **Confirm email** (evita cuentas con correos ajenos).
4. **Authentication → URL Configuration**:
   - *Site URL*: `https://tudominio.com/calculadora.html`
   - *Redirect URLs*: agrega `https://tudominio.com/**`
5. **Project Settings → API**: copia **Project URL** y la clave **anon public**.
   - Envíame solo esas dos. **Nunca** la clave `service_role` ni la contraseña de la base de datos.
6. (Recomendado) **Authentication → Emails**: traduce las plantillas al español.

Con la Project URL y la clave anon, yo las dejo configuradas en el sitio (`node herramientas/configurar-sitio.mjs --supabase-url ... --anon ...`).

## E. Activar a un cliente que pagó
1. Supabase → **Table Editor → suscripciones → Insert row**.
2. `email`: el correo con el que el cliente creó su cuenta (en minúsculas), `plan`: `mensual` o `anual`, `vence`: último día de uso (por ejemplo 31 días o 366 días desde hoy).
3. **Save**. El cliente entra con su cuenta y tiene Premium; para renovar, cambia la fecha `vence`.
4. El sistema de códigos (`LQ1.…`) sigue funcionando como alternativa; ambos conviven.

---

## Qué guarda y qué no
- Las contraseñas las guarda Supabase Auth, cifradas. Liquida nunca las ve ni las guarda.
- En la nube solo van trabajadores, novedades y datos del empleador, y solo su dueño puede leerlos (reglas RLS). No se suben firmas de boletas ni llaves.
- La clave `anon` es pública por diseño; lo que protege los datos son las reglas de `schema.sql`.
- Si no hay Supabase configurado, el botón «Entrar» ni aparece y todo funciona como antes.

## Cambiar de dirección después
`node herramientas/configurar-sitio.mjs --dominio https://tudominio.com` reemplaza la dirección en todas las páginas. Las boletas ya emitidas con QR de la dirección anterior siguen verificándose mientras esa página exista; mantén el sitio antiguo activo un tiempo o configura una redirección.
