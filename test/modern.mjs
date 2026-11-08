import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok=(b)=>b?'✓':'✗'; let hepsi=true
const k=(ad,c,ek='')=>{hepsi&&=!!c;console.log(` ${ok(c)} ${ad}${ek?' — '+ek:''}`)}

for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
let tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html`)}`,{method:'PUT'})).json()
let p = new Session(tab.webSocketDebuggerUrl); await p.connect(); await p.send('Runtime.enable')
/* Sayfa yüklenip chrome.* hazır olana kadar bekle — yoksa yarış oluyor */
for (let i = 0; i < 40; i++) {
  if (await p.eval(`typeof chrome !== 'undefined' && !!chrome.storage`).catch(() => false)) break
  await sleep(250)
}
await p.eval(`chrome.storage.local.clear()`)
/* Sekme açılışta son adresi kaydetmeye başlar; o kayıt bitmeden kapatılırsa
   kapanışta eski durumu geri yazar. Bekle, tekrar temizle, sonra kapat. */
await sleep(2500); await p.eval(`chrome.storage.local.clear()`); p.close()
await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)
tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/modern.html')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab)
/* media.ts 5 sn'ye kadar yeniden tarıyor, fixture 800 ms sonra stil enjekte ediyor */
await sleep(6000)
p = new Session(tab.webSocketDebuggerUrl); await p.connect(); await p.send('Runtime.enable')

const b = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl)
await b.connect()
const { targetInfos } = await b.send('Target.getTargets')
const v = []
for (const it of targetInfos.filter(t=>t.type==='iframe' && t.url.includes('modern.html'))) {
  const { sessionId } = await b.send('Target.attachToTarget',{targetId:it.targetId,flatten:true})
  const send=(m,pp={})=>new Promise((res,rej)=>{const id=++b.id;b.pending.set(id,{res,rej});b.ws.send(JSON.stringify({id,method:m,params:pp,sessionId}))})
  await send('Runtime.enable')
  v.push((await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{
    const sr = document.querySelector('my-kart')?.shadowRoot
    const ic = (kok,s,ps)=>{ const e=kok.querySelector(s); return e ? getComputedStyle(e,ps).content : '(yok)' }
    let hover = 0
    const say = (sh) => { try { for (const r of sh.cssRules) {
      if (r.selectorText && r.selectorText.includes(':hover')) hover++
      if (r.cssRules) for (const r2 of r.cssRules) if (r2.selectorText && r2.selectorText.includes(':hover')) hover++ } } catch(e){} }
    for (const sh of document.styleSheets) say(sh)
    for (const sh of (document.adoptedStyleSheets||[])) say(sh)
    if (sr) for (const sh of (sr.adoptedStyleSheets||[])) say(sh)
    return { w: innerWidth,
      cdn: ic(document,'.cdn-durum','::after'),
      adopted: ic(document,'.ad-durum','::after'),
      shadow: sr ? ic(sr,'.sd-durum','::after') : '(shadow yok)',
      kalanHover: hover,
      imlec: !!document.getElementById('__rs_touch_cursor__') }
  })()`})).result.value)
}
b.close()
for (const x of v.sort((a,c)=>a.w-c.w))
  console.log(`   ${String(x.w).padStart(4)}px  CDN:${x.cdn.padEnd(18)} adopted:${x.adopted.padEnd(16)} shadow:${x.shadow.padEnd(16)} :hover=${x.kalanHover} imleç=${x.imlec}`)
const mob = v.filter(x=>x.w<900), mas = v.filter(x=>x.w>=900)
k('cross-origin CDN', mob.every(x=>x.cdn.includes('DOKUNMATIK')))
k('adoptedStyleSheets (CSS-in-JS) kapsandı', mob.every(x=>x.adopted.includes('AD-HOVER-YOK')), mob.map(x=>x.adopted).join(' '))
k('Shadow DOM stilleri kapsandı', mob.every(x=>x.shadow.includes('SD-HOVER-YOK')), mob.map(x=>x.shadow).join(' '))
k('mobilde hiç :hover kuralı kalmadı', mob.every(x=>x.kalanHover===0), mob.map(x=>x.kalanHover).join(','))
k('parmak imleci uygulandı', mob.every(x=>x.imlec))
k('masaüstü etkilenmedi', mas.every(x=>x.adopted.includes('AD-HOVER-VAR') && x.shadow.includes('SD-HOVER-VAR') && !x.imlec))
p.close()
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
