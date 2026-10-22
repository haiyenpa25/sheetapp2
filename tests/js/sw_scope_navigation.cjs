const vm=require('vm'),fs=require('fs'),path=require('path');let total=0,failed=0;
function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
const base='http://localhost/sheetapp2/';const entries=new Map(),handlers={};let puts=0,offline=false;
const key=r=>new URL(typeof r==='string'?r:r.url,base).href;
const cache={put:async(r,response)=>{puts++;entries.set(key(r),response);},match:async r=>entries.get(key(r)),keys:async()=>[...entries.keys()].map(url=>({url}))};
const c=vm.createContext({self:{location:{search:'',pathname:'/sheetapp2/sw.js'},addEventListener:(name,fn)=>{handlers[name]=fn;}},URL,URLSearchParams,Request,Response,console,
 caches:{open:async()=>cache,match:async r=>cache.match(r)},fetch:async()=>{if(offline)throw new Error('offline');return new Response('{}',{headers:{'Cache-Control':'private'}});}});
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../sw.js'),'utf8'),c);
(async()=>{
 const api={url:base+'api/index.php?route=songs'};
 await c.networkFirstForApiSongs(api,'fixture');check(puts===0,'Authenticated catalog is never stored in shared SW cache');
 entries.set(key(api),new Response('{"private":true}',{headers:{'Cache-Control':'private'}}));offline=true;let denied=false;
 try{await c.networkFirstForApiSongs(api,'fixture');}catch{denied=true;}
 check(denied,'Legacy unscoped/private catalog is not reused offline');
 entries.clear();entries.set(base,new Response('MODERN'));
 let editorDenied=false;try{await c.networkFirstForNavigation({url:base+'editor/'},'fixture');}catch{editorDenied=true;}
 check(editorDenied,'Editor offline navigation never receives Modern shell');
 entries.set(base+'old/',new Response('CLASSIC'));const classic=await c.networkFirstForNavigation({url:base+'old/?song=x'},'fixture');
 check(await classic.text()==='CLASSIC','Classic offline navigation uses its own shell');
 let routed=false;handlers.fetch({request:{url:base+'old/?song=x',mode:'navigate',method:'GET'},respondWith:p=>{routed=true;p.catch(()=>{});}});
 check(routed,'Classic navigation participates in service worker routing');
 console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
