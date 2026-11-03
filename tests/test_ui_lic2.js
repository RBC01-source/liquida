// Flujos de Premium con códigos, ejecutando el script real de la página con un DOM mínimo simulado.
const fs = require('fs');
const html0 = fs.readFileSync(process.argv[2], 'utf8');
const K = JSON.parse(fs.readFileSync(__dirname + '/testkeys.json', 'utf8'));
const G = new Function(fs.readFileSync(process.argv[3], 'utf8').split('/*LIC*/')[1].split('/*ENDLIC*/')[0] + '; return { emit };')();
const ORIG = html0.match(/window\.LIQUIDA_LIC=\{.*?\};/)[0];
if (!html0.includes(ORIG)) { console.log('FAIL no se encontró la configuración LIQUIDA_LIC'); process.exit(1); }

let n = 0, fail = 0;
function ok(name, cond, extra) { n++; if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); }
const tick = () => new Promise(r => setTimeout(r, 30));
const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function mkEl(id) {
  return { id, _h: '', hidden: false, listeners: {}, style: {}, value: '', checked: false, dataset: {}, _t: '', classList: { add() {}, remove() {} },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, focus() {}, remove() {}, select() {}, appendChild() {}, click() {},
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, set textContent(v) { this._t = v; }, get textContent() { return this._t; } };
}
function boot(store, lic) {
  const html = html0.replace(ORIG, () => 'window.LIQUIDA_LIC=' + JSON.stringify(lic).replace(/</g, '\\u003c') + ';');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const fixed = { app: mkEl('app'), toast: mkEl('toast'), sheet: mkEl('sheet') }; fixed.sheet.hidden = true;
  const fields = {}, fetches = [];
  const doc = { getElementById: id => fixed[id] || fields[id] || null, addEventListener() {}, body: { classList: { add() {}, remove() {} }, appendChild() {} }, createElement: () => mkEl('x') };
  const win = { addEventListener() {}, removeEventListener() {}, print() {}, scrollTo() {} };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  const fetchStub = (u, o) => { fetches.push({ u, body: o && o.body }); return { catch() {} }; };
  const run = new Function('window', 'document', 'localStorage', 'location', 'navigator', 'Blob', 'URL', 'setTimeout', 'clearTimeout', 'fetch', script + '\n;return { S, onClick };');
  const api = run(win, doc, ls, { hash: '' }, {}, function () {}, { createObjectURL: () => 'x', revokeObjectURL() {} }, function () {}, function () {}, fetchStub);
  return { S: api.S, app: fixed.app, sheet: fixed.sheet, toast: fixed.toast, fields, fetches, store,
    click: (act, o) => api.onClick({ target: { closest: () => ({ dataset: Object.assign({ act }, o || {}) }) } }) };
}
const pubA = K.A.pub, pubB = K.B.pub;

