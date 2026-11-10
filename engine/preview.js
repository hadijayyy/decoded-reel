// node preview.js <project> <out.png> t1 t2 ... (<=9 per sheet)  -> contact sheet, 640x360 cells. Also writes build/cues.json + meta.json.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
(async()=>{const proj=path.resolve(process.argv[2]);const out=process.argv[3];const ts=process.argv.slice(4).map(Number);
const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('PAGEERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('ERR',m.text())});
await p.goto('file://'+path.join(proj,'build/reel.html'));await p.evaluate(()=>window.ready);
const {meta,cues}=await p.evaluate(()=>({meta:window.META,cues:window.CUES}));
fs.writeFileSync(path.join(proj,'build/meta.json'),JSON.stringify(meta,null,1));fs.writeFileSync(path.join(proj,'build/cues.json'),JSON.stringify(cues));
console.log(`duration ${meta.duration}s, ${meta.frames} frames, ${cues.length} cues`);
if(!ts.length){await b.close();return;}
const imgs=[];for(const t of ts){imgs.push(await p.evaluate(t=>{seek(t,0.5/60,3);return document.getElementById('c').toDataURL('image/jpeg',0.85)},t));}
await p.setContent(`<body style="margin:0;background:#333;display:grid;grid-template-columns:repeat(3,640px)">${imgs.map((s,i)=>`<div style="position:relative"><img src="${s}" width=640 height=360 style="display:block"><span style="position:absolute;left:4px;top:2px;color:#0f0;font:bold 16px monospace;background:#000a">${ts[i]}</span></div>`).join('')}</body>`);
await p.setViewportSize({width:1920,height:360*Math.ceil(ts.length/3)});await p.screenshot({path:out});await b.close();})();
