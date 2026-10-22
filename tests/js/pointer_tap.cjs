const{chromium}=require('playwright'),fs=require('fs'),path=require('path');let total=0,failed=0;
function check(ok,msg){total++;if(!ok)failed++;console.log(`${ok?'[PASS:B]':'[FAIL:B]'} ${msg}`);}
(async()=>{const file=path.resolve(__dirname,'../../assets/js/core/PointerTap.js');if(!fs.existsSync(file)){check(false,'PointerTap helper exists');console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=1;return;}
 const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();await page.setContent('<button id="tap">Chord</button>');await page.addScriptTag({path:file});
 await page.evaluate(()=>{window.calls=0;PointerTap.bind(document.getElementById('tap'),()=>calls++);});
 const fire=async(type,x,y)=>page.dispatchEvent('#tap',type,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});
 await fire('pointerdown',10,10);check(await page.evaluate(()=>calls)===0,'Pointer down never opens chord popup');
 await fire('pointermove',10,50);await fire('pointerup',10,50);await page.dispatchEvent('#tap','click',{detail:1});check(await page.evaluate(()=>calls)===0,'Scrolling gesture does not open popup or synthetic click');
 await fire('pointerdown',10,10);await fire('pointerup',12,12);await page.dispatchEvent('#tap','click',{detail:1});check(await page.evaluate(()=>calls)===1,'Stationary pointer release opens popup exactly once');
 await fire('pointerdown',10,10);await fire('pointercancel',10,10);await fire('pointerup',10,10);check(await page.evaluate(()=>calls)===1,'Cancelled gesture never opens popup');
 await page.dispatchEvent('#tap','click',{detail:0});check(await page.evaluate(()=>calls)===2,'Keyboard click remains accessible');
 for(const prefix of ['assets/js/','old/assets/js/']){
  const dotsPage=await browser.newPage();await dotsPage.setContent('<div id="osmd-container"></div>');await dotsPage.addScriptTag({path:file});
  await dotsPage.evaluate(()=>{window.calls=0;window.ChordCanvasUI={getScale:()=>1,getDotSize:()=>20,applyAbsolute(){}};});
  await dotsPage.addScriptTag({path:path.resolve(__dirname,'../../'+prefix+'chord-canvas-dots.js')});
  await dotsPage.evaluate(()=>ChordCanvasDots.placeDot({rect:{width:10,height:10,left:30,top:60},measureIdx:0,noteIdx:0,chord:''},new Map(),{editEnabled:true,onShowPopup:()=>calls++}));
  await dotsPage.dispatchEvent('.cc-dot-btn','pointerdown',{pointerId:1,isPrimary:true,button:0,clientX:30,clientY:60});
  check(await dotsPage.evaluate(()=>calls)===0,prefix+'actual chord dot waits for release');
  await dotsPage.dispatchEvent('.cc-dot-btn','pointerup',{pointerId:1,isPrimary:true,button:0,clientX:30,clientY:60});
  check(await dotsPage.evaluate(()=>calls)===1,prefix+'actual chord dot opens on stationary release');
  await dotsPage.evaluate(()=>{window.opensheetmusicdisplay={OpenSheetMusicDisplay:class{}};});
  await dotsPage.addScriptTag({path:path.resolve(__dirname,'../../'+prefix+'osmd-renderer.js')});
  await dotsPage.evaluate(()=>{OSMDRenderer.init('osmd-container');document.getElementById('osmd-container').innerHTML='<svg style="transform:scale(1.4)"></svg>';});
  await dotsPage.dispatchEvent('#osmd-container','touchcancel',{});
  check(await dotsPage.locator('#osmd-container svg').evaluate(svg=>svg.style.transform)==='',prefix+'touchcancel clears temporary pinch scale');
  await dotsPage.close();
 }
 }finally{await browser.close();}console.log(`SUITE_COMPLETE total=${total}`);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
