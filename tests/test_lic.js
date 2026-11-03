// Pruebas de criptografía: el generador (herramientas/generador-codigos.html) emite, la calculadora verifica.
const fs = require('fs');
const calc = fs.readFileSync(process.argv[2], 'utf8');
const gen = fs.readFileSync(process.argv[3], 'utf8');
const pureSrc = calc.split('/*PURE*/')[1].split('/*ENDPURE*/')[0];
const licSrc = gen.split('/*LIC*/')[1].split('/*ENDLIC*/')[0];
const C = new Function(pureSrc + '; return { licParse, licVerify, maskEmail };')();
const G = new Function(licSrc + '; return { genKeys, emit, check, addDays, pubOf, b64u, unb64u };')();

let n = 0, fail = 0;
function ok(name, cond, extra) { n++; if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); }

(async () => {
  const A = await G.genKeys(), B = await G.genKeys();
  ok('Clave pública sin parte privada', A.pub.d === undefined && A.pub.x && A.pub.y && A.pub.kty === 'EC' && A.pub.crv === 'P-256');
  ok('Clave privada incluye d', !!A.priv.d);

  const today = '2026-10-26';
  const code = await G.emit(A.priv, '  Cliente@Correo.COM ', 'anual', '2027-10-27', today);
  ok('Formato LQ1.datos.firma', /^LQ1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(code), code.slice(0, 30));
  console.log('     longitud del código: ' + code.length + ' caracteres');

  let r = await C.licVerify(code, A.pub, today);
  ok('Código válido: ok', r.ok === true, JSON.stringify(r));
  ok('Correo normalizado en minúsculas y sin espacios', r.email === 'cliente@correo.com');
  ok('Plan y vencimiento correctos', r.plan === 'anual' && r.exp === '2027-10-27');

  // Pegado con saltos de línea, espacios y tabulaciones (WhatsApp/correo)
  const messy = '  ' + code.slice(0, 40) + '\n' + code.slice(40, 90) + ' \t' + code.slice(90) + '\n';
  ok('Acepta código pegado con saltos de línea y espacios', (await C.licVerify(messy, A.pub, today)).ok === true);

  // Fechas
  ok('Vale el último día', (await C.licVerify(code, A.pub, '2027-10-27')).ok === true);
  r = await C.licVerify(code, A.pub, '2027-10-28');
  ok('Vencido al día siguiente', r.ok === false && r.reason === 'expired' && r.exp === '2027-10-27' && r.email === 'cliente@correo.com');

  // Fraude
  r = await C.licVerify(code, B.pub, today);
  ok('Código firmado con OTRA clave: rechazado', r.ok === false && r.reason === 'signature');
  const parts = code.split('.');
  const forgedData = G.b64u(new TextEncoder().encode(JSON.stringify({ v: 1, e: 'cliente@correo.com', p: 'anual', x: '2099-12-31', i: today })));
  r = await C.licVerify('LQ1.' + forgedData + '.' + parts[2], A.pub, today);
  ok('Cambiar la fecha de vencimiento invalida la firma', r.ok === false && r.reason === 'signature');
  const forgedMail = G.b64u(new TextEncoder().encode(JSON.stringify({ v: 1, e: 'otro@correo.com', p: 'anual', x: '2027-10-27', i: today })));
  r = await C.licVerify('LQ1.' + forgedMail + '.' + parts[2], A.pub, today);
  ok('Cambiar el correo invalida la firma', r.ok === false && r.reason === 'signature');
  const sig = G.unb64u(parts[2]); sig[10] ^= 1;
  r = await C.licVerify('LQ1.' + parts[1] + '.' + G.b64u(sig), A.pub, today);
  ok('Firma alterada en 1 bit: rechazada', r.ok === false && r.reason === 'signature');
  const monthly = await G.emit(A.priv, 'cliente@correo.com', 'mensual', '2026-11-26', today);
  r = await C.licVerify('LQ1.' + monthly.split('.')[1] + '.' + parts[2], A.pub, today);
  ok('Mezclar datos de un código con la firma de otro: rechazado', r.ok === false && r.reason === 'signature');
  // Un cliente intenta fabricar su propio par de claves y firmar: no vale con la clave pública del sitio
  const mine = await G.emit(B.priv, 'ladron@correo.com', 'anual', '2099-12-31', today);
  r = await C.licVerify(mine, A.pub, today);
  ok('Código fabricado con una clave propia: rechazado', r.ok === false && r.reason === 'signature');

  // Formato y casos límite
  for (const bad of ['', '   ', 'hola', 'LQ1', 'LQ1..', 'LQ1.abc', 'LQ2.' + parts[1] + '.' + parts[2], 'LQ1.' + parts[1], 'LQ1.%%%.@@@', null, undefined]) {
    r = await C.licVerify(bad, A.pub, today);
    ok('Formato inválido rechazado: ' + JSON.stringify(bad), r.ok === false && (r.reason === 'format'), JSON.stringify(r));
  }
  const badPlan = G.b64u(new TextEncoder().encode(JSON.stringify({ v: 1, e: 'a@b.com', p: 'vitalicio', x: '2099-01-01' })));
  r = await C.licVerify('LQ1.' + badPlan + '.' + parts[2], A.pub, today);
  ok('Plan desconocido rechazado como formato', r.ok === false && r.reason === 'format');
  r = await C.licVerify(code, null, today);
  ok('Sin clave configurada: reason nokey', r.ok === false && r.reason === 'nokey');
  r = await C.licVerify(code, { kty: 'EC', crv: 'P-256', x: 'AAAA', y: 'BBBB' }, today);
  ok('Clave pública corrupta no rompe la página', r.ok === false && r.reason === 'crypto');

  // Generador: verificación interna y fechas
  const chk = await G.check(A.priv, code, today);
  ok('Generador verifica su propio código', chk.ok && chk.email === 'cliente@correo.com' && chk.expired === false);
  const chk2 = await G.check(A.priv, code, '2028-01-01');
  ok('Generador avisa de código vencido', chk2.ok && chk2.expired === true);
  ok('Generador rechaza código de otra clave', (await G.check(B.priv, code, today)).ok === false);
  ok('addDays +31 desde 2026-10-26 = 2026-11-26', G.addDays('2026-10-26', 31) === '2026-11-26');
  ok('addDays +366 desde 2026-10-26 = 2027-10-27', G.addDays('2026-10-26', 366) === '2027-10-27');
  ok('addDays cruza el fin de año', G.addDays('2026-12-30', 3) === '2027-01-02');

  // Utilidades
  ok('maskEmail', C.maskEmail('cliente@correo.com') === 'c***@correo.com' && C.maskEmail('sin-arroba') === 'sin-arroba');

  // Exporta claves de prueba para las pruebas de interfaz
  fs.writeFileSync(__dirname + '/testkeys.json', JSON.stringify({ A: A, B: B, code: code, monthly: monthly }));

  console.log('\n' + (n - fail) + '/' + n + ' pruebas correctas');
  process.exit(fail ? 1 : 0);
})();
