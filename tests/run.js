// Ejecuta todas las pruebas de Liquida. Uso: node tests/run.js [--rapido]   (--rapido omite las de navegador)
const { spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const R = path.resolve(__dirname, '..'), T = __dirname;
const C = path.join(R, 'calculadora.html'), G = path.join(R, 'herramientas/generador-codigos.html');
// Versión sin clave de licencia, para probar el flujo Premium de demostración
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'liquida-')), D = path.join(dir, 'demo.html');
fs.writeFileSync(D, fs.readFileSync(C, 'utf8').replace(/window\.LIQUIDA_LIC=\{.*?\};?\n/, 'window.LIQUIDA_LIC={};\n'));
const suites = [
  ['Cálculos de planilla y boleta', 'test_planilla.js', [C]],
  ['Datos guardados dañados', 'test_r4.js', [C]],
  ['Regresiones de errores ya corregidos', 'test_regresion.js', [C]],
  ['Licencias (generador ↔ calculadora)', 'test_lic.js', [C, G]],
  ['Premium con licencia en pantalla', 'test_ui_lic2.js', [C, G]],
  ['Firma y verificación de boletas', 'test_firma.js', [C, path.join(R, 'verificar.html')]],
  ['Beneficios (fechas y guía)', 'test_ben.js', [C, path.join(R, 'beneficios-sociales-peru.html')]],
  ['Cuenta y suscripción (Supabase simulado)', 'test_sb.js', [C]],
  ['Interfaz: flujos completos', 'test_ui.js', [D]],
  ['Interfaz: firma en pantalla', 'test_firma_ui.js', [D]],
  ['Interfaz: guía de beneficios', 'test_guia.js', [C]],
];
if (!process.argv.includes('--rapido')) {
  suites.push(['Seguridad en navegador (ataques simulados)', 'seguridad-navegador.js', []]);
  suites.push(['Usuario simulado en Android, iPhone e iPad', 'e2e-dispositivos.js', []]);
}
let malas = 0;
for (const [nombre, f, args] of suites) {
  const r = spawnSync('node', [path.join(T, f), ...args], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || ''), res = (out.match(/(\d+)\/(\d+) (pruebas|comprobaciones) correctas/) || [])[0];
  const bien = r.status === 0 && res && res.split('/')[0] === res.split('/')[1].split(' ')[0];
  if (!bien) { malas++; console.log('✗ ' + nombre + ' — ' + (res || 'sin resultado') + '\n' + out.split('\n').filter(l => /FAIL|Error/.test(l)).slice(0, 8).join('\n')); }
  else console.log('✓ ' + nombre + ' — ' + res);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(malas ? '\n' + malas + ' grupo(s) de pruebas con fallos' : '\nTodas las pruebas pasan');
process.exit(malas ? 1 : 0);
