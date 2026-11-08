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
/* spa.html: cross-origin CDN stylesheet + geç enjekte edilen stil + JS ile hover */
tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/spa.html')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab)
/* media.ts 5 sn'ye kadar yeniden tarıyor, fixture 800 ms sonra stil enjekte ediyor */
await sleep(6000)
p = new Session(tab.webSocketDebuggerUrl); await p.connect(); await p.send('Runtime.enable')

async function oturumlar() {
  const b = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl)
  await b.connect()
  const { targetInfos } = await b.send('Target.getTargets')
  const m = {}
  for (const it of targetInfos.filter(t=>t.type==='iframe' && t.url.includes('spa.html'))) {
    const { sessionId } = await b.send('Target.attachToTarget',{targetId:it.targetId,flatten:true})
    const send=(x,pp={})=>new Promise((res,rej)=>{const id=++b.id;b.pending.set(id,{res,rej});b.ws.send(JSON.stringify({id,method:x,params:pp,sessionId}))})
    await send('Runtime.enable')
    m[(await send('Runtime.evaluate',{returnByValue:true,expression:'innerWidth'})).result.value] = send
  }
  return { b, m }
}
const durumIfade = `({
  w: innerWidth,
  cdnIsaret: getComputedStyle(document.querySelector('.cdn-durum'),'::after').content,
  cdnHover: getComputedStyle(document.querySelector('.cdn-hover'),'::after').content,
  gecHover: getComputedStyle(document.querySelector('.gec-durum'),'::after').content,
  kalanHover: (()=>{ let n=0; for (const sh of document.styleSheets) { try {
      for (const r of sh.cssRules) { if (r.selectorText && r.selectorText.includes(':hover')) n++
        if (r.cssRules) for (const r2 of r.cssRules) if (r2.selectorText && r2.selectorText.includes(':hover')) n++ } }
    catch(e) { n += 100 } } return n })(),
  jsOlay: document.getElementById('olay').textContent
})`

console.log('── PARMAK MODU AÇIK ──')
let { b, m } = await oturumlar()
const okuHepsi = async () => {
  const out = []
  for (const w of Object.keys(m).map(Number).sort((a,x)=>a-x)) {
    const r = await m[w]('Runtime.evaluate',{returnByValue:true,expression:durumIfade})
    if (!r.result || r.result.value === undefined) {
      console.log(`   ⚠︎ ${w}px değerlendirilemedi: ${r.exceptionDetails?.exception?.description ?? JSON.stringify(r).slice(0,200)}`)
      continue
    }
    out.push(r.result.value)
  }
  return out
}
let v = await okuHepsi()
for (const x of v) console.log(`   ${String(x.w).padStart(4)}px  ${x.cdnIsaret.padEnd(18)} ${x.cdnHover.padEnd(18)} geç:${x.gecHover.padEnd(18)} :hover=${x.kalanHover}`)
const mobil = v.filter(x=>x.w<900), masa = v.filter(x=>x.w>=900)
k('cross-origin CDN stylesheet dokunmatiğe geçti', mobil.every(x=>x.cdnIsaret.includes('DOKUNMATIK')))
k('cross-origin CDN hover kapandı', mobil.every(x=>x.cdnHover.includes('HOVER-YOK')))
k('sonradan enjekte edilen stil de kapsandı', mobil.every(x=>x.gecHover.includes('GEC-HOVER-YOK')))
k('mobilde hiç :hover kuralı kalmadı', mobil.every(x=>x.kalanHover === 0), mobil.map(x=>x.kalanHover).join(','))
k('masaüstü ekranlar etkilenmedi', masa.every(x=>x.cdnIsaret.includes('FARE') && x.cdnHover.includes('HOVER-VAR')))

console.log('\n── JS İLE HOVER (onmouseenter) — gerçek fare ──')
b.close()
/** Ekranı görünür alana kaydırıp üzerinde gerçek fare hareketi üretir. */
async function gezdir(ad) {
  await p.eval('(()=>{const f=[...document.querySelectorAll(".frame")].find(x=>{'
    + 'const n=x.querySelector(".frame-head .nm"); return n && n.textContent.indexOf(' + JSON.stringify(ad) + ')>=0});'
    + 'if(f) f.scrollIntoView({block:"center"})})()')
  await sleep(700)
  const kt = await p.eval('(()=>{const f=[...document.querySelectorAll(".frame")].find(x=>{'
    + 'const n=x.querySelector(".frame-head .nm"); return n && n.textContent.indexOf(' + JSON.stringify(ad) + ')>=0});'
    + 'if(!f) return null; const r=f.querySelector(".frame-box").getBoundingClientRect();'
    + 'return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+Math.min(r.height/2,140))}})()')
  if (!kt) return
  for (let i = 0; i < 4; i++) {
    await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: kt.x + i * 5, y: kt.y + i * 4 })
    await sleep(160)
  }
  await sleep(400)
}
for (const ad of ['Galaxy S25', 'iPhone 16', 'Windows FHD — %100', 'MacBook Air']) await gezdir(ad)
await sleep(600)
;({ b, m } = await oturumlar())
const olaylar = []
for (const w of Object.keys(m).map(Number).sort((a,x)=>a-x))
  olaylar.push((await m[w]('Runtime.evaluate',{returnByValue:true,expression:
    `({ w: innerWidth, olay: document.getElementById('olay').textContent })`})).result.value)
for (const o of olaylar) console.log(`   ${String(o.w).padStart(4)}px  ${o.olay}`)
b.close()
const mobilOlay = olaylar.filter(x=>x.w<900)
const masaOlay = olaylar.filter(x=>x.w>=900)
k('mobilde fare gezdirme olayları hiç tetiklenmiyor', mobilOlay.every(x=>x.olay.includes('(yok)')))
k('masaüstünde fare olayları normal çalışıyor', masaOlay.some(x=>!x.olay.includes('(yok)')),
  masaOlay.map(x=>x.w+':'+(x.olay.includes('(yok)')?'-':'✓')).join(' '))

console.log('\n── PARMAK MODU KAPATILDI ──')
await p.eval(`[...document.querySelectorAll('.subbar.tools .chip')].find(x=>x.textContent.includes('Parmak')).click()`)
await sleep(5000)
;({ b, m } = await oturumlar())
v = await okuHepsi()
for (const x of v) console.log(`   ${String(x.w).padStart(4)}px  ${x.cdnIsaret.padEnd(18)} ${x.cdnHover.padEnd(18)} :hover=${x.kalanHover}`)
const mobil2 = v.filter(x=>x.w<900)
k('kapatınca mobilde hover geri geldi', mobil2.every(x=>x.cdnHover.includes('HOVER-VAR')))
k('kapatınca :hover kuralları geri yüklendi', mobil2.every(x=>x.kalanHover > 0))
b.close()

const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown')
k('konsolda hata yok', errs.length===0, `${errs.length}`)
p.close()
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
