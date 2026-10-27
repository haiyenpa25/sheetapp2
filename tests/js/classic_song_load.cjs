const fs=require('fs'),vm=require('vm'),path=require('path');let total=0,failed=0;
function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
const state={},rendered=[],saved=[];let resolveA,offline=false;
const noop=()=>{};
const globals={Store:{set:(k,v)=>state[k]=v,get:k=>state[k]},ApiService:{sessions:{load:async()=>({})}},AppUI:new Proxy({},{get:()=>noop}),
 SheetAudioPlayer:new Proxy({},{get:()=>noop}),AnnotationCanvas:{loadSong:noop},PageNav:{reset:noop},EventBus:{emit:noop},
 OSMDRenderer:{load:async xml=>rendered.push(xml),setZoomSilent:noop,getInstance:()=>({})},ChordCanvas:{loadSong:async()=>{},getCurrentSet:()=>'HD',getCustomChords:()=>({})},
 OfflineVault:{saveXml:(p,xml)=>saved.push(p),getXml:async()=>'<cached/>'},ChordSetNames:{describe:()=>''}};
const w={...globals,innerWidth:1000};
const ctx=vm.createContext({...globals,window:w,document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},console,setTimeout(){},
 fetch:url=>{if(offline)return Promise.reject(new Error('offline'));if(url.includes('A.xml'))return new Promise(r=>resolveA=r);return Promise.resolve({ok:true,text:async()=>'<B/>'});}});
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../assets/js/core/SongLoaderCore.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../old/assets/js/song-loader.js'),'utf8'),ctx);
(async()=>{
 const a=w.SongLoader.load({id:'A',xmlPath:'storage/A.xml'});await w.SongLoader.load({id:'B',xmlPath:'storage/B.xml'});resolveA({ok:true,text:async()=>'<A/>'});await a;
 check(state.originalXml==='<B/>'&&rendered.every(xml=>xml==='<B/>'),'Classic late XML A cannot replace B or render A');
 check(saved.includes('storage/B.xml'),'Classic persists XML through OfflineVault.saveXml keyed by xmlPath');
 offline=true;await w.SongLoader.load({id:'C',xmlPath:'storage/C.xml'});
 check(state.originalXml==='<cached/>','Classic offline load uses OfflineVault.getXml');
 console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
