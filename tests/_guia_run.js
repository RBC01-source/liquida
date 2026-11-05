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


const store={}; const E=boot(store); const app=E.fixed.app;
ok('Pestaña Beneficios en el menú', /data-v="guide"[^>]*>Beneficios</.test(app.innerHTML));
E.click('tab',{v:'guide'});
ok('Beneficios: título, selector de régimen y 4 grupos', app.innerHTML.includes('<h2>Beneficios sociales</h2>') && (app.innerHTML.match(/data-act="reg-ben"/g)||[]).length===3 && (app.innerHTML.match(/<h3 class="gt"/g)||[]).length===4);
ok('Beneficios: 12 desplegables + reglas, solo el primero abierto', (app.innerHTML.match(/<details class="acc"/g)||[]).length===13 && (app.innerHTML.match(/<details class="acc" id="b-\w+" open>/g)||[]).length===1);
ok('Beneficios: franja de próximas fechas', /class="prox"[^>]*><div class="pl"><b>(CTS|Gratificación)/.test(app.innerHTML));
ok('Régimen general por defecto', app.innerHTML.includes('Un sueldo en julio y otro en diciembre') && app.innerHTML.includes('aria-pressed="true">General<'));
E.click('reg-ben',{v:'pequena'});
ok('Pequeña empresa: cambia el texto y el régimen de la calculadora', E.api.S.f.reg==='pequena' && app.innerHTML.includes('Medio sueldo en julio') && !app.innerHTML.includes('Un sueldo en julio y otro en diciembre'));
E.click('reg-ben',{v:'micro'});
ok('Microempresa: sin gratificación ni CTS y con aviso', E.api.S.f.reg==='micro' && app.innerHTML.includes('No tiene derecho a CTS.') && app.innerHTML.includes('no paga gratificaciones ni CTS'));
E.click('reg-ben',{v:'inventado'});
ok('Régimen inválido se ignora', E.api.S.f.reg==='micro');
ok('Cada beneficio tiene ícono y botón de calcular donde corresponde', (app.innerHTML.match(/<svg class="bi"/g)||[]).length===12 && (app.innerHTML.match(/class="btn sm go"/g)||[]).length===7);
E.click('reg-ben',{v:'general'});
E.click('ir-calc',{v:'cts'});
ok('Botón calcular abre la calculadora correcta', E.api.S.tab==='calc' && E.api.S.calc==='cts');
E.click('ir-calc',{v:'inventado'});
ok('Calculadora inválida se ignora', E.api.S.calc==='cts');
E.click('tab',{v:'guide'});
E.click('ben-all');
ok('Abrir todos', E.api.S.benAll===true && (app.innerHTML.match(/<details class="acc" id="b-\w+" open>/g)||[]).length===12 && app.innerHTML.includes('Cerrar todos'));
E.click('ben-all');
ok('Cerrar todos', E.api.S.benAll===false && app.innerHTML.includes('Abrir todos'));
const box={innerHTML:''}; E.fields['ben-list']=box;
E.input({benq:'1'},'cts');
ok('Buscar «cts» filtra la lista sin volver a dibujar la pantalla', box.innerHTML.includes('id="b-cts"') && !box.innerHTML.includes('id="b-vac"') && E.api.S.benQ==='cts');
E.input({benq:'qqq'},'qqq'); ok('Sin resultados', box.innerHTML.includes('No encontré beneficios'));
E.input({benq:'1'},''); ok('Búsqueda vacía muestra todo', (box.innerHTML.match(/<details/g)||[]).length===12);
ok('Reglas de Liquida siguen en un desplegable', E.fixed.app.innerHTML.includes('Reglas y cifras que usa Liquida') && app.innerHTML.includes('Remuneración Mínima Vital'));
ok('Enlace a la guía completa', app.innerHTML.includes('href="beneficios-sociales-peru.html"'));
console.log('\n'+(n-fail)+'/'+n+' comprobaciones correctas'); process.exit(fail?1:0);