// Extrae el bloque PURE de calculadora.html y lo prueba con casos hechos a mano.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const src = html.split('/*PURE*/')[1].split('/*ENDPURE*/')[0];
const api = new Function(src + '; return { RMV, UIT, ASIG, r2, bracketTax, ret5ta, boleta, planillaMes, gratificacion, cts, DIV5, AFP_TOPE };')();
const { RMV, UIT, ASIG, ret5ta, boleta, planillaMes, bracketTax, DIV5, AFP_TOPE } = api;

let fail = 0, n = 0;
function eq(name, got, want, tol) {
  n++; tol = tol == null ? 0.011 : tol;
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fail++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + ' -> ' + got + (ok ? '' : ' (esperado ' + want + ')'));
}

// Constantes
eq('RMV', RMV, 1230); eq('UIT', UIT, 5500); eq('Asig. familiar', ASIG, 123);
eq('Divisores SUNAT ene..dic', DIV5.join(',') === '12,12,12,9,8,8,8,5,4,4,4,1' ? 1 : 0, 1, 0);

// Bloques de SUNAT: cuántos meses de retenciones se restan en cada mes
{ const exp = [0, 0, 0, 3, 4, 4, 4, 7, 8, 8, 8, 11];
  const sub = new Function(src + '; return SUB5;')();
  eq('Meses restados por bloque', sub.join(',') === exp.join(',') ? 1 : 0, 1, 0); }

// Caso 1: S/ 3,000 + asig. familiar, octubre, AFP Integra flujo, sin novedades
const w1 = { id: 'a', name: 'Ana', sueldo: 3000, asig: true, reg: 'general', pension: 'afp', afp: 'integra', comision: 'flujo' };
let b = boleta(w1, {}, '2026-10');
eq('C1 total ingresos', b.totalIng, 3123);
eq('C1 AFP total (10% + 1.55% + 1.37%)', b.pen, 403.50);     // 312.30 + 48.41 + 42.79
// Renta anual = 12*3123 + 2*3123*1.09 = 44,284.14; menos 7 UIT (38,500) = 5,784.14; 8% = 462.73; /12 = 38.56
eq('C1 impuesto anual', b.rt.anual, 462.73);
eq('C1 retención 5.ª octubre', b.ret, 38.56);
eq('C1 neto', b.neto, 3123 - 403.50 - 38.56);
eq('C1 EsSalud 9%', b.essalud, 281.07);

// Retención constante en todos los meses cuando el sueldo no cambia (simulación coherente con los divisores)
for (let m = 1; m <= 12; m++) {
  const r = ret5ta({ m: m, rem: 3123, eps: false, varMes: 0, remPrev: null, retPrev: null });
  eq('C1 retención mes ' + m + ' ≈ anual/12', r.ret, 38.56, 0.02);
}
// En diciembre, el acumulado + retención de diciembre debe cerrar en el impuesto anual
{ const r = ret5ta({ m: 12, rem: 3123, eps: false, varMes: 0, remPrev: null, retPrev: null });
  eq('C1 acumulado ene-nov + dic = impuesto anual', r.acum + r.ret, r.anual, 0.02); }

// Caso 2: novedades. Valor hora = 3123 / 240 = 13.0125
const nov2 = { faltas: 2, tardanza: 30, he25: 4, he35: 2, bonos: 100, otros: 50 };
b = boleta(w1, nov2, '2026-10');
const vh = 3123 / 240;
eq('C2 HE 25% (4 h)', b.ing.filter(i => i.k === 'he25')[0].v, 4 * vh * 1.25);           // 65.06
eq('C2 HE 35% (2 h)', b.ing.filter(i => i.k === 'he35')[0].v, 2 * vh * 1.35);           // 35.13
eq('C2 básica 28 días', b.ing.filter(i => i.k === 'bas')[0].v, 3000 / 30 * 28);        // 2800
eq('C2 asig. familiar 28 días', b.ing.filter(i => i.k === 'asg')[0].v, 123 / 30 * 28);  // 114.80
eq('C2 tardanza 30 min', b.tardDesc, vh / 2);                                           // 6.51
const afecta2 = 2800 + 114.8 + 4 * vh * 1.25 + 2 * vh * 1.35 + 100 - vh / 2;
eq('C2 base afecta', b.afecta, afecta2, 0.03);
eq('C2 otros descuentos', b.otros, 50);

