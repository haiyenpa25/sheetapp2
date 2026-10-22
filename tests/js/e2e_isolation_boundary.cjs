const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),{createRequire}=require('module');let total=0,failed=0;
function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
const root=path.resolve(__dirname,'../..');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sheetapp-e2e-guard-'));
async function invoke(file){const c={module:{exports:{}},require:createRequire(path.join(root,'e2e',file)),__dirname:path.join(temp,'e2e'),process:{env:{}},console};vm.runInNewContext(fs.readFileSync(path.join(root,'e2e',file),'utf8'),c);try{await c.module.exports();return false;}catch{return true;}}
(async()=>{try{
 check(await invoke('global-setup.js'),'Global setup refuses a root without isolated-copy marker');
 check(!fs.existsSync(path.join(temp,'test-results','snapshot')),'Rejected setup writes no snapshot directory');
 fs.mkdirSync(path.join(temp,'test-results','snapshot'),{recursive:true});fs.mkdirSync(path.join(temp,'storage','data'),{recursive:true});
 fs.writeFileSync(path.join(temp,'test-results','snapshot','app.sqlite'),'snapshot');fs.writeFileSync(path.join(temp,'storage','data','app.sqlite'),'live-fixture');
 check(await invoke('global-teardown.js'),'Global teardown refuses a root without isolated-copy marker');
 check(fs.readFileSync(path.join(temp,'storage','data','app.sqlite'),'utf8')==='live-fixture','Teardown never overwrites application DB with an old snapshot');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