(async () => {
  const store = {};
  let E = boot(store, { pub: pubA, pay: { mensual: '', anual: '' }, whatsapp: '' });
  ok('Con clave configurada, arranca sin Premium', E.S.premium === false);
  E.click('prem');
  ok('Hoja pide código y no ofrece activar gratis', E.sheet.innerHTML.includes('Ya tengo un código') && !E.sheet.innerHTML.includes('data-act="goprem"') && E.sheet.innerHTML.includes('Quiero Premium'));
  ok('Sin enlace de pago pide correo', E.sheet.innerHTML.includes('id="p-mail"') && !E.sheet.innerHTML.includes('Pagar S/'));
  { const Y = boot({}, { pub: pubA, pay: { mensual: '', anual: '' }, whatsapp: '51960250506', yape: '51960250506' }); Y.click('prem');
    ok('Con Yape: muestra monto y número, sin pedir correo', Y.sheet.innerHTML.includes('Yape o Plin') && Y.sheet.innerHTML.includes('960 250 506') && Y.sheet.innerHTML.includes('S/ 290') && !Y.sheet.innerHTML.includes('id="p-mail"'));
    ok('Con Yape: botón de WhatsApp al número', Y.sheet.innerHTML.includes('https://wa.me/51960250506')); }
  E.click('goprem'); ok('El botón demo no activa Premium cuando hay clave', E.S.premium === false);

  // Solicitud
  E.fields['p-mail'] = { value: 'no-es-correo' }; E.click('lead');
  ok('Correo inválido no se envía', E.fetches.length === 0 && E.toast.textContent.includes('correo válido'));
  E.fields['p-mail'] = { value: 'cliente@correo.com' }; E.click('lead');
  ok('Solicitud se envía al formulario', E.fetches.length === 1 && E.fetches[0].body.includes('cliente@correo.com'));

  // Códigos inválidos
  E.fields['p-code'] = { value: 'cualquier cosa' }; E.click('activate'); await tick();
  ok('Código con mal formato: mensaje claro', E.S.premium === false && E.sheet.innerHTML.includes('formato correcto'));
  const forged = await G.emit(K.B.priv, 'ladron@correo.com', 'anual', '2099-12-31', todayIso());
  E.fields['p-code'] = { value: forged }; E.click('activate'); await tick();
  ok('Código fabricado: rechazado y no activa Premium', E.S.premium === false && E.sheet.innerHTML.includes('no es válido'));
  ok('No queda guardado un Premium falso', !store['liquida.v1'] || (j => j.premium === false && !j.lic)(JSON.parse(store['liquida.v1'])));
  const expired = await G.emit(K.A.priv, 'viejo@correo.com', 'mensual', '2026-10-01', '2026-09-01');
  E.fields['p-code'] = { value: expired }; E.click('activate'); await tick();
  ok('Código vencido: avisa la fecha', E.S.premium === false && E.sheet.innerHTML.includes('venció el 01/10/2026'));

  // Código válido (con saltos de línea como llega por WhatsApp)
  const good = await G.emit(K.A.priv, 'Cliente@Correo.com', 'anual', '2099-12-31', todayIso());
  E.fields['p-code'] = { value: ' ' + good.slice(0, 60) + '\n' + good.slice(60) + '\n' }; E.click('activate'); await tick();
  ok('Código válido activa Premium', E.S.premium === true && E.S.lic.exp === '2099-12-31');
  ok('Aviso de activación con la fecha', E.toast.textContent.includes('31/12/2099'));
  ok('Hoja cerrada tras activar', E.sheet.hidden === true);
  ok('Se guarda el código y NO un premium suelto', (j => j.lic === good && j.premium === false)(JSON.parse(store['liquida.v1'])));
  E.click('tab', { v: 'plan' });
  ok('La barra muestra Premium', E.app.innerHTML.includes('<b>Premium</b>'));
  E.click('prem');
  ok('Hoja de Premium activo: correo enmascarado y vencimiento', E.sheet.innerHTML.includes('c***@correo.com') && E.sheet.innerHTML.includes('31/12/2099') && E.sheet.innerHTML.includes('Quitar Premium'));
  ok('No muestra el correo completo', !E.sheet.innerHTML.includes('cliente@correo.com'));
  E.click('close');

  // Boleta con Premium real
  E.click('addw'); E.fields['n-name'] = { value: 'Ana' }; E.fields['n-dni'] = { value: '' }; E.fields['n-sueldo'] = { value: '3000' }; E.fields['n-asig'] = { checked: false };
  E.fields['n-reg'] = { value: 'general' }; E.fields['n-pension'] = { value: 'onp' }; E.fields['n-afp'] = { value: 'integra' }; E.fields['n-com'] = { value: 'flujo' }; E.fields['n-eps'] = { checked: false };
  E.click('savew', { id: '' });
  E.click('boleta', { id: E.S.workers[0].id });
  ok('Con Premium por código la boleta abre', E.sheet.innerHTML.includes('BOLETA DE PAGO'));
  E.click('close');

  // Recarga: se vuelve a verificar
  let E2 = boot(store, { pub: pubA, pay: { mensual: '', anual: '' }, whatsapp: '' }); await tick();
  ok('Tras recargar, Premium se verifica y sigue activo', E2.S.premium === true && E2.S.lic.email === 'cliente@correo.com');
  // Recarga con otra clave pública en el sitio (cambio de clave): se pierde Premium
  let E3 = boot(store, { pub: pubB, pay: { mensual: '', anual: '' }, whatsapp: '' }); await tick();
  ok('Si cambia la clave del sitio, el código deja de valer', E3.S.premium === false);

  // Premium de la demo guardado en el navegador no vale con cobro activo
  const demoStore = { 'liquida.v1': JSON.stringify({ premium: true, workers: [], f: {}, calc: 'grati' }) };
  let E4 = boot(demoStore, { pub: pubA, pay: { mensual: '', anual: '' }, whatsapp: '' }); await tick();
  ok('Premium de demo guardado se descarta cuando hay cobro', E4.S.premium === false);
  // Y sin clave (modo demo) sigue funcionando como antes
  let E5 = boot(demoStore, { pub: null, pay: { mensual: '', anual: '' }, whatsapp: '' }); await tick();
  ok('Sin clave: modo demo conserva su Premium', E5.S.premium === true);
  E5.click('unprem'); E5.click('prem'); E5.click('goprem');
  ok('Sin clave: el botón demo activa Premium (como hasta ahora)', E5.S.premium === true);

  // Vencimiento al recargar
  const expStore = { 'liquida.v1': JSON.stringify({ premium: false, lic: expired, workers: [], f: {}, calc: 'grati' }) };
  let E6 = boot(expStore, { pub: pubA, pay: { mensual: '', anual: '' }, whatsapp: '' }); await tick();
  ok('Licencia vencida al recargar: sin Premium', E6.S.premium === false && E6.S.licInfo && E6.S.licInfo.reason === 'expired');
  E6.click('prem');
  ok('Aviso de renovación con fecha', E6.sheet.innerHTML.includes('Tu Premium venció el') && E6.sheet.innerHTML.includes('01/10/2026'));
  E6.click('boleta', { id: 'x' }); ok('Vencido: la boleta vuelve a pedir Premium', E6.sheet.innerHTML.includes('Liquida Premium'));

  // Renovar con Premium activo
  const renew = await G.emit(K.A.priv, 'cliente@correo.com', 'mensual', '2100-01-31', todayIso());
  E2.click('prem'); E2.fields['p-code'] = { value: renew }; E2.click('activate'); await tick();
  ok('Renovación con código nuevo reemplaza al anterior', E2.S.lic.plan === 'mensual' && E2.S.lic.exp === '2100-01-31' && E2.S.licCode === renew);

  // Quitar Premium
  E2.click('prem'); E2.click('unprem');
  ok('Quitar Premium borra el código', E2.S.premium === false && JSON.parse(store['liquida.v1']).lic === '');

  // Enlaces de pago y WhatsApp
  let E7 = boot({}, { pub: pubA, pay: { mensual: 'https://pago.ejemplo.pe/mensual', anual: 'https://pago.ejemplo.pe/anual' }, whatsapp: '51999888777' });
  E7.click('prem');
  ok('Con enlace de pago muestra «Pagar» (anual por defecto)', E7.sheet.innerHTML.includes('href="https://pago.ejemplo.pe/anual"') && E7.sheet.innerHTML.includes('Pagar S/ 290'));
  ok('El enlace abre en pestaña nueva con noopener', /href="https:\/\/pago\.ejemplo\.pe\/anual" target="_blank" rel="noopener noreferrer"/.test(E7.sheet.innerHTML));
  ok('Botón de WhatsApp con el número', E7.sheet.innerHTML.includes('https://wa.me/51999888777?text='));
  E7.click('plan', { v: 'mensual' });
  ok('Cambiar de plan cambia el enlace y el precio', E7.sheet.innerHTML.includes('href="https://pago.ejemplo.pe/mensual"') && E7.sheet.innerHTML.includes('Pagar S/ 29'));
  ok('Con enlace de pago ya no pide correo', !E7.sheet.innerHTML.includes('Quiero Premium'));
  let E8 = boot({}, { pub: pubA, pay: { mensual: 'javascript:alert(1)', anual: 'http://inseguro.pe/x' }, whatsapp: '12ab' });
  E8.click('prem');
  ok('Enlaces no https se ignoran', !E8.sheet.innerHTML.includes('javascript:') && !E8.sheet.innerHTML.includes('http://inseguro') && E8.sheet.innerHTML.includes('Quiero Premium'));
  ok('Número de WhatsApp inválido se ignora', !E8.sheet.innerHTML.includes('wa.me'));
  let E9 = boot({}, { pub: pubA, pay: { mensual: '', anual: 'https://x.pe/"><script>alert(1)</script>' }, whatsapp: '' });
  E9.click('prem'); ok('El enlace de pago se escapa en el HTML', !E9.sheet.innerHTML.includes('<script>alert(1)'));

  console.log('\n' + (n - fail) + '/' + n + ' comprobaciones correctas');
  process.exit(fail ? 1 : 0);
})();