// Caso 3: gratificación en julio y diciembre, con y sin EPS (no afecta a AFP ni EsSalud)
const w3 = { id: 'b', name: 'Beto', sueldo: 2000, asig: false, reg: 'general', pension: 'onp' };
b = boleta(w3, {}, '2026-07');
eq('C3 gratificación julio', b.ing.filter(i => i.k === 'gr')[0].v, 2000);
eq('C3 bonificación 9%', b.ing.filter(i => i.k === 'bon')[0].v, 180);
eq('C3 ONP solo sobre sueldo (13% de 2000)', b.pen, 260);
eq('C3 EsSalud solo sobre sueldo', b.essalud, 180);
eq('C3 total ingresos', b.totalIng, 4180);
b = boleta(Object.assign({}, w3, { eps: true }), {}, '2026-12');
eq('C3 bonificación 6.75% con EPS', b.ing.filter(i => i.k === 'bon')[0].v, 135);
b = boleta(w3, { mesesSem: 3 }, '2026-07');
eq('C3 gratificación 3 meses', b.ing.filter(i => i.k === 'gr')[0].v, 1000);
b = boleta(w3, {}, '2026-10');
eq('C3 sin gratificación en octubre', b.ing.filter(i => i.k === 'gr').length, 0);

// Caso 4: CTS en mayo y noviembre. CTS = (2000 + 2000/6) / 12 * 6 = 1166.67
b = boleta(w3, {}, '2026-11'); eq('C4 depósito CTS noviembre', b.ctsDep, 1166.67);
b = boleta(w3, {}, '2026-05'); eq('C4 depósito CTS mayo', b.ctsDep, 1166.67);
b = boleta(w3, {}, '2026-06'); eq('C4 sin CTS en junio', b.ctsDep, 0);

// Caso 5: sueldo alto → tope AFP y tramos de impuesto. 20,000/mes sin asig. familiar
const w5 = { id: 'c', name: 'Carla', sueldo: 20000, asig: false, reg: 'general', pension: 'afp', afp: 'habitat', comision: 'flujo' };
b = boleta(w5, {}, '2026-03');
const bs = AFP_TOPE;
// el tope (remuneración máxima asegurable) solo rige para la prima; aporte y comisión van sobre todo el sueldo
eq('C5 AFP: aporte+comisión sin tope, prima con tope', b.pen, Math.round(20000 * 0.10 * 100) / 100 + Math.round(20000 * 0.0147 * 100) / 100 + Math.round(bs * 0.0137 * 100) / 100, 0.02);
const renta = 12 * 20000 + 2 * 20000 * 1.09 - 7 * UIT;
eq('C5 impuesto anual por tramos', b.rt.anual, bracketTax(renta));
eq('C5 retención marzo = anual / 12', b.ret, bracketTax(renta) / 12, 0.02);
// Comparación manual del impuesto: 5 UIT*8% + 15 UIT*14% + 15 UIT*17% + resto 20% (hasta 45 UIT) ...
{ const neta = renta, t = Math.min(neta, 27500) * 0.08 + Math.max(0, Math.min(neta, 110000) - 27500) * 0.14 + Math.max(0, Math.min(neta, 192500) - 110000) * 0.17 + Math.max(0, Math.min(neta, 247500) - 192500) * 0.20 + Math.max(0, neta - 247500) * 0.30;
  eq('C5 tramos hechos a mano', bracketTax(neta), t, 0.01); }

