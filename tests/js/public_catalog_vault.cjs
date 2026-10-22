const vm=require('vm'),fs=require('fs'),path=require('path');let total=0,failed=0;
function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
const values=new Map([['sheetapp_catalog_v2',{songs:[{id:'old-private'}]}]]);
const w={__APP_BASE__:'/sheetapp2',idbKeyval:{get:async k=>values.get(k),set:async(k,v)=>values.set(k,v)}};
const c=vm.createContext({window:w,document:{cookie:''},console,fetch:async()=>({ok:true,json:async()=>({data:[{id:'public',is_public:1,visibility:'public'},{id:'private',is_public:0,visibility:'private'}]})})});
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../assets/js/core/OfflineVault.js'),'utf8'),c);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../assets/js/core/ApiService.js'),'utf8'),c);
(async()=>{
 check(await w.OfflineVault.getCatalog()===null,'Unscoped legacy catalog is not reused');
 await w.ApiService.songs.list();await Promise.resolve();
 const catalog=await w.OfflineVault.getCatalog();
 check(catalog?.length===1&&catalog[0].id==='public','Only public songs from an authenticated list persist in shared IndexedDB');
 console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
