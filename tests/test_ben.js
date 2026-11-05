const fs=require('fs');
const calc=fs.readFileSync(process.argv[2],'utf8'), page=fs.readFileSync(process.argv[3],'utf8');
let n=0,fail=0; function ok(t,c,x){n++;if(!c)fail++;console.log((c?'ok   ':'FAIL ')+t+(c?'':'  '+(x||'')));}
const P=new Function(calc.split('/*PURE*/')[1].split('/*ENDPURE*/')[0]+';return {proximasFechas,proxTexto};')();
const d=(y,m,dd)=>new Date(y,m-1,dd);
let r=P.proximasFechas(d(2026,10,27),'general'); ok('27 oct: CTS 15 nov (19 días) y gratificación 15 dic (49)',r.length===2&&r[0].k==='CTS'&&r[0].dias===19&&r[1].k==='Gratificación'&&r[1].dias===49,JSON.stringify(r));
ok('Texto de la fecha',P.proxTexto(r[0]).l==='CTS · hasta el 15 de noviembre'&&P.proxTexto(r[0]).r==='faltan 19 días');
r=P.proximasFechas(d(2026,12,16),'general'); ok('16 dic: pasa a mayo y julio del año siguiente',r[0].k==='CTS'&&r[0].anio===2027&&r[1].mes===6,JSON.stringify(r));
r=P.proximasFechas(d(2026,11,15),'pequena'); ok('El mismo día: vence hoy',r[0].dias===0&&P.proxTexto(r[0]).r==='vence hoy');
ok('Un día antes: vence mañana',P.proxTexto(P.proximasFechas(d(2026,11,14),'general')[0]).r==='vence mañana');
ok('Microempresa: sin fechas',P.proximasFechas(d(2026,10,27),'micro').length===0);
r=P.proximasFechas(d(2026,5,15),'general'); ok('15 de mayo: CTS hoy y luego gratificación',r[0].dias===0&&r[1].k==='Gratificación'&&r[1].dias===61,JSON.stringify(r));
// Página: ejecutar su script con un DOM mínimo
const sc=page.match(/<script>\n\(function\(\)\{[\s\S]*?<\/script>/)[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
const els={grupos:{innerHTML:''},prox:{innerHTML:''},rg:{listeners:{},addEventListener(t,f){this.listeners[t]=f;}},q:{listeners:{},addEventListener(t,f){this.listeners[t]=f;}},all:{textContent:'',listeners:{},addEventListener(t,f){this.listeners[t]=f;}}};
const btns=['general','pequena','micro'].map(v=>({dataset:{v},pressed:'',setAttribute(k,x){this.pressed=x;}}));
const store={};
const doc={getElementById:id=>els[id],querySelectorAll:()=>btns};
const run=new Function('document','localStorage','location','window',sc);
run(doc,{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v;}},{hash:''},{addEventListener(){}});
ok('Página: renderiza grupos del régimen general',els.grupos.innerHTML.includes('Se pagan en fechas fijas del año')&&els.grupos.innerHTML.includes('Un sueldo en julio y otro en diciembre'));
ok('Página: cuatro grupos y doce desplegables',(els.grupos.innerHTML.match(/<h3 class="gt">/g)||[]).length===4&&(els.grupos.innerHTML.match(/<details/g)||[]).length===12);
ok('Página: solo el primero abierto',(els.grupos.innerHTML.match(/<details class="acc" id="\w+" open>/g)||[]).length===1);
ok('Página: franja de próximas fechas con CTS o gratificación',/CTS|Gratificación/.test(els.prox.innerHTML));
els.rg.listeners.click({target:{closest:()=>btns[1]}});
ok('Página: pequeña empresa cambia el texto',els.grupos.innerHTML.includes('Medio sueldo en julio')&&!els.grupos.innerHTML.includes('Un sueldo en julio y otro en diciembre')&&store['liquida.reg']==='pequena'&&btns[1].pressed==='true'&&btns[0].pressed==='false');
els.rg.listeners.click({target:{closest:()=>btns[2]}});
ok('Página: microempresa sin gratificación ni CTS y con aviso',els.grupos.innerHTML.includes('No tiene derecho a gratificaciones.')&&els.grupos.innerHTML.includes('No tiene derecho a CTS.')&&els.prox.innerHTML.includes('no paga gratificaciones ni CTS'));

// búsqueda, abrir todos, botones de calcular, iconos
els.rg.listeners.click({target:{closest:()=>btns[0]}});
ok('Página: cada beneficio tiene ícono y 7 botones de calcular', (els.grupos.innerHTML.match(/<svg class="bi"/g)||[]).length===12 && (els.grupos.innerHTML.match(/class="btn sm go"/g)||[]).length===7);
ok('Página: el botón lleva el régimen elegido a la calculadora', els.grupos.innerHTML.includes('href="calculadora.html#calc=cts&amp;reg=general"') && els.grupos.innerHTML.includes('href="calculadora.html#tab=plan&amp;reg=general"'));
els.rg.listeners.click({target:{closest:()=>btns[1]}});
ok('Página: el régimen pequeña empresa viaja en el enlace', els.grupos.innerHTML.includes('#calc=cts&amp;reg=pequena'));
els.q.listeners.input({target:{value:'vacaciones'}});
ok('Búsqueda «vacaciones»: muestra Vacaciones y Liquidación, oculta el resto', els.grupos.innerHTML.includes('id="vac"') && els.grupos.innerHTML.includes('id="liq"') && !els.grupos.innerHTML.includes('id="cts"') && !els.grupos.innerHTML.includes('id="he"'));
ok('Búsqueda: los resultados salen abiertos', (els.grupos.innerHTML.match(/<details/g)||[]).length===(els.grupos.innerHTML.match(/ open>/g)||[]).length);
els.q.listeners.input({target:{value:'GRATIFICACION'}});
ok('Búsqueda sin tildes ni mayúsculas', els.grupos.innerHTML.includes('id="grati"'));
els.q.listeners.input({target:{value:'zzzz'}});
ok('Búsqueda sin resultados avisa', els.grupos.innerHTML.includes('No encontré beneficios'));
els.q.listeners.input({target:{value:''}});
els.all.listeners.click();
ok('Abrir todos abre los 12', (els.grupos.innerHTML.match(/<details class="acc" id="\w+" open>/g)||[]).length===12 && els.all.textContent==='Cerrar todos');
els.all.listeners.click();
ok('Cerrar todos deja solo el primero abierto', (els.grupos.innerHTML.match(/<details class="acc" id="\w+" open>/g)||[]).length===1 && els.all.textContent==='Abrir todos');
// recordar régimen
const els2={grupos:{innerHTML:''},prox:{innerHTML:''},rg:{addEventListener(){}},q:{addEventListener(){}},all:{textContent:'',addEventListener(){}}};
new Function('document','localStorage','location','window',sc)({getElementById:id=>els2[id],querySelectorAll:()=>btns},{getItem:k=>({'liquida.reg':'micro'}[k]||null),setItem(){}},{hash:''},{addEventListener(){}});
ok('Página: recuerda el régimen elegido',els2.grupos.innerHTML.includes('No tiene derecho a CTS.'));
// enlace profundo
let opened=false;const els3={grupos:{innerHTML:''},prox:{innerHTML:''},rg:{addEventListener(){}},q:{addEventListener(){}},all:{textContent:'',addEventListener(){}}};
const doc3={getElementById:id=>id==='cts'?{tagName:'DETAILS',set open(v){opened=v;},scrollIntoView(){}}:els3[id],querySelectorAll:()=>btns};
new Function('document','localStorage','location','window',sc)(doc3,{getItem:()=>null,setItem(){}},{hash:'#cts'},{addEventListener(){}});
ok('Página: #cts abre ese desplegable',opened===true);
console.log('\n'+(n-fail)+'/'+n+' comprobaciones correctas');process.exit(fail?1:0);