// Caso 6: sueldo bajo (< 7 UIT anual) → sin retención
b = boleta({ id: 'd', name: 'Dani', sueldo: 1230, asig: false, reg: 'general', pension: 'onp' }, {}, '2026-10');
eq('C6 sin retención con RMV', b.ret, 0);
eq('C6 neto con ONP', b.neto, 1230 - 159.9);

// Caso 7: acumulados informados. Mes de agosto: divisor 5
const r7 = ret5ta({ m: 8, rem: 5000, eps: false, varMes: 0, remPrev: 35000, retPrev: 900 });
eq('C7 divisor agosto', r7.div, 5);
eq('C7 retención = (impuesto − acumulado) / 5', r7.ret, (r7.anual - 900) / 5, 0.02);
const r7b = ret5ta({ m: 12, rem: 5000, eps: false, varMes: 0, remPrev: 55000, retPrev: 2000 });
eq('C7 diciembre regulariza el saldo', r7b.ret, r7b.anual - 2000, 0.02);

// Caso 7b: aumento de sueldo a mitad de año. Mayo: se restan solo las retenciones de ene–abr y se divide entre 8
{ const T = ret5ta({ m: 5, rem: 6000, eps: false, varMes: 0, remPrev: 4 * 4000, retPrev: 4 * 300 }).anual;
  const may = ret5ta({ m: 5, rem: 6000, eps: false, varMes: 0, remPrev: 4 * 4000, retPrev: 4 * 300 });
  eq('C7b mayo = (T − R ene–abr) / 8', may.ret, (T - 1200) / 8, 0.02);
  const jun = ret5ta({ m: 6, rem: 6000, eps: false, varMes: 0, remPrev: 4 * 4000 + 6000, retPrev: 4 * 300 });
  eq('C7b junio resta lo mismo (ene–abr) y divide entre 8', jun.ret, (jun.anual - 1200) / 8, 0.02);
  eq('C7b base anual de mayo', may.rba, 6000 * 8 + 16000 + 2 * 6000 * 1.09, 0.02); }

// Horas extras del mes se suman una vez a la base anual (no se proyectan)
{ const sin = ret5ta({ m: 10, rem: 5000, eps: false, varMes: 0, remPrev: null, retPrev: null });
  const con = ret5ta({ m: 10, rem: 5000, eps: false, varMes: 800, remPrev: null, retPrev: null });
  eq('Variables suman una vez a la base', con.rba - sin.rba, 800, 0.02); }

// Caso 8: 30 días de faltas → sin ingresos, EsSalud 0, neto 0
b = boleta(w1, { faltas: 30 }, '2026-10');
eq('C8 neto con 30 faltas', b.neto, 0); eq('C8 EsSalud mínimo prorrateado', b.essalud, 0);

// Caso 9: mixta → sin comisión de flujo
b = boleta(Object.assign({}, w1, { comision: 'mixta' }), {}, '2026-10');
eq('C9 AFP mixta (10% + 1.37%)', b.pen, 312.30 + 42.79);

// Caso 10: planilla completa. Se excluyen otros regímenes
const pm = planillaMes([w1, w3, { id: 'x', name: 'Xavi', sueldo: 1500, reg: 'micro' }], {}, '2026-10');
eq('C10 trabajadores en planilla', pm.rows.length, 2); eq('C10 excluidos', pm.excl.length, 1);
eq('C10 neto total', pm.t.neto, pm.rows.reduce((a, r) => a + r.b.neto, 0), 0.02);
eq('C10 costo = ingresos + EsSalud', pm.t.costo, pm.t.ing + pm.t.essalud, 0.02);
eq('C10 ingresos − descuentos = neto', pm.t.ing - pm.t.des, pm.t.neto, 0.02);

console.log('\n' + (n - fail) + '/' + n + ' pruebas correctas');
process.exit(fail ? 1 : 0);
