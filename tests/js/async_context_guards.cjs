const fs=require('fs'),vm=require('vm'),path=require('path');const root=path.resolve(__dirname,'../..');let total=0,failed=0;
function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
function load(file,w,extra={}){const c=vm.createContext({window:w,document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}},setTimeout(){},clearTimeout(){},requestAnimationFrame(){},console,...extra});vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);return c;}
(async()=>{
 for(const prefix of ['assets/js/','old/assets/js/']){
   let resolveA;const w={ApiService:{sessions:{load:id=>id==='A'?new Promise(r=>resolveA=r):Promise.resolve({perfNotes:{text:'B'}})}}};
   load(prefix+'performance-notes.js',w);const a=w.PerformanceNotes.loadSong('A');await w.PerformanceNotes.loadSong('B');resolveA({perfNotes:{text:'A'}});await a;
   check(w.PerformanceNotes.getNotes().text==='B',prefix+'late notes do not replace the current song');
 }
 const store={sheetapp_offline_index:JSON.stringify([{id:1}]),sheetapp_offline_setlist_1:JSON.stringify({chord_sets:{song:{BH:[{chord:'private'}]}}})};
 const w={addEventListener(){}};load('assets/js/core/OfflineSetlistManager.js',w,{localStorage:{getItem:k=>store[k]??null}});
 check(w.OfflineSetlistManager.getOfflineChords('song','HD')===null,'Missing HD never relabels an arbitrary offline set as HD');
 check(w.OfflineSetlistManager.getOfflineChords('song','BH')[0].chord==='private','Exact offline profile remains available');
 for(const prefix of ['assets/js/','old/assets/js/']){
  let song='A',resolveA;const w={App:{getCurrentSongId:()=>song},ApiService:{chordSets:{load:(id,name)=>name==='A'?new Promise(r=>resolveA=r):Promise.resolve({success:true,chords:[{measureIdx:0,noteIdx:0,chord:'B'}]})}}};
  load(prefix+'chord-canvas.js',w);
  const a=w.ChordCanvas.switchSet('A');await Promise.resolve();await w.ChordCanvas.switchSet('B');resolveA({success:true,chords:[{measureIdx:0,noteIdx:0,chord:'A'}]});await a;
  check(w.ChordCanvas.getCustomChords()['0_0']==='B',prefix+'late set switch cannot replace newer chords');
 }
 let index=0,resolveA;const bpm=[];
 const items=[{song_id:'A',bpm:80},{song_id:'B',bpm:120}];
 const playerWindow={App:{loadSongWithProfile:s=>s.id==='A'?new Promise(r=>resolveA=r):Promise.resolve(),showToast(){}},Metronome:{setBpmAndBeats:n=>bpm.push(n)}};
 load('assets/js/setlist-player.js',playerWindow);
 playerWindow.SetlistPlayer.setContext({getCurrentSetlist:()=>({items}),getCurrentIndex:()=>index,getAllSongsCache:()=>[{id:'A'},{id:'B'}]});
 const playA=playerWindow.SetlistPlayer.playCurrentItem();index=1;await playerWindow.SetlistPlayer.playCurrentItem();resolveA();await playA;
 check(bpm.length===1&&bpm[0]===120,'Late setlist play cannot restore previous item BPM');
 console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
