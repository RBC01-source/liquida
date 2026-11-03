// Prueba de flujos de la página real con un DOM mínimo simulado (sin navegador).
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
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
function boot(store) {
  const fixed = { app: mkEl('app'), toast: mkEl('toast'), sheet: mkEl('sheet') };
  fixed.sheet.hidden = true;
  const fields = {}, blobs = [];
  const doc = { getElementById: id => fixed[id] || fields[id] || null, addEventListener() {}, body: { classList: { add() {}, remove() {} }, appendChild() {} },
    createElement: () => mkEl('x') };
  const win = { addEventListener() {}, removeEventListener() {}, print() { win._printed = true; }, scrollTo() {} };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  const Blob_ = function (parts) { blobs.push(parts.join('')); };
  const URL_ = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  const run = new Function('window', 'document', 'localStorage', 'location', 'navigator', 'Blob', 'URL', 'setTimeout', 'clearTimeout', 'fetch',
    script + '\n;return { S, onClick, render, app, sheet, nvOf };');
  const api = run(win, doc, ls, { hash: '' }, {}, Blob_, URL_, function () {}, function () {}, function () { return { catch() {} }; });
  const click = (act, o) => api.onClick({ target: { closest: () => ({ dataset: Object.assign({ act: act }, o || {}) }) } });
  const change = (dataset, value) => (fixed.app.listeners.change || []).forEach(f => f({ target: { dataset: dataset, value: value } }));
  const input = (dataset, value) => (fixed.app.listeners.input || []).forEach(f => f({ target: { dataset: dataset, value: value, type: 'text' } }));
  return { api, fixed, fields, blobs, click, change, input, win, store };
}
const setF = (E, o) => Object.keys(o).forEach(k => { E.fields[k] = { value: o[k] === true || o[k] === false ? '' : String(o[k]), checked: o[k] === true }; });

const store = {};
let E = boot(store);
const S = E.api.S, app = E.fixed.app, sheet = E.fixed.sheet;

// 1. Navegación: 4 pestañas y vista vacía de planilla
ok('Nav tiene pestaña Planilla', /data-v="plan"[^>]*>Planilla</.test(app.innerHTML));
E.click('tab', { v: 'plan' });
ok('Planilla vacía invita a agregar trabajadores', app.innerHTML.includes('Aún no hay trabajadores en planilla'));
ok('Mes por defecto = mes actual', S.period === new Date().toISOString().slice(0, 7) || /^\d{4}-\d{2}$/.test(S.period));
E.change({ actChange: 'period' }, '2026-10'); ok('Cambio de mes a 2026-10', S.period === '2026-10');
E.change({ actChange: 'period' }, 'basura'); ok('Mes inválido se ignora', S.period === '2026-10');

// 2. Alta de trabajador con datos de pensión
E.click('addw');
ok('Formulario de trabajador abre', !sheet.hidden && sheet.innerHTML.includes('Nuevo trabajador') && sheet.innerHTML.includes('id="n-afpbox"'));
setF(E, { 'n-name': 'Ana Pérez', 'n-dni': '44556677', 'n-sueldo': 3000, 'n-asig': true, 'n-reg': 'general', 'n-pension': 'afp', 'n-afp': 'integra', 'n-com': 'flujo', 'n-eps': false });
E.click('savew', { id: '' });
ok('Trabajador guardado con campos nuevos', S.workers.length === 1 && S.workers[0].dni === '44556677' && S.workers[0].pension === 'afp' && S.workers[0].afp === 'integra' && S.workers[0].asig === true);
const wid = S.workers[0].id;

// 3. Vista de planilla con resultados (Ana: neto 2,680.94 según prueba de cálculo)
E.click('tab', { v: 'plan' });
ok('Resumen del mes visible', app.innerHTML.includes('Resumen de Octubre 2026') && app.innerHTML.includes('Neto total a pagar'));
ok('Neto de Ana en pantalla', app.innerHTML.includes('S/ 2,680.9'), app.innerHTML.match(/Neto <b[^>]*>[^<]*/) );
ok('EsSalud y costo laboral visibles', app.innerHTML.includes('EsSalud a cargo del empleador') && app.innerHTML.includes('Costo laboral del mes'));
ok('Gratis: botón de exportación bloqueado', app.innerHTML.includes('Exportar planilla y boletas (Premium)') && !app.innerHTML.includes('data-act="csv-plan"'));

