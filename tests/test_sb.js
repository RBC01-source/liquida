// Pruebas de Supabase: funciones puras con fetch simulado + flujos de la página.
const fs = require('fs');
const html0 = fs.readFileSync(process.argv[2], 'utf8');
let n = 0, fail = 0;
function ok(name, cond, extra) { n++; if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); }
const tick = () => new Promise(r => setTimeout(r, 40));
const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const P = new Function(html0.split('/*PURE*/')[1].split('/*ENDPURE*/')[0] + '; return { cleanNov, cleanWs, sbMsg, sbCall, sbSession, sbSignUp, sbSignIn, sbRefresh, sbRecover, sbSignOut, sbSuscripcion, sbSubActiva, sbGuardar, sbTraer, sbEstadoValido, firmaUrl };')();
const CFG = { url: 'https://abc.supabase.co/', anon: 'a'.repeat(40) };
function mkFetch(routes) {
  const calls = [];
  const f = async (u, o) => { calls.push({ u, o }); const key = (o.method || 'GET') + ' ' + u.replace('https://abc.supabase.co', '');
    const k = Object.keys(routes).find(x => key.startsWith(x)); if (!k) return { ok: false, status: 404, json: async () => ({}) };
    const r = routes[k]; if (r instanceof Error) throw r; return { ok: r.status < 400, status: r.status, json: async () => r.body }; };
  f.calls = calls; return f;
}
(async () => {
  // sbMsg
  ok('sbMsg credenciales', P.sbMsg({ code: 'invalid_credentials' }) === 'Correo o contraseña incorrectos.');
  ok('sbMsg ya existe', /ya tiene una cuenta/.test(P.sbMsg({ message: 'User already registered' })));
  ok('sbMsg sin conexión', /conexión/.test(P.sbMsg({ status: 0 })));
  ok('sbMsg 429', /Demasiados/.test(P.sbMsg({ status: 429 })));
  ok('sbMsg genérico no filtra detalles', !/secret|stack/i.test(P.sbMsg({ message: 'secret stack' })));
  // sbSession
  ok('sbSession válida', JSON.stringify(P.sbSession({ access_token: 'a', refresh_token: 'r', expires_in: 100, user: { id: 'u', email: 'x@y.pe' } }, 1e6)) === JSON.stringify({ access_token: 'a', refresh_token: 'r', exp: 1100, uid: 'u', email: 'x@y.pe' }));
  ok('sbSession sin token (correo por confirmar) → null', P.sbSession({ id: 'u', email: 'x@y.pe' }, 0) === null && P.sbSession(null, 0) === null);
  // llamadas y cabeceras
  let f = mkFetch({ 'POST /auth/v1/token?grant_type=password': { status: 200, body: { access_token: 'AT', refresh_token: 'RT', user: { id: 'U1', email: 'a@b.pe' } } } });
  const j = await P.sbSignIn(CFG, f, 'a@b.pe', 'clave1234');
  ok('signIn: URL sin doble barra y cabeceras', f.calls[0].u === 'https://abc.supabase.co/auth/v1/token?grant_type=password' && f.calls[0].o.headers.apikey === CFG.anon && f.calls[0].o.headers.Authorization === 'Bearer ' + CFG.anon);
  ok('signIn: cuerpo', JSON.parse(f.calls[0].o.body).password === 'clave1234' && j.access_token === 'AT');
  f = mkFetch({ 'POST /auth/v1/signup?redirect_to=': { status: 200, body: {} } });
  await P.sbSignUp(CFG, f, 'a@b.pe', 'clave1234', 'https://liquida.pe/calculadora.html');
  ok('signUp: redirect_to codificado', f.calls[0].u.endsWith('?redirect_to=' + encodeURIComponent('https://liquida.pe/calculadora.html')));
  f = mkFetch({ 'POST /auth/v1/token': { status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } } });
  let err; try { await P.sbSignIn(CFG, f, 'a@b.pe', 'mala'); } catch (e) { err = e; }
  ok('error HTTP propaga status y code', err && err.status === 400 && err.code === 'invalid_credentials');
  f = mkFetch({ 'POST /auth/v1/token': new Error('boom') });
  err = null; try { await P.sbSignIn(CFG, f, 'a@b.pe', 'x'); } catch (e) { err = e; }
  ok('fallo de red → status 0', err && err.status === 0);
  // suscripción
  f = mkFetch({ 'GET /rest/v1/suscripciones': { status: 200, body: [{ plan: 'anual', vence: '2099-01-01' }] } });
  const sub = await P.sbSuscripcion(CFG, f, 'TOK', 'Ana@B.pe');
  ok('suscripción: filtra por correo en minúsculas y usa el token del usuario', f.calls[0].u.includes('email=eq.ana%40b.pe') && f.calls[0].o.headers.Authorization === 'Bearer TOK');
  ok('suscripción: parsea', sub && sub.plan === 'anual' && sub.vence === '2099-01-01');
  f = mkFetch({ 'GET /rest/v1/suscripciones': { status: 200, body: [{ plan: 'gratis', vence: '2099-01-01' }] } });
  ok('suscripción con plan inválido → null', (await P.sbSuscripcion(CFG, f, 'T', 'a@b.pe')) === null);
  f = mkFetch({ 'GET /rest/v1/suscripciones': { status: 200, body: [{ plan: 'mensual', vence: 'mañana' }] } });
  ok('suscripción con fecha inválida → null', (await P.sbSuscripcion(CFG, f, 'T', 'a@b.pe')) === null);
  f = mkFetch({ 'GET /rest/v1/suscripciones': { status: 200, body: [] } });
  ok('sin fila → null', (await P.sbSuscripcion(CFG, f, 'T', 'a@b.pe')) === null);
  ok('sbSubActiva: vence hoy sigue activa; ayer no', P.sbSubActiva({ vence: '2026-05-10' }, '2026-05-10') && !P.sbSubActiva({ vence: '2026-05-09' }, '2026-05-10') && !P.sbSubActiva(null, '2026-05-10'));
  // datos
  f = mkFetch({ 'POST /rest/v1/datos': { status: 201, body: null } });
  await P.sbGuardar(CFG, f, 'TOK', 'U1', { workers: [] });
  ok('guardar: upsert por user_id', f.calls[0].u.endsWith('/rest/v1/datos?on_conflict=user_id') && /merge-duplicates/.test(f.calls[0].o.headers.Prefer) && JSON.parse(f.calls[0].o.body).user_id === 'U1');
  ok('sbEstadoValido', P.sbEstadoValido({ workers: [], nov: {}, empresa: {} }) && !P.sbEstadoValido({ workers: 'x', nov: {}, empresa: {} }) && !P.sbEstadoValido(null) && !P.sbEstadoValido({ workers: new Array(501).fill(0), nov: {}, empresa: {} }));
  const FU = (loc) => new Function('location', html0.split('/*PURE*/')[1].split('/*ENDPURE*/')[0] + '; return firmaUrl();')(loc);
  ok('firmaUrl: dominio propio', FU({ protocol: 'https:', hostname: 'liquida.pe', href: 'https://liquida.pe/calculadora.html?x=1#y' }) === 'https://liquida.pe/verificar.html');
  ok('firmaUrl: subcarpeta (GitHub Pages)', FU({ protocol: 'https:', hostname: 'rbc01-source.github.io', href: 'https://rbc01-source.github.io/liquida/calculadora.html' }) === 'https://rbc01-source.github.io/liquida/verificar.html');
  ok('firmaUrl: localhost y archivo usan la dirección fija', FU({ protocol: 'http:', hostname: 'localhost', href: 'http://localhost/x.html' }) === 'https://rbc01-source.github.io/liquida/verificar.html' && FU({ protocol: 'file:', hostname: '', href: 'file:///x.html' }) === 'https://rbc01-source.github.io/liquida/verificar.html');

  // ---------- Página ----------
  const SBCFG = { url: 'https://abc.supabase.co', anon: 'a'.repeat(40) };
  const ORIG_SB = html0.match(/window\.LIQUIDA_SB=\{.*?\};/)[0];
  function mkEl(id) { return { id, _h: '', hidden: false, listeners: {}, style: {}, value: '', checked: false, dataset: {}, _t: '', classList: { add() {}, remove() {} }, addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }, focus() {}, remove() {}, select() {}, appendChild() {}, click() {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, set textContent(v) { this._t = v; }, get textContent() { return this._t; } }; }
  const histCalls = { n: 0 };
  function boot(store, cfg, fetchStub, hash) {
    let h = html0.replace(ORIG_SB, () => 'window.LIQUIDA_SB=' + JSON.stringify(cfg) + ';').replace(/window\.LIQUIDA_LIC=\{.*?\};/s, 'window.LIQUIDA_LIC={"pub":{"kty":"EC","crv":"P-256","x":"jgbedcVWIsf8hE0BQABMJshOhnUpZImEkaOREY2D6Xw","y":"uwcfwYZGsqd-Jno9jaM_cDX3iPfHDMx-HgRZ-OHvj4M"},"pay":{"mensual":"","anual":""},"whatsapp":""};');
    const script = h.match(/<script>([\s\S]*?)<\/script>/)[1];
    const fixed = { app: mkEl('app'), toast: mkEl('toast'), sheet: mkEl('sheet') }; fixed.sheet.hidden = true; const fields = {};
    const doc = { getElementById: id => fixed[id] || fields[id] || null, addEventListener() {}, body: { classList: { add() {}, remove() {} }, appendChild() {} }, createElement: () => mkEl('x') };
    const win = { addEventListener() {}, removeEventListener() {}, print() {}, scrollTo() {} };
    const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
    const loc = { hash: hash || '', href: 'https://liquida.pe/calculadora.html', pathname: '/calculadora.html', search: '', protocol: 'https:', hostname: 'liquida.pe', origin: 'https://liquida.pe' };
    const run = new Function('window', 'document', 'localStorage', 'location', 'navigator', 'Blob', 'URL', 'setTimeout', 'clearTimeout', 'fetch', 'history', script + '\n;return { S, onClick };');
    const api = run(win, doc, ls, loc, {}, function () {}, { createObjectURL: () => 'x', revokeObjectURL() {} }, setTimeout, clearTimeout, fetchStub, { replaceState() { histCalls.n++; } });
    return { S: api.S, onClick: api.onClick, app: fixed.app, sheet: fixed.sheet, fields, store, click: (act, o) => api.onClick({ target: { closest: () => ({ dataset: Object.assign({ act }, o || {}) }) } }) };
  }
  const setF = (E, id, v) => { E.fields[id] = { id, value: v }; };
  const routes = (sub) => ({
    'POST /auth/v1/token?grant_type=password': { status: 200, body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'U1', email: 'ana@b.pe' } } },
    'GET /rest/v1/suscripciones': { status: 200, body: sub ? [sub] : [] },
    'POST /rest/v1/datos': { status: 201, body: null },
    'GET /rest/v1/datos': { status: 200, body: [{ estado: { workers: [{ id: 'w9', name: 'Luis' }], nov: {}, empresa: { name: 'ACME', ruc: '20123456789' } } }] },
    'POST /auth/v1/logout': { status: 204, body: null },
    'POST /auth/v1/signup': { status: 200, body: { id: 'U2', email: 'nuevo@b.pe' } },
    'POST /auth/v1/recover': { status: 200, body: {} },
    'GET /auth/v1/user': { status: 200, body: { id: 'U1', email: 'ana@b.pe' } },
  });

  // sin configuración: no hay interfaz de cuentas
  let E = boot({}, { url: '', anon: '' }, mkFetch({}));
  ok('Sin Supabase configurado no hay botón de cuenta', !E.app.innerHTML.includes('data-act="cuenta"'));
  E.click('cuenta'); ok('…y tocar «cuenta» no abre nada', E.sheet.hidden === true);

  // con configuración
  let F = mkFetch(routes({ plan: 'mensual', vence: '2099-12-31' }));
  const store = {}; E = boot(store, SBCFG, F);
  ok('Con Supabase aparece «Entrar»', /data-act="cuenta"[^>]*>Entrar</.test(E.app.innerHTML));
  ok('Arranca sin Premium', E.S.premium === false);
  E.click('cuenta');
  ok('Hoja con correo y contraseña (type=password)', E.sheet.innerHTML.includes('id="sb-email"') && /id="sb-pass" type="password"/.test(E.sheet.innerHTML));
  setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', '123'); E.click('sb-login'); await tick();
  ok('Contraseña corta se rechaza sin llamar al servidor', /al menos 8/.test(E.sheet.innerHTML) && F.calls.length === 0);
  setF(E, 'sb-email', 'no-es-correo'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick();
  ok('Correo inválido se rechaza', /correo válido/.test(E.sheet.innerHTML) && F.calls.length === 0);
  setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  ok('Login: sesión iniciada y Premium por suscripción', E.S.sb.sess && E.S.sb.sess.email === 'ana@b.pe' && E.S.subPrem === true && E.S.premium === true);
  ok('Sesión guardada en liquida.sb.v1 sin contraseña', !!store['liquida.sb.v1'] && !store['liquida.sb.v1'].includes('clave12345'));
  ok('El Premium por cuenta NO se guarda en el almacenamiento principal', !/"premium":true|"subPrem":true/.test(store['liquida.v1'] || ''));
  ok('Chip muestra «Mi cuenta» y «Premium»', E.app.innerHTML.includes('<b>Mi cuenta</b>') && E.app.innerHTML.includes('<b>Premium</b>'));
  ok('Hoja de cuenta muestra plan y vencimiento', /plan <b>mensual<\/b>/.test(E.sheet.innerHTML) && E.sheet.innerHTML.includes('31/12/2099'));
  E.click('prem'); ok('Hoja Premium: activo por cuenta', /Premium activo con tu cuenta/.test(E.sheet.innerHTML));

  // guardar y traer
  E.click('cuenta'); E.click('sb-save'); await tick(); await tick();
  const put = F.calls.find(c => c.u.includes('/rest/v1/datos?on_conflict'));
  const body = put && JSON.parse(put.o.body);
  ok('Guardar: envía solo workers, nov y empresa', body && Object.keys(body.estado).sort().join() === 'empresa,nov,workers' && body.user_id === 'U1');
  ok('Guardar usa el token del usuario, no la anon key', put.o.headers.Authorization === 'Bearer AT');
  E.click('sb-load'); ok('Traer pide confirmación', /reemplaza/.test(E.sheet.innerHTML));
  E.click('sb-load-no'); ok('Cancelar no cambia datos', E.S.workers.every(w => w.id !== 'w9'));
  E.click('sb-load'); E.click('sb-load-ok'); await tick(); await tick();
  ok('Traer: carga los trabajadores y la empresa', E.S.workers.length === 1 && E.S.workers[0].id === 'w9' && E.S.empresa.name === 'ACME');

  // restaurar al recargar
  const E2 = boot(store, SBCFG, F); await tick(); await tick(); await tick();
  ok('Al recargar restaura sesión y confirma suscripción', E2.S.sb.sess && E2.S.premium === true);

  // cerrar sesión
  E.click('sb-out'); await tick();
  ok('Cerrar sesión: sin sesión, sin Premium y sin rastro', !E.S.sb.sess && E.S.premium === false && !store['liquida.sb.v1']);
  ok('Se avisó al servidor del logout', F.calls.some(c => c.u.endsWith('/auth/v1/logout?scope=local')));

  // suscripción vencida
  F = mkFetch(routes({ plan: 'mensual', vence: '2000-01-01' })); E = boot({}, SBCFG, F);
  E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  ok('Suscripción vencida: sin Premium y lo explica', E.S.premium === false && /venció el <b>01\/01\/2000/.test(E.sheet.innerHTML));
  // sin suscripción
  F = mkFetch(routes(null)); E = boot({}, SBCFG, F);
  E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  ok('Sin suscripción: sin Premium', E.S.premium === false && /No hay una suscripción/.test(E.sheet.innerHTML));
  // credenciales malas
  F = mkFetch({ 'POST /auth/v1/token': { status: 400, body: { error_code: 'invalid_credentials' } } }); E = boot({}, SBCFG, F);
  E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  ok('Credenciales malas: mensaje claro, sin sesión', !E.S.sb.sess && E.sheet.innerHTML.includes('Correo o contraseña incorrectos.'));
  // registro con confirmación por correo
  F = mkFetch(routes(null)); E = boot({}, SBCFG, F);
  E.click('cuenta'); E.click('sb-mode', { v: 'signup' }); ok('Modo crear cuenta usa new-password', E.sheet.innerHTML.includes('autocomplete="new-password"'));
  setF(E, 'sb-email', 'nuevo@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-signup'); await tick(); await tick();
  ok('Registro: pide confirmar correo, sin sesión', !E.S.sb.sess && /confirmar tu cuenta/.test(E.sheet.innerHTML));
  ok('Registro envía redirect_to a la calculadora', F.calls[0].u.includes('redirect_to=' + encodeURIComponent('https://liquida.pe/calculadora.html')));
  // recuperar
  setF(E, 'sb-email', 'nuevo@b.pe'); E.click('sb-mode', { v: 'login' }); E.click('sb-reset'); await tick(); await tick();
  ok('Olvidé mi contraseña: mensaje neutro', /Si ese correo tiene cuenta/.test(E.sheet.innerHTML) && F.calls.some(c => c.u.includes('/auth/v1/recover')));
  // enlace del correo (confirmación / recuperación): ahora pide confirmar
  F = mkFetch(routes({ plan: 'anual', vence: '2099-01-01' })); histCalls.n = 0;
  E = boot({}, SBCFG, F, '#access_token=AT2&refresh_token=RT2&expires_in=3600&type=recovery'); await tick(); await tick(); await tick();
  ok('Enlace con tokens: NO inicia sesión solo y pide confirmar', !E.S.sb.sess && /Enlace de acceso/.test(E.sheet.innerHTML) && E.sheet.innerHTML.includes('ana@b.pe') && E.sheet.innerHTML.includes('data-act="sb-adopt"'));
  ok('Los tokens se quitan de la barra de direcciones', histCalls.n === 1);
  E.click('sb-adopt-no'); ok('Cancelar: sin sesión y sin guardar nada', !E.S.sb.sess && E.sheet.hidden === true);
  E = boot({}, SBCFG, mkFetch(routes({ plan: 'anual', vence: '2099-01-01' })), '#access_token=AT2&refresh_token=RT2&expires_in=3600&type=recovery'); await tick(); await tick(); await tick();
  E.click('sb-adopt'); await tick(); await tick();
  ok('Aceptar enlace de recuperación: abre nueva contraseña', E.S.sb.sess && E.sheet.innerHTML.includes('id="sb-new"'));
  F = mkFetch(routes(null)); E = boot({}, SBCFG, F, '#access_token=AT2&refresh_token=RT2&expires_in=3600&type=recovery'); await tick(); await tick(); await tick(); E.click('sb-adopt'); await tick(); await tick();
  setF(E, 'sb-new', 'otraclave99'); E.click('sb-newpass'); await tick(); await tick();
  ok('Nueva contraseña enviada con PUT /auth/v1/user', F.calls.some(c => c.o.method === 'PUT' && c.u.endsWith('/auth/v1/user') && JSON.parse(c.o.body).password === 'otraclave99'));
  E = boot({}, SBCFG, mkFetch({ 'GET /auth/v1/user': { status: 401, body: {} } }), '#access_token=BAD&refresh_token=R'); await tick(); await tick(); await tick();
  ok('Enlace inválido: sin sesión y la URL igual se limpia', !E.S.sb.sess && !E.sheet.innerHTML.includes('Enlace de acceso'));
  // sesión vencida → refresh
  const old = { access_token: 'OLD', refresh_token: 'RTOLD', exp: 1, uid: 'U1', email: 'ana@b.pe' };
  F = mkFetch(Object.assign(routes({ plan: 'anual', vence: '2099-01-01' }), { 'POST /auth/v1/token?grant_type=refresh_token': { status: 200, body: { access_token: 'NEW', refresh_token: 'RTNEW', expires_in: 3600, user: { id: 'U1', email: 'ana@b.pe' } } } }));
  const st = { 'liquida.sb.v1': JSON.stringify(old) }; E = boot(st, SBCFG, F); await tick(); await tick(); await tick();
  ok('Token vencido se renueva con refresh_token', JSON.parse(st['liquida.sb.v1']).access_token === 'NEW' && E.S.premium === true);
  // refresh rechazado → sesión descartada
  F = mkFetch({ 'POST /auth/v1/token?grant_type=refresh_token': { status: 400, body: { error_code: 'refresh_token_not_found' } } });
  const st2 = { 'liquida.sb.v1': JSON.stringify(old) }; E = boot(st2, SBCFG, F); await tick(); await tick(); await tick();
  ok('Refresh rechazado: se descarta la sesión', !E.S.sb.sess && !st2['liquida.sb.v1'] && E.S.premium === false);
  // sin internet al abrir: no se concede Premium por cuenta
  F = mkFetch({ 'GET /rest/v1/suscripciones': new Error('offline') });
  const st3 = { 'liquida.sb.v1': JSON.stringify(Object.assign({}, old, { exp: 9999999999 })) }; E = boot(st3, SBCFG, F); await tick(); await tick(); await tick();
  ok('Sin conexión: no se da Premium por cuenta', E.S.premium === false && !!E.S.sb.sess);
  // basura en almacenamiento
  E = boot({ 'liquida.sb.v1': '{"x":1}' }, SBCFG, mkFetch({})); await tick(); await tick();
  ok('Sesión corrupta se ignora', !E.S.sb.sess);


  // --- XSS por id de trabajador y validación de datos ---
  const evil = 'x"><img src=x onerror=alert(1)>';
  ok('cleanWs descarta ids peligrosos', P.cleanWs([{ id: evil, name: 'a' }, { id: 'w1', name: 'Ok', sueldo: -5 }]).length === 1 && P.cleanWs([{ id: 'w1', sueldo: -5 }])[0].sueldo === 0);
  ok('sbEstadoValido rechaza trabajadores con id peligroso', !P.sbEstadoValido({ workers: [{ id: evil }], nov: {}, empresa: {} }));
  F = mkFetch(Object.assign(routes({ plan: 'anual', vence: '2099-01-01' }), { 'GET /rest/v1/datos': { status: 200, body: [{ estado: { workers: [{ id: evil, name: 'Mal' }], nov: {}, empresa: {} } }] } }));
  E = boot({}, SBCFG, F); E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  E.click('sb-load'); E.click('sb-load-ok'); await tick(); await tick();
  ok('Datos de la nube con id peligroso: no se cargan', E.S.workers.length === 0 && /formato/.test(E.sheet.innerHTML));
  E = boot({ 'liquida.v1': JSON.stringify({ workers: [{ id: evil, name: 'Mal' }, { id: 'w2', name: '<b>x</b>', sueldo: 2000, reg: 'general' }] }) }, { url: '', anon: '' }, mkFetch({}));
  ok('Datos locales con id peligroso se filtran', E.S.workers.length === 1 && E.S.workers[0].id === 'w2');
  E.click('tab', { v: 'team' });
  ok('Equipo: ids y nombres escapados', !E.app.innerHTML.includes('onerror') && E.app.innerHTML.includes('&lt;b&gt;x&lt;/b&gt;'));

  // --- carrera: respuesta tardía tras cerrar sesión ---
  let release; const gate = new Promise(r => { release = r; });
  const slow = mkFetch(routes({ plan: 'anual', vence: '2099-01-01' })); const baseF = slow.bind ? slow : slow;
  const slowF = async (u, o) => { if (u.includes('/rest/v1/suscripciones')) { await gate; } return slow(u, o); }; slowF.calls = slow.calls;
  const st4 = { 'liquida.sb.v1': JSON.stringify({ access_token: 'T', refresh_token: 'R', exp: 9999999999, uid: 'U1', email: 'ana@b.pe' }) };
  E = boot(st4, SBCFG, slowF); await tick();
  E.click('sb-out'); await tick(); release(); await tick(); await tick(); await tick();
  ok('Respuesta tardía tras cerrar sesión NO da Premium', E.S.premium === false && E.S.subPrem === false && !E.S.sb.sess);

  // --- error de red ≠ sin suscripción; vigencia al renderizar ---
  F = mkFetch({ 'GET /rest/v1/suscripciones': new Error('offline') });
  E = boot({ 'liquida.sb.v1': JSON.stringify({ access_token: 'T', refresh_token: 'R', exp: 9999999999, uid: 'U1', email: 'ana@b.pe' }) }, SBCFG, F); await tick(); await tick(); await tick();
  E.click('cuenta');
  ok('Sin red: dice que no pudo consultar (no «sin suscripción»)', /No pudimos consultar/.test(E.sheet.innerHTML) && !/No hay una suscripción/.test(E.sheet.innerHTML) && E.sheet.innerHTML.includes('sb-recheck'));
  E = boot({}, SBCFG, mkFetch(routes({ plan: 'mensual', vence: '2099-01-01' }))); E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  ok('Premium activo antes de vencer', E.S.premium === true);
  E.S.sub = { plan: 'mensual', vence: '2000-01-01' }; E.click('tab', { v: 'plan' });
  ok('Al vencer durante la sesión, el siguiente render quita Premium', E.S.premium === false);

  // --- correo escrito se conserva tras un error ---
  F = mkFetch({ 'POST /auth/v1/token': { status: 400, body: { error_code: 'invalid_credentials' } } }); E = boot({}, SBCFG, F);
  E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'mala12345'); E.click('sb-login'); await tick(); await tick();
  ok('Tras un error el correo sigue escrito y la contraseña no', E.sheet.innerHTML.includes('value="ana@b.pe"') && !E.sheet.innerHTML.includes('mala12345'));

  // --- cerrar sesión y borrar datos de este equipo ---
  const st5 = { 'liquida.v1': JSON.stringify({ workers: [{ id: 'w1', name: 'Ana', sueldo: 2000, reg: 'general' }], lic: 'LQ1.x.y' }), 'liquida.sign.v1': '{"k":1}', 'liquida.firmas.v1': '{"a":"b"}' };
  F = mkFetch(routes({ plan: 'anual', vence: '2099-01-01' })); E = boot(st5, SBCFG, F);
  E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  E.click('sb-out'); await tick();
  ok('Cerrar sesión normal conserva los datos locales', !!st5['liquida.v1'] && E.S.workers.length === 1);
  E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  E.click('sb-wipe'); ok('Borrar pide confirmación', /Se borran de este equipo/.test(E.sheet.innerHTML) && !!st5['liquida.v1']);
  E.click('sb-wipe-ok'); await tick();
  ok('Cerrar y borrar: sin trabajadores, sin llaves ni firmas, sin sesión', E.S.workers.length === 0 && !st5['liquida.sign.v1'] && !st5['liquida.firmas.v1'] && !st5['liquida.sb.v1'] && !E.S.sb.sess);

  // --- eliminar trabajador con confirmación ---
  E = boot({ 'liquida.v1': JSON.stringify({ workers: [{ id: 'w1', name: 'Ana', sueldo: 2000, reg: 'general' }] }) }, { url: '', anon: '' }, mkFetch({}));
  E.click('del', { id: 'w1' }); ok('Eliminar pide confirmar y aún no borra', E.S.workers.length === 1 && /¿Eliminar a Ana\?/.test(E.sheet.innerHTML));
  E.click('del-ok', { id: 'w1' }); ok('Confirmar elimina', E.S.workers.length === 0);

  // --- cálculo ---
  const Q = new Function(html0.split('/*PURE*/')[1].split('/*ENDPURE*/')[0] + '; return { span, honorarios, cts, liquidacion };')();
  ok('span 31-ene → 28-feb: 1 mes, sin días negativos', JSON.stringify(Q.span('2026-01-31', '2026-02-28')) === '{"m":1,"d":0}');
  ok('span 30-ene → 28-feb y 31-dic → 28-feb sin negativos', Q.span('2026-01-30', '2026-02-28').d >= 0 && Q.span('2026-12-31', '2027-02-28').d >= 0 && Q.span('2026-01-31', '2026-03-01').d >= 0);
  ok('span normal intacto (1-ene → 31-ene = 1 mes; 1-ene → 28-feb = 2 meses)', JSON.stringify(Q.span('2026-01-01', '2026-01-31')) === '{"m":1,"d":0}' && JSON.stringify(Q.span('2026-01-01', '2026-02-28')) === '{"m":2,"d":0}');
  const L = Q.liquidacion({ sueldo: 3000, reg: 'general', ingreso: '2026-01-31', cese: '2026-02-28' });
  ok('Liquidación sin días negativos en las etiquetas', !/-\d+ d/.test(JSON.stringify(L)));
  ok('Honorarios: >1,500 retiene 8%; 1,500 no; suspensión no', Q.honorarios(2000, false).ret === 160 && Q.honorarios(1500, false).ret === 0 && Q.honorarios(2000, true).ret === 0 && Q.honorarios(8000, false).ret === 640);
  ok('CTS: 6 meses + días no pasa del 100% del semestre', Q.cts({ sueldo: 3000, reg: 'general', meses: 6, dias: 29, gratiLast: '' }).total === Q.cts({ sueldo: 3000, reg: 'general', meses: 6, dias: 0, gratiLast: '' }).total);

  // --- ronda 2 ---
  const R = new Function(html0.split('/*PURE*/')[1].split('/*ENDPURE*/')[0] + '; return { gratificacion, vacTrunca, cts, cleanNov };')();
  ok('Gratificación limita a 6 meses', R.gratificacion({ sueldo: 2000, reg: 'general', meses: 12 }).total === 2180);
  ok('Vacaciones truncas limita a 11 meses y 29 días', R.vacTrunca({ sueldo: 3000, reg: 'general', meses: 12, dias: 99 }) === R.vacTrunca({ sueldo: 3000, reg: 'general', meses: 11, dias: 29 }));
  ok('cleanNov quita nulos, ids raros y valores no numéricos', JSON.stringify(R.cleanNov({ '2026-01': null, '2026-02': { w1: { faltas: '2', x: 9, bonos: 'abc' }, '<b>': { faltas: 1 } }, malo: { w1: {} } })) === '{"2026-02":{"w1":{"faltas":2}}}');
  E = boot({ 'liquida.v1': JSON.stringify({ workers: [{ id: 'w1', name: 'A', sueldo: 1, reg: 'general' }], nov: { '2026-01': null } }) }, { url: '', anon: '' }, mkFetch({}));
  E.click('del', { id: 'w1' }); E.click('del-ok', { id: 'w1' }); ok('Eliminar con novedades nulas guardadas no revienta', E.S.workers.length === 0);
  E = boot({}, { url: '', anon: '' }, mkFetch({}), '#calc=grati&sueldo=2000&meses=12'); E.click('tab', { v: 'calc' });
  ok('Hash con meses=12 en gratificación se limita a 6', E.S.f.meses === 6 && /Gratificaci/.test(E.app.innerHTML));
  ok('Botones de pestañas usan aria-pressed, sin roles de pestaña falsos', E.app.innerHTML.includes('aria-pressed') && !E.app.innerHTML.includes('role="tab"') && !E.app.innerHTML.includes('role="tablist"'));
  ok('Calculadora tiene h1 oculto', E.app.innerHTML.includes('<h1 class="sr">'));
  // token vencido + caída de red/5xx → «no pudimos consultar», no «sin suscripción»
  for (const bad of [new Error('offline'), { status: 503, body: {} }]) {
    F = mkFetch({ 'POST /auth/v1/token?grant_type=refresh_token': bad });
    E = boot({ 'liquida.sb.v1': JSON.stringify({ access_token: 'OLD', refresh_token: 'R', exp: 1, uid: 'U1', email: 'ana@b.pe' }) }, SBCFG, F); await tick(); await tick(); await tick();
    E.click('cuenta');
    ok('Refresco falla (' + (bad.status || 'red') + '): conserva la sesión y avisa que no pudo consultar', !!E.S.sb.sess && /No pudimos consultar/.test(E.sheet.innerHTML) && !/No hay una suscripción/.test(E.sheet.innerHTML));
  }
  // carrera: «Traer datos» y luego «Cerrar y borrar»
  let rel2; const gate2 = new Promise(r => { rel2 = r; });
  const base2 = mkFetch(routes({ plan: 'anual', vence: '2099-01-01' }));
  const f2 = async (u, o) => { if (u.includes('/rest/v1/datos') && (o.method || 'GET') === 'GET') await gate2; return base2(u, o); }; f2.calls = base2.calls;
  const st6 = { 'liquida.v1': JSON.stringify({ workers: [{ id: 'w1', name: 'Ana', sueldo: 1, reg: 'general' }] }) };
  E = boot(st6, SBCFG, f2); E.click('cuenta'); setF(E, 'sb-email', 'ana@b.pe'); setF(E, 'sb-pass', 'clave12345'); E.click('sb-login'); await tick(); await tick();
  E.click('sb-load'); E.click('sb-load-ok'); await tick(); E.click('sb-wipe'); E.click('sb-wipe-ok'); await tick(); rel2(); await tick(); await tick(); await tick();
  ok('Datos «traídos» tarde no reaparecen tras borrar el equipo', E.S.workers.length === 0 && !(st6['liquida.v1'] || '').includes('Luis'));
  console.log('\n' + (n - fail) + '/' + n + ' comprobaciones correctas'); process.exit(fail ? 1 : 0);
})();
