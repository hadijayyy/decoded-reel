// node render.js <project> [workers=4]   -> <project>/build/seg/sNN.mp4 (one per bar), resumable; FORCE=3,7 re-renders bars; M=8 blur samples
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');const {spawn,fork}=require('child_process');
const proj=path.resolve(process.argv[2]);const SEGDIR=path.join(proj,'build/seg');fs.mkdirSync(SEGDIR,{recursive:true});
if(process.argv[3]!=='--worker'){const n=+(process.argv[3]||4);let left=n;for(let w=0;w<n;w++){const c=fork(__filename,[proj,'--worker',String(w),String(n)]);c.on('exit',()=>{if(--left===0)console.log('ALL DONE')});}return;}
const wi=+process.argv[4],wn=+process.argv[5],M=+(process.env.M||8);const force=(process.env.FORCE||'').split(',').filter(Boolean).map(Number);
(async()=>{const b=await chromium.launch({args:['--no-sandbox','--disable-gpu']});const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+path.join(proj,'build/reel.html'));await p.evaluate(()=>window.ready);
const meta=await p.evaluate(()=>window.META);const FPS=meta.fps,PER=meta.segFrames,SEGS=Math.ceil(meta.frames/PER);
for(let s=wi;s<SEGS;s+=wn){const out=path.join(SEGDIR,`s${String(s).padStart(2,'0')}.mp4`);if(fs.existsSync(out)&&!force.includes(s))continue;const part=out.replace('.mp4','.part.mp4');
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-i','-','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','14','-g',String(FPS),'-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv',part]);
 const done=new Promise(r=>ff.on('close',r));const t0=Date.now();const nF=Math.min(PER,meta.frames-s*PER);
 for(let f=0;f<nF;f++){const n=s*PER+f;const d=await p.evaluate(([n,M,FPS])=>{seek(n/FPS,0.5/FPS,M);return document.getElementById('c').toDataURL('image/png')},[n,M,FPS]);
  if(!ff.stdin.write(Buffer.from(d.slice(22),'base64')))await new Promise(r=>ff.stdin.once('drain',r));}
 ff.stdin.end();const code=await done;if(code===0){fs.renameSync(part,out);console.log(`seg ${s}/${SEGS-1} ok ${((Date.now()-t0)/1000).toFixed(1)}s`)}else console.log(`seg ${s} FAIL ${code}`);}
await b.close()})();
