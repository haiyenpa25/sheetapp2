const vm = require('vm'), fs = require('fs'), path = require('path');
let total=0, failed=0; function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
let loaded;
const realSong={id:'thanh-ca-001',title:'Fixture',xmlPath:'storage/Thanh ca/001 REAL NAME.xml'};
const w={LibraryUI:{getSongById:()=>realSong},ApiService:{songs:{get:async()=>({data:realSong})}}};
const ctx=vm.createContext({window:w,document:{readyState:'loading',addEventListener(){}},SongLoader:{load:async(...args)=>{loaded=args;}},console});
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../assets/js/app.js'),'utf8'),ctx);
(async()=>{
 await w.App.loadSongXmlDirect(realSong.id,'<score-partwise/>',2);
 check(loaded?.[0]?.xmlPath===realSong.xmlPath,'Follower uses actual catalog XML path');
 check(loaded?.[3]?.xml==='<score-partwise/>','Follower passes supplied preloaded XML to loader');
 w.LibraryUI.getSongById=()=>null;loaded=null;
 await w.App.loadSongXmlDirect(realSong.id,'<score-partwise/>');
 check(loaded?.[0]?.xmlPath===realSong.xmlPath,'Follower resolves metadata from API when absent in library');
 let fetched;
 w.SetlistUI={getCurrentSetlist:()=>({items:[{song_id:realSong.id}]})};
 ctx.fetch=async url=>{fetched=url;return {ok:true,text:async()=>'<score-partwise/>'};};
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../assets/js/performance/performance-engine.js'),'utf8'),ctx);
 w.PerformanceEngine.onSessionStarted({});
 await new Promise(resolve=>setImmediate(resolve));
 check(fetched===realSong.xmlPath,'Performance setlist preload also uses real catalog XML metadata');
 console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