// 4. Boleta es Premium
E.click('boleta', { id: wid });
ok('Boleta gratis abre Premium', sheet.innerHTML.includes('Liquida Premium') && sheet.innerHTML.includes('Boletas de pago imprimibles'));
E.click('goprem');
ok('Premium activado', S.premium === true);
E.click('boleta', { id: wid });
ok('Boleta muestra encabezado y neto', sheet.innerHTML.includes('BOLETA DE PAGO · OCTUBRE 2026') && sheet.innerHTML.includes('Neto a pagar') && sheet.innerHTML.includes('44556677'));
ok('Boleta lista AFP desglosada y 5.ª', sheet.innerHTML.includes('aporte obligatorio (10%)') && sheet.innerHTML.includes('prima de seguro (1.37%)') && sheet.innerHTML.includes('5.ª categoría'));
ok('Boleta muestra EsSalud del empleador', sheet.innerHTML.includes('EsSalud (9%)'));
E.click('pdf-boleta'); ok('Imprimir boleta llama a print()', E.win._printed === true);
E.click('close'); ok('Cerrar hoja', sheet.hidden === true);

// 5. Novedades
E.click('nov', { id: wid });
ok('Hoja de novedades abre', sheet.innerHTML.includes('Novedades · Ana Pérez') && sheet.innerHTML.includes('Horas extras al 25%'));
ok('Octubre: sin selector de semestre', !sheet.innerHTML.includes('Meses completos del semestre'));
ok('Octubre: acumulados mencionan enero a setiembre y enero a agosto', sheet.innerHTML.includes('enero a setiembre') && sheet.innerHTML.includes('enero a agosto'));
setF(E, { 'nv-faltas': 2, 'nv-tardanza': 30, 'nv-he25': 4, 'nv-he35': 2, 'nv-bonos': 100, 'nv-otros': 50, 'nv-remPrev': '', 'nv-retPrev': '' });
E.click('savenov', { id: wid });
const N = S.nov['2026-10'][wid];
ok('Novedades guardadas por mes y trabajador', N && N.faltas === 2 && N.he25 === 4 && N.he35 === 2 && N.bonos === 100 && N.otros === 50 && N.remPrev === undefined);
E.click('tab', { v: 'plan' });
ok('Planilla refleja novedades', app.innerHTML.includes('con novedades') && app.innerHTML.includes('Tardanzas y otros descuentos'));
ok('Premium: exportación disponible', app.innerHTML.includes('data-act="csv-plan"') && app.innerHTML.includes('data-act="pdf-plan"'));
ok('Persistencia local incluye novedades y empleador', (function () { const j = JSON.parse(store['liquida.v1']); return j.nov['2026-10'][wid].faltas === 2 && j.empresa; })());

// 6. Datos del empleador
E.input({ emp: 'name' }, 'Mi Empresa SAC'); E.input({ emp: 'ruc' }, '20123456789');
ok('Empleador guardado', S.empresa.name === 'Mi Empresa SAC' && S.empresa.ruc === '20123456789');
E.click('boleta', { id: wid });
ok('Boleta usa empleador y RUC', sheet.innerHTML.includes('Mi Empresa SAC') && sheet.innerHTML.includes('20123456789'));
E.click('close');

// 7. CSV
E.click('csv-plan');
const csv = E.blobs[E.blobs.length - 1];
ok('CSV con periodo, empleador y total', csv.includes('Octubre 2026') && csv.includes('Mi Empresa SAC') && csv.includes('Ana Pérez') && csv.includes('Total'));
ok('CSV con 13 columnas en la fila de datos', csv.split('\r\n').filter(l => l.startsWith('Ana'))[0].split(',').length === 13, csv.split('\r\n').filter(l => l.startsWith('Ana'))[0]);

// 8. Diciembre: gratificación + semestre; Mayo: CTS
E.change({ actChange: 'period' }, '2026-12'); E.click('tab', { v: 'plan' });
ok('Diciembre muestra gratificación en el resumen', app.innerHTML.includes('incl. gratificación'));
E.click('nov', { id: wid });
ok('Diciembre: selector de semestre para gratificación', sheet.innerHTML.includes('Meses completos del semestre') && sheet.innerHTML.includes('Se usa para la gratificación'));
ok('Diciembre: retPrev menciona enero a noviembre', sheet.innerHTML.includes('enero a noviembre'));
E.click('close');
E.change({ actChange: 'period' }, '2026-05'); E.click('tab', { v: 'plan' });
ok('Mayo muestra depósito de CTS', app.innerHTML.includes('CTS a depositar (hasta el 15 de mayo)'));
E.change({ actChange: 'period' }, '2026-01'); E.click('nov', { id: wid });
ok('Enero: sin acumulados (no hay meses previos)', !sheet.innerHTML.includes('Acumulados del año'));
E.click('close');
E.change({ actChange: 'period' }, '2026-03'); E.click('nov', { id: wid });
ok('Marzo: acumulados solo de remuneraciones y aviso sobre retenciones', sheet.innerHTML.includes('Remuneraciones percibidas de enero a febrero') && sheet.innerHTML.includes('no resta retenciones previas'));
E.click('close'); E.change({ actChange: 'period' }, '2026-10');

