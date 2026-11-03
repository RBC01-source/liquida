// Configura Liquida para tu dominio y tu proyecto de Supabase.
// Uso:
//   node herramientas/configurar-sitio.mjs --dominio https://tudominio.com
//   node herramientas/configurar-sitio.mjs --supabase-url https://xxxx.supabase.co --anon eyJ...
// Se pueden dar las tres opciones juntas. Nunca uses aquí la clave "service_role".
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const dominio = opt('dominio'), sbUrl = opt('supabase-url'), anon = opt('anon'), desde = opt('desde') || 'https://rbc01-source.github.io/liquida';
const falla = m => { console.error('Error: ' + m); process.exit(1); };

if (!dominio && !sbUrl && !anon) falla('indica --dominio, o --supabase-url junto con --anon.');
if (!!sbUrl !== !!anon) falla('--supabase-url y --anon van juntos.');
let dom;
if (dominio) {
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/[A-Za-z0-9._~\/-]*)?$/i.test(dominio)) falla('el dominio debe ser una dirección https válida, por ejemplo https://liquida.pe');
  dom = dominio.replace(/\/+$/, '');
}
if (sbUrl) {
  if (!/^https:\/\/[a-z0-9]{10,30}\.supabase\.co\/?$/.test(sbUrl)) falla('la URL de Supabase debe verse así: https://abcdefghij.supabase.co');
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anon) && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(anon)) falla('la clave "anon" no tiene el formato esperado.');
  if (/^eyJ/.test(anon)) {
    try { const rol = JSON.parse(Buffer.from(anon.split('.')[1], 'base64url').toString()).role; if (rol !== 'anon') falla('esa clave tiene el rol "' + rol + '". Usa SOLO la clave "anon" (pública). La "service_role" es secreta y no debe ir en el sitio.'); }
    catch { falla('no se pudo leer la clave "anon".'); }
  }
}

const archivos = [];
(function rec(d) { for (const e of readdirSync(d, { withFileTypes: true })) {
  if (e.name === '.git' || e.name === 'node_modules') continue;
  const p = join(d, e.name);
  if (e.isDirectory()) rec(p); else if (/\.(html|xml|txt)$/.test(e.name)) archivos.push(p);
} })(raiz);

let cambios = 0;
for (const f of archivos) {
  let s = readFileSync(f, 'utf8'), o = s;
  if (dom) s = s.split(desde).join(dom);
  if (sbUrl && /window\.LIQUIDA_SB=\{.*?\};/.test(s)) s = s.replace(/window\.LIQUIDA_SB=\{.*?\};/, () => 'window.LIQUIDA_SB=' + JSON.stringify({ url: sbUrl.replace(/\/+$/, ''), anon }) + ';');
  if (s !== o) { writeFileSync(f, s); cambios++; console.log('actualizado: ' + f.slice(raiz.length + 1)); }
}
console.log(cambios ? 'Listo: ' + cambios + ' archivo(s).' : 'No hubo nada que cambiar.');
