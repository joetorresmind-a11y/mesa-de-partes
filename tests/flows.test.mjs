import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const original=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');
function harness(){
 const data=new Map(),nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,innerHTML:'',textContent:'',dataset:{},setAttribute(){},removeAttribute(){},querySelector(){return node(id+'-child')},addEventListener(){}});return nodes.get(id)};
 const snap=k=>({exists:()=>data.has(k),data:()=>structuredClone(data.get(k)),id:k.split('/')[1]});
 const context=vm.createContext({console,setTimeout,clearTimeout,crypto:webcrypto,File,FormData,Uint8Array,Date,
 document:{querySelector:()=>node('main'),getElementById:node,querySelectorAll:()=>[]},window:{addEventListener(){},scrollTo(){}},location:{hash:'#inicio',pathname:'/'},sessionStorage:{getItem(){return null}},firebaseConfig:{},ADMIN_USERNAME:'joel',ADMIN_EMAIL:'joel@test',
 mocks:{doc:(_,a,b)=>a+'/'+b,getDoc:async k=>snap(k),collection:(_,c)=>c,where:(...x)=>x,query:(...x)=>x,
 getDocs:async q=>{const rows=[...data].filter(([k,v])=>k.startsWith('expedientes/')&&v.id===q[1][2]);return {empty:!rows.length,docs:rows.map(([k])=>snap(k))}},
 runTransaction:async(_,fn)=>{const writes=[];const result=await fn({get:async k=>snap(k),set:(k,v)=>writes.push([k,v]),update:(k,v)=>writes.push([k,{...data.get(k),...v}])});for(const[k,v]of writes)data.set(k,structuredClone(v));return result}}});
 const source=original.replace(/^import .*firebase-config.js';\n/m,'').replace(/^initializeFirebase\(\);$/m,'').replace(/^render\(\);\nstart\(\);$/m,'');vm.runInContext(source,context);
 vm.runInContext('({doc,getDoc,getDocs,collection,where,query,runTransaction}=mocks);db={};firebaseReady=true;authReadyResolve();',context);
 return {data,context,nodes,run:code=>vm.runInContext(code,context)};
}
function form(){const f=new FormData();for(const[k,v]of Object.entries({subject:'Certificado',sender:'Remitente de prueba',type:'Solicitud',number:'',area:'Mesa de partes',folios:'1'}))f.set(k,v);return f}
test('Registro sin cuenta y reintento sin duplicación',async()=>{const h=harness();h.context.input=form();h.context.key='a'.repeat(32);const r=await h.run('registerDocument(input,key)');assert.equal(r.id,1);assert.equal(h.data.get('registroVinculo/actual').token,h.context.key);await h.run('registerDocument(input,key)');assert.equal(h.data.get('config/counter').value,1)});
test('Datos inválidos no consumen correlativo',async()=>{const h=harness();h.context.input=form();h.context.input.set('folios','0');await assert.rejects(h.run('registerDocument(input)'));assert.equal(h.data.size,0)});
test('Consulta con clave y bloqueo de bandeja pública',async()=>{const h=harness();h.context.input=form();h.context.key='b'.repeat(32);await h.run('registerDocument(input,key)');await assert.rejects(h.run("api('records')"));await assert.rejects(h.run('findRecord(1)'));h.run("trackingKey='1-'+key");assert.equal((await h.run('findRecord(1)')).sender,'Remitente de prueba')});
test('Notas fuera del documento público y conflicto de revisión',async()=>{const h=harness();h.context.input=form();h.context.key='c'.repeat(32);await h.run('registerDocument(input,key)');h.run('session.admin=true');const call=`api('record/1/move',{method:'POST',body:JSON.stringify({state:'En trámite',area:'Secretaría',note:'Privada',revision:1})})`;await h.run(call);assert.equal(h.data.get('expedientes/'+h.context.key).log[1].note,'');assert.equal(h.data.get('notasInternas/'+h.context.key).notes['1'],'Privada');await assert.rejects(h.run(call))});
test('Portada y navegación sin conexión',async()=>{const h=harness();h.run('firebaseReady=false');for(const[route,text]of [['#inicio','Tus trámites'],['#registro','Datos del documento'],['#consulta','Consultar mi trámite'],['#admin','Acceso de administrador'],['#instituto','Reseña histórica']]){h.context.location.hash=route;await h.run('render()');assert(h.nodes.get('main').innerHTML.includes(text))}});