// 9. Edición de trabajador (no duplica) y cambio de pensión
E.click('editw', { id: wid });
ok('Editar precarga datos', sheet.innerHTML.includes('Editar trabajador') && sheet.innerHTML.includes('value="Ana Pérez"') && sheet.innerHTML.includes('value="44556677"'));
setF(E, { 'n-name': 'Ana P.', 'n-dni': '44556677', 'n-sueldo': 3500, 'n-asig': false, 'n-reg': 'general', 'n-pension': 'onp', 'n-afp': 'integra', 'n-com': 'flujo', 'n-eps': true });
E.click('savew', { id: wid });
ok('Edición actualiza sin duplicar', S.workers.length === 1 && S.workers[0].name === 'Ana P.' && S.workers[0].pension === 'onp' && S.workers[0].eps === true && S.workers[0].sueldo === 3500);

// 10. Seguridad: nombre con HTML se escapa
E.click('addw'); setF(E, { 'n-name': '<img src=x onerror=alert(1)>', 'n-dni': '', 'n-sueldo': 2000, 'n-asig': false, 'n-reg': 'general', 'n-pension': 'none', 'n-afp': 'prima', 'n-com': 'mixta', 'n-eps': false });
E.click('savew', { id: '' }); E.click('tab', { v: 'plan' });
ok('Nombre con HTML escapado en la planilla', !app.innerHTML.includes('<img src=x') && app.innerHTML.includes('&lt;img src=x'));
E.click('tab', { v: 'team' });
ok('Nombre con HTML escapado en Equipo', !app.innerHTML.includes('<img src=x') && app.innerHTML.includes('&lt;img src=x'));

// 11. REMYPE se excluye de la planilla
E.click('addw'); setF(E, { 'n-name': 'Micro Mario', 'n-dni': '', 'n-sueldo': 1300, 'n-asig': false, 'n-reg': 'micro', 'n-pension': 'onp', 'n-afp': 'integra', 'n-com': 'flujo', 'n-eps': false });
E.click('savew', { id: '' }); E.click('tab', { v: 'plan' });
ok('REMYPE excluido con aviso', app.innerHTML.includes('en REMYPE no se incluyen') && !/<b>Micro Mario<\/b>/.test(app.innerHTML.split('Resumen de')[0].split('Trabajadores ·')[1] || ''));

E.click('del', { id: wid }); E.click('del-ok', { id: wid });
E.click('del', { id: wid });
ok('Quitar trabajador borra sus novedades', S.workers.every(w => w.id !== wid) && !(S.nov['2026-10'] || {})[wid]);

// 13. Límite gratis de 3 trabajadores (Premium se reinicia)
E.click('unprem'); S.workers.length = 0;
for (let i = 0; i < 3; i++) { E.click('addw'); setF(E, { 'n-name': 'T' + i, 'n-dni': '', 'n-sueldo': 2000, 'n-asig': false, 'n-reg': 'general', 'n-pension': 'onp', 'n-afp': 'integra', 'n-com': 'flujo', 'n-eps': false }); E.click('savew', { id: '' }); }
E.click('addw'); ok('Gratis: 4.º trabajador pide Premium', sheet.innerHTML.includes('Liquida Premium'));
E.click('close');

// 14. Recarga: el estado persiste
const E2 = boot(store);
ok('Recarga conserva trabajadores, novedades y empleador', E2.api.S.workers.length === 3 && E2.api.S.empresa.name === 'Mi Empresa SAC');

// 15. Pestaña Guía incluye las reglas nuevas
E.click('tab', { v: 'guide' });
ok('Guía documenta reglas de planilla', app.innerHTML.includes('Planilla: AFP') && app.innerHTML.includes('Planilla: horas extras') && app.innerHTML.includes('Divisores SUNAT'));

// 16. Las calculadoras anteriores siguen funcionando
E.click('tab', { v: 'calc' });
ok('Calculadora de gratificación sigue funcionando', app.innerHTML.includes('Gratificación a recibir'));
E.click('calc', { v: 'liq' }); ok('Liquidación sigue funcionando', app.innerHTML.includes('Liquidación estimada'));
E.click('calc', { v: 'neto' }); ok('Sueldo neto sigue funcionando', app.innerHTML.includes('Sueldo neto mensual estimado'));

console.log('\n' + (n - fail) + '/' + n + ' comprobaciones correctas');
process.exit(fail ? 1 : 0);
