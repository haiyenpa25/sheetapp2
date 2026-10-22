const vm=require('vm'),fs=require('fs'),path=require('path');let total=0,failed=0;
function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
let user='owner',resolveOld;
const w={__APP_BASE__:'/sheetapp2'};
const context=vm.createContext({window:w,document:{cookie:''},fetch:async url=>{if(url.includes('route=auth'))return{ok:true,json:async()=>({success:true})};if(user==='pending')return new Promise(r=>resolveOld=()=>r({ok:true,json:async()=>({sets:['PRIVATE']})}));return{ok:true,json:async()=>({sets:user==='owner'?['PRIVATE']:['HD']})};},console});
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../assets/js/core/ApiService.js'),'utf8'),context);
(async()=>{const api=w.ApiService;
 await api.chordSets.list('song');user='guest';await api.auth.logout();
 check(!(await api.chordSets.list('song')).sets.includes('PRIVATE'),'Logout invalidates previous user chord-set names');
 api.chordSets.clearCache();user='pending';const pending=api.chordSets.list('song');await Promise.resolve();user='guest';await api.auth.login('guest','fixture');resolveOld();await pending;
 check(!(await api.chordSets.list('song')).sets.includes('PRIVATE'),'Old in-flight names cannot repopulate cache after login');
 console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
