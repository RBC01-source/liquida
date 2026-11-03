// Datos guardados hostiles no deben romper la página; el tope AFP solo afecta la prima.
const fs=require('fs'),html=fs.readFileSync(process.argv[2],'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let fail=0,n=0;const ok=(m,c)=>{n++;if(!c)fail++;console.log((c?'ok   ':'FAIL ')+m)};
function mk(){return{id:'x',_h:'',hidden:false,listeners:{},style:{},dataset:{},classList:{add(){},remove(){}},addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f)},focus(){},remove(){},select(){},appendChild(){},click(){},set innerHTML(v){this._h=v},get innerHTML(){return this._h},set textContent(v){},get textContent(){return''}}}
const fx={app:mk(),toast:mk(),sheet:mk()};fx.sheet.hidden=true;
const store={'liquida.v1':JSON.stringify({calc:'__proto__',f:{reg:'constructor',sueldo:'1e999',afpPct:500,ingreso:'<img>',meses:'x',gratiLast:-5,evil:1},workers:[]})};
const doc={getElementById:i=>fx[i]||null,addEventListener(){},body:{classList:{add(){},remove(){}},appendChild(){}},createElement:()=>mk()};
const ls={getItem:k=>k in store?store[k]:null,setItem(k,v){store[k]=v}};
const run=new Function('window','document','localStorage','location','navigator','Blob','URL','setTimeout','clearTimeout','fetch',script+';return{S}');
let S;try{S=run({addEventListener(){},removeEventListener(){},scrollTo(){}},doc,ls,{hash:''},{},function(){},{createObjectURL(){return''},revokeObjectURL(){}},function(){},function(){},function(){return{catch(){}}}).S;ok('Arranca con datos guardados hostiles',true)}catch(e){ok('Arranca con datos guardados hostiles '+e.message,false)}
if(S){ok('calc inválido → grati',S.calc==='grati');ok('reg inválido → general',S.f.reg==='general');ok('sueldo acotado',isFinite(S.f.sueldo)&&S.f.sueldo<=1e9);ok('afpPct ≤ 100',S.f.afpPct<=100);ok('fecha inválida ignorada',!/img/.test(S.f.ingreso));ok('gratiLast negativa → vacío',S.f.gratiLast==='');ok('campo desconocido ignorado',S.f.evil===undefined);ok('pantalla se dibuja',fx.app.innerHTML.includes('Liquida'))}
console.log(`${n-fail}/${n} comprobaciones correctas`);process.exit(fail?1:0);
