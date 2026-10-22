const fs=require('fs'),vm=require('vm'),path=require('path');let total=0,failed=0,clock=10000,beacons=0;const requests=[],events={};
function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
const w={__IS_LOGGED_IN__:true,__USER_ROLE__:'banhat',addEventListener:(n,fn)=>{events[n]=fn;}};
const c=vm.createContext({window:w,document:{cookie:'XSRF-TOKEN=token%2B123'},Date:class extends Date{static now(){return clock;}},console,Blob,
 navigator:{sendBeacon(){beacons++;return true;}},fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({success:true,session:{session_id:1}})};}});
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../assets/js/learn/practice/practice-tracker.js'),'utf8'),c);
(async()=>{
 await w.PracticeTracker.startSession('fixture');w.PracticeTracker.onPlaybackStart(80);clock+=2000;w.PracticeTracker.onPlaybackStop();await w.PracticeTracker.finishSession();
 check(requests.length===2&&requests.every(r=>r.options.headers['X-CSRF-Token']==='token+123'),'Standalone start/finish attach decoded CSRF header');
 await w.PracticeTracker.startSession('fixture');w.PracticeTracker.onPlaybackStart(80);clock+=2000;w.PracticeTracker.onPlaybackStop();events.pagehide();
 const last=requests.at(-1);
 check(beacons===0&&last.options.keepalive===true&&last.options.headers['X-CSRF-Token']==='token+123','Unload uses authenticated keepalive request with CSRF header');
 console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
