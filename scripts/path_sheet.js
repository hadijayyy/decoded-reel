// node path_sheet.js <paths.json> <vbW> <vbH> <out.png>  -> one cell per path (index + fill) to decide part groupings
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const [pj,w,h,out]=process.argv.slice(2);const P=JSON.parse(fs.readFileSync(pj));
const cells=P.map((p,i)=>`<div style="width:190px;background:#c8c8c8;text-align:center;font:13px monospace"><svg viewBox="0 0 ${w} ${h}" width="190" height="190"><path d="${p.d}" fill="${p.fill}"/></svg><br>${i} ${p.fill}</div>`).join('');
const full=`<div style="width:190px;background:#888;text-align:center;font:13px monospace"><svg viewBox="0 0 ${w} ${h}" width="190" height="190">${P.map(p=>`<path d="${p.d}" fill="${p.fill}"/>`).join('')}</svg><br>ALL</div>`;
const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1600,height:300}});
await pg.setContent(`<body style="margin:0;background:#555;display:flex;flex-wrap:wrap;gap:6px;width:1600px">${full}${cells}</body>`);
await pg.screenshot({path:out,fullPage:true});await b.close();console.log('sheet ->',out)})();
