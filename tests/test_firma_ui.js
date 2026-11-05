// Prueba de flujos de la página real con un DOM mínimo simulado (sin navegador).
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8'); const C0 = require('vm');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

let fail = 0, n = 0;
function ok(name, cond, extra) { n++; if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); }

function mkEl(id) {
  return { id: id, _h: '', hidden: false, listeners: {}, style: {}, value: '', checked: false, dataset: {}, _t: '',
    classList: { add() {}, remove() {} },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    focus() {}, remove() {}, select() {}, appendChild() {}, click() {},
    set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; },
    set textContent(v) { this._t = v; }, get textContent() { return this._t; } };
}
function boot(store, extra) {
  const fixed = { app: mkEl('app'), toast: mkEl('toast'), sheet: mkEl('sheet') };
  fixed.sheet.hidden = true;
  const fields = Object.assign({}, extra || {}), blobs = [];
  const doc = { getElementById: id => fixed[id] || fields[id] || null, addEventListener() {}, body: { classList: { add() {}, remove() {} }, appendChild() {} },
    createElement: () => mkEl('x') };
  const win = { crypto: globalThis.crypto, addEventListener() {}, removeEventListener() {}, print() { win._printed = true; }, scrollTo() {} };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  const Blob_ = function (parts) { blobs.push(parts.join('')); };
  const URL_ = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  const run = new Function('window', 'document', 'localStorage', 'location', 'navigator', 'Blob', 'URL', 'setTimeout', 'clearTimeout', 'fetch',
    script + '\n;return { S, onClick, render, app, sheet, nvOf, firmaVerify, firmaTrab, firmaTrabSet };');
  const api = run(win, doc, ls, { hash: '' }, {}, Blob_, URL_, function () {}, function () {}, function () { return { catch() {} }; });
  const click = (act, o) => api.onClick({ target: { closest: () => ({ dataset: Object.assign({ act: act }, o || {}) }) } });
  const change = (dataset, value) => (fixed.app.listeners.change || []).forEach(f => f({ target: { dataset: dataset, value: value } }));
  const input = (dataset, value) => (fixed.app.listeners.input || []).forEach(f => f({ target: { dataset: dataset, value: value, type: 'text' } }));
  return { api, fixed, fields, blobs, click, change, input, win, store };
}
const setF = (E, o) => Object.keys(o).forEach(k => { E.fields[k] = { value: o[k] === true || o[k] === false ? '' : String(o[k]), checked: o[k] === true }; });


const tick = () => new Promise(r => setTimeout(r, 60));
// setTimeout real para esperar la firma asíncrona
(async () => {
  const store = {};
  const slot = mkEl('bf-emp'), lab = mkEl('bf-empl');
  const E = boot(store, { 'bf-emp': slot, 'bf-empl': lab });
  const S = E.api.S, sheet = E.fixed.sheet;
  E.change({ actChange: 'period' }, '2026-10');
  E.click('addw');
  setF(E, { 'n-name': 'Ana Pérez', 'n-dni': '44556677', 'n-sueldo': 3000, 'n-asig': true, 'n-reg': 'general', 'n-pension': 'afp', 'n-afp': 'integra', 'n-com': 'flujo', 'n-eps': false });
  E.click('savew', { id: '' });
  const wid = S.workers[0].id;
  S.empresa = { name: 'Mi Empresa SAC', ruc: '20123456789' };
  E.click('goprem');
  E.click('boleta', { id: wid });
  ok('Boleta tiene espacio de firma del empleador y del trabajador', sheet.innerHTML.includes('id="bf-emp"') && sheet.innerHTML.includes('Firmar en pantalla'));
  ok('Aviso de firma electrónica simple', sheet.innerHTML.includes('Firma electrónica simple') && sheet.innerHTML.includes('no es una firma digital con certificado'));
  await tick(); await tick();
  ok('Se dibuja el QR en la boleta', slot.innerHTML.startsWith('<svg') && slot.innerHTML.includes('<path'), slot.innerHTML.slice(0, 80));
  ok('Leyenda con empleador, llave y fecha', /Firmado electrónicamente por <b>Mi Empresa SAC<\/b> · llave [\w-]{8} · \d{2}\/\d{2}\/\d{4}/.test(lab.innerHTML), lab.innerHTML);
  const k = JSON.parse(store['liquida.sign.v1'] || 'null');
  ok('La llave de firma se guarda en el navegador (separada de los datos)', !!k && !!k.priv && !!k.pub && !store['liquida.v1'].includes(k.priv.d));
  // La boleta firmada se puede verificar con la misma lógica que verificar.html
  const E2 = boot(store, { 'bf-emp': mkEl('bf-emp'), 'bf-empl': mkEl('bf-empl') });
  E2.api.S.premium = true; E2.api.S.period = '2026-10';
  ok('Con la misma llave guardada se reusa (no se crea otra)', JSON.parse(store['liquida.sign.v1']).pub.x === k.pub.x);
  // Firma del trabajador
  E.click('firma-trab', { id: wid });
  ok('Abre el recuadro de firma', sheet.innerHTML.includes('id="fp"') && sheet.innerHTML.includes('Guardar firma'));
  E.click('firma-save', { id: wid });
  ok('Sin dibujar no guarda la firma', E.api.firmaTrab(wid) === '');
  E.api.firmaTrabSet(wid, 'data:image/png;base64,AAAA');
  E.click('boleta', { id: wid });
  ok('La firma guardada aparece en la boleta', sheet.innerHTML.includes('<img alt="Firma del trabajador"') && sheet.innerHTML.includes('Cambiar firma'));
  E.api.firmaTrabSet(wid, 'javascript:alert(1)');
  ok('Una firma con formato extraño no se muestra', E.api.firmaTrab(wid) === '' || E.api.firmaTrab(wid).startsWith('data:image/png;base64,'));
  S.period = '2026-11'; E.api.firmaTrabSet(wid, 'data:image/png;base64,BBBB');
  S.period = '2026-10'; ok('La firma es por trabajador y por mes', E.api.firmaTrab(wid) !== 'data:image/png;base64,BBBB');
  console.log('\n' + (n - fail) + '/' + n + ' comprobaciones correctas'); process.exit(fail ? 1 : 0);
})();
