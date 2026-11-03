// Errores ya corregidos que no deben volver: cada caso viene de un hallazgo de la revisión.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const src = html.split('/*PURE*/')[1].split('/*ENDPURE*/')[0];
const A = new Function(src + '; return { cleanW, cleanWs, cleanNov, boleta, liquidacion, sbEstadoValido, AFP_TOPE };')();
let fail = 0, n = 0; const ok = (m, c, x) => { n++; if (!c) fail++; console.log((c ? 'ok   ' : 'FAIL ') + m + (c ? '' : '  ' + (x || ''))); };
const base = { id: 'a', name: 'Ana', sueldo: 3000, reg: 'general' };

// Trabajadores con valores inventados
ok('pensión inválida pasa a AFP (antes: boleta sin descuento)', A.cleanW({ ...base, pension: 'xx' }).pension === 'afp');
ok('AFP inválida (constructor/__proto__) pasa a Integra', A.cleanW({ ...base, afp: 'constructor' }).afp === 'integra' && A.cleanW({ ...base, afp: '__proto__' }).afp === 'integra');
ok('comisión desconocida pasa a «flujo»', A.cleanW({ ...base, comision: 'otra' }).comision === 'flujo');
ok('régimen inválido (constructor) pasa a general', A.cleanW({ ...base, reg: 'constructor' }).reg === 'general');
ok('sueldo infinito o enorme queda acotado', A.cleanW({ ...base, sueldo: 1e999 }).sueldo <= 1e9 && A.cleanW({ ...base, sueldo: 1e308 }).sueldo <= 1e9 && A.cleanW({ ...base, sueldo: -5 }).sueldo === 0);
ok('id con caracteres peligrosos se descarta', A.cleanW({ ...base, id: '"><img src=x>' }) === null || A.cleanW({ ...base, id: '"><img src=x>' }) === undefined || !/[<>"]/.test(A.cleanW({ ...base, id: '"><img src=x>' }).id));
ok('máximo 500 trabajadores', A.cleanWs(Array.from({ length: 900 }, (_, i) => ({ ...base, id: 'w' + i }))).length === 500);

// Novedades del mes
const nv = A.cleanNov({ '2026-11': { a: { bonos: 1e308, faltas: 99, mesesSem: 50, he25: -3 } } })['2026-11'].a;
ok('novedades: bonos ≤ 1e9, faltas ≤ 30, meses ≤ 6, sin negativos', nv.bonos <= 1e9 && nv.faltas === 30 && nv.mesesSem === 6 && nv.he25 === 0);
const b = A.boleta({ ...base, pension: 'afp', afp: 'integra' }, nv, '2026-11');
ok('boleta con bonos enormes (ya acotados) no da NaN ni Infinity', [b.totalIng, b.totalDes, b.neto, b.costo].every(isFinite));

// AFP: el tope solo afecta a la prima
const alto = A.boleta({ ...base, sueldo: 30000, pension: 'afp', afp: 'habitat', comision: 'flujo' }, {}, '2026-03');
const tope = A.AFP_TOPE, esp = Math.round(30000 * 0.10 * 100) / 100 + Math.round(30000 * 0.0147 * 100) / 100 + Math.round(tope * 0.0137 * 100) / 100;
ok('AFP: aporte y comisión sobre todo el sueldo, prima con tope', Math.abs(alto.pen - esp) < 0.05, alto.pen + ' vs ' + esp);

// Liquidación con fechas
const L = A.liquidacion({ ingreso: '2023-01-01', cese: '2023-12-31', sueldo: 3000, reg: 'general', vencidos: 0, despido: false });
ok('liquidación: resultado finito con fechas normales', isFinite(L.total) && L.total > 0);
console.log('\n' + (n - fail) + '/' + n + ' comprobaciones correctas'); process.exit(fail ? 1 : 0);
