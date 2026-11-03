// Usuario simulado en navegador real (Chromium con perfiles de Android, iPhone e iPad).
// Uso: node tests/e2e-dispositivos.js [carpeta-de-capturas]
// Nota: es Chromium emulando pantalla, toque y agente de usuario; no es Safari real.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..'), SHOTS = process.argv[2] || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// Servidor estático; /demo.html es la calculadora sin clave de licencia (permite probar el flujo Premium de demostración).
const real = fs.readFileSync(path.join(ROOT, 'calculadora.html'), 'utf8');
const demo = real.replace(/window\.LIQUIDA_LIC=\{.*?\};?\n/, 'window.LIQUIDA_LIC={};\n');
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  if (u === '/demo.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(demo); }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  const ext = path.extname(f), t = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.xml': 'text/xml' }[ext] || 'application/octet-stream';
  r.writeHead(200, { 'content-type': t }); r.end(fs.readFileSync(f));
});

const DEVICES = ['Pixel 7', 'Galaxy S9+', 'iPhone 13', 'iPhone SE', 'iPad (gen 7)', 'iPad Pro 11'];
let fail = 0, n = 0; const problemas = [];
const ok = (dev, name, cond, extra) => { n++; if (!cond) { fail++; problemas.push(dev + ' · ' + name + (extra ? ' → ' + extra : '')); } console.log((cond ? 'ok   ' : 'FAIL ') + dev + ' · ' + name + (cond ? '' : '  ' + (extra || ''))); };

async function revisar(page, dev, etiqueta) {
  const r = await page.evaluate(() => {
    const W = document.documentElement.clientWidth, out = { overflow: document.documentElement.scrollWidth - W, chicos: [], textoCortado: [] };
    document.querySelectorAll('button, a, select, input:not([type=hidden]), summary').forEach(el => {
      const cs = getComputedStyle(el), b = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none' || b.width === 0 || b.height === 0) return;
      if (el.closest('.sr') || el.classList.contains('sr')) return;
      if (el.tagName === 'A' && el.closest('p, li, footer, .disc, td')) return;        // enlaces dentro de texto corrido
      if (el.type === 'checkbox' || el.type === 'radio') return;
      if (Math.min(b.width, b.height) < 36) out.chicos.push((el.tagName + '.' + (el.className || '') + ' "' + (el.textContent || el.getAttribute('aria-label') || el.id || '').trim().slice(0, 24) + '" ' + Math.round(b.width) + '×' + Math.round(b.height)));
    });
    return out;
  });
  ok(dev, etiqueta + ': sin desborde horizontal', r.overflow <= 1, r.overflow + 'px de más');
  ok(dev, etiqueta + ': objetivos táctiles ≥ 36 px', r.chicos.length === 0, r.chicos.slice(0, 4).join(' | '));
}

async function correr(nombre) {
  const d = devices[nombre]; if (!d) { console.log('(sin perfil ' + nombre + ')'); return; }
  const br = await chromium.launch();
  const ctx = await br.newContext({ ...d, locale: 'es-PE', timezoneId: 'America/Lima' });
  const page = await ctx.newPage(); page.setDefaultTimeout(4000);
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource|fonts\.g/i.test(m.text())) errores.push('console: ' + m.text()); });
  const base = 'http://127.0.0.1:' + srv.address().port;
  const foto = async (nm) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, nombre.replace(/[^\w]+/g, '_') + '_' + nm + '.png') }).catch(() => {}); };
  const tap = async (sel, etiqueta) => { try { await page.tap(sel, { timeout: 3500 }); return true; } catch (e) { ok(nombre, 'clic: ' + (etiqueta || sel), false, String(e.message).split('\n')[0].slice(0, 110)); return false; } };

  // 1. Entrada desde la portada hacia la calculadora
  await page.goto(base + '/index.html'); await foto('01_inicio');
  await revisar(page, nombre, 'portada');
  await page.goto(base + '/demo.html'); await page.waitForSelector('#app button');
  await foto('02_calculadora'); await revisar(page, nombre, 'calculadora');

  // 2. Cada calculadora: escribir sueldo y ver un resultado en pantalla
  for (const [v, nom] of [['grati', 'Gratificación'], ['cts', 'CTS'], ['vac', 'Vacaciones'], ['liq', 'Liquidación'], ['hon', 'Honorarios'], ['neto', 'Sueldo neto']]) {
    if (!(await tap('[data-act="calc"][data-v="' + v + '"]', 'pestaña ' + nom))) continue;
    if (v !== 'hon') { try { await page.fill('#f-sueldo', '3500'); } catch (e) { ok(nombre, nom + ': escribir sueldo', false, String(e.message).split('\n')[0].slice(0, 90)); } }
    else { try { await page.fill('#f-monto', '4200'); } catch (e) { ok(nombre, 'Honorarios: escribir monto', false, String(e.message).split('\n')[0].slice(0, 90)); } }
    const txt = await page.locator('#res').innerText().catch(() => '');
    ok(nombre, nom + ': muestra un resultado en S/', /S\/\s?[\d,]+/.test(txt) && !/NaN|Infinity|undefined/.test(txt), txt.slice(0, 60).replace(/\n/g, ' '));
    await revisar(page, nombre, nom);
  }
  await foto('03_resultado');

  // 3. Equipo: agregar un trabajador
  await tap('[data-act="tab"][data-v="team"]', 'pestaña Equipo');
  if (await tap('[data-act="addw"]', 'Agregar trabajador')) {
    try {
      await page.fill('#n-name', 'Ana Prueba'); await page.fill('#n-sueldo', '3000');
      await foto('04_form_trabajador');
      await tap('[data-act="savew"]', 'Guardar trabajador');
      await page.waitForSelector('text=Ana Prueba', { timeout: 3000 });
      ok(nombre, 'Equipo: trabajador guardado y visible', true);
    } catch (e) { ok(nombre, 'Equipo: trabajador guardado y visible', false, String(e.message).split('\n')[0].slice(0, 90)); }
  }
  await revisar(page, nombre, 'equipo');

  // 4. Planilla y Premium de demostración
  await tap('[data-act="tab"][data-v="plan"]', 'pestaña Planilla');
  const planTxt = await page.locator('#app').innerText();
  ok(nombre, 'Planilla: neto total visible', /Neto total a pagar/.test(planTxt) && !/NaN|Infinity/.test(planTxt));
  await foto('05_planilla');
  const bol = await page.$('[data-act="boleta"]');
  if (bol) {
    await tap('[data-act="boleta"]', 'Boleta');
    const hoja = await page.locator('#sheet').innerText().catch(() => '');
    ok(nombre, 'Boleta (gratis) ofrece Premium', /Premium/.test(hoja));
    await foto('06_premium_oferta');
    await revisar(page, nombre, 'hoja Premium');
    if (await tap('[data-act="goprem"]', 'Activar Premium (demo)')) {
      const premium = await page.evaluate(() => /Exportar planilla/.test(document.getElementById('app').innerText) || !document.querySelector('[data-act="prem"][class*="lock"]'));
      await tap('[data-act="tab"][data-v="plan"]', 'volver a Planilla');
      await tap('[data-act="boleta"]', 'Boleta con Premium');
      const hoja2 = await page.locator('#sheet').innerText().catch(() => '');
      ok(nombre, 'Premium: la boleta se muestra completa', /Neto|neto/.test(hoja2) && /EsSalud/.test(hoja2), hoja2.slice(0, 70).replace(/\n/g, ' '));
      await foto('07_premium_boleta'); await revisar(page, nombre, 'boleta Premium');
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  // 5. Cuenta: abrir y cerrar la hoja
  if (await page.$('[data-act="cuenta"]')) {
    if (await tap('[data-act="cuenta"]', 'Entrar / Mi cuenta')) {
      const hojaC = await page.locator('#sheet').innerText().catch(() => '');
      ok(nombre, 'Cuenta: formulario de correo y contraseña', /correo|Correo/.test(hojaC));
      await foto('08_cuenta'); await revisar(page, nombre, 'hoja Cuenta');
      await page.keyboard.press('Escape');
      ok(nombre, 'Cuenta: se cierra con Escape', await page.evaluate(() => document.getElementById('sheet').hidden));
    }
  }

  // 6. Beneficios (guía) y pantalla chica en horizontal
  await tap('[data-act="tab"][data-v="guide"]', 'pestaña Beneficios');
  await foto('09_beneficios'); await revisar(page, nombre, 'beneficios');
  await page.setViewportSize({ width: d.viewport.height, height: d.viewport.width });
  await revisar(page, nombre, 'horizontal');

  ok(nombre, 'sin errores de consola ni de JavaScript', errores.length === 0, errores.slice(0, 2).join(' | '));
  await br.close();
}

srv.listen(0, '127.0.0.1', async () => {
  try { for (const dv of DEVICES) await correr(dv); } catch (e) { console.log('ERROR', e); fail++; }
  srv.close();
  console.log('\n' + (n - fail) + '/' + n + ' comprobaciones correctas');
  if (problemas.length) console.log('Problemas:\n- ' + problemas.join('\n- '));
  process.exit(fail ? 1 : 0);
});
