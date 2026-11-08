import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
import { writeFileSync } from 'node:fs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok=(b)=>b?'✓':'✗'; let hepsi=true
const k=(ad,c,ek='')=>{hepsi&&=!!c;console.log(` ${ok(c)} ${ad}${ek?' — '+ek:''}`)}

for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
// TEMIZ KURULUM: depolamayi sil, sonra ilk acilisi simule et
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
tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab); await sleep(1500)
p = new Session(tab.webSocketDebuggerUrl); await p.connect()
await p.send('Runtime.enable'); await p.send('Log.enable'); await p.send('Page.enable')

console.log('── İLK AÇILIŞTAKİ VARSAYILAN EKRANLAR ──')
const ekranlar = await p.eval(`[...document.querySelectorAll('.frame')].map(f=>({
  ad: f.querySelector('.frame-head .nm')?.textContent,
  olcu: f.querySelector('.frame-head .dim')?.textContent,
  dpr: f.querySelector('.frame-head .badge')?.textContent ?? '@1x' }))`)
for (const e of ekranlar) console.log(`   ${(e.ad??'').padEnd(26)} ${(e.olcu??'').padEnd(11)} ${e.dpr}`)
k('11 ekran açıldı', ekranlar.length === 11, `${ekranlar.length} ekran`)
k('Windows kurulumları dahil', ekranlar.filter(e=>e.ad?.includes('Windows')).length >= 4,
  ekranlar.filter(e=>e.ad?.includes('Windows')).map(e=>e.ad).join(', '))
k('mobil + tablet dahil', ekranlar.some(e=>e.ad?.includes('Galaxy S')) && ekranlar.some(e=>e.ad?.includes('iPhone')) && ekranlar.some(e=>e.ad?.includes('iPad')))
k('Android tablet dahil', ekranlar.some(e=>e.ad?.includes('Galaxy Tab')), ekranlar.find(e=>e.ad?.includes('Galaxy Tab'))?.olcu ?? '-')
k('en dar telefon (320) dahil', ekranlar.some(e=>(e.olcu??'').startsWith('320')), ekranlar.find(e=>(e.olcu??'').startsWith('320'))?.ad ?? '-')
k('kurumsal 16:10 dizüstü dahil', ekranlar.some(e=>e.ad?.includes('16:10')), ekranlar.find(e=>e.ad?.includes('16:10'))?.olcu ?? '-')

console.log('\n── WINDOWS ÖLÇEKLEME DPR DOĞRULAMASI ──')
const b = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl)
await b.connect()
const { targetInfos } = await b.send('Target.getTargets')
const olcum = []
for (const it of targetInfos.filter(t=>t.type==='iframe' && t.url.includes('localhost:8899'))) {
  const { sessionId } = await b.send('Target.attachToTarget',{targetId:it.targetId,flatten:true})
  const send=(m,pp={})=>new Promise((res,rej)=>{const id=++b.id;b.pending.set(id,{res,rej});b.ws.send(JSON.stringify({id,method:m,params:pp,sessionId}))})
  await send('Runtime.enable')
  olcum.push((await send('Runtime.evaluate',{returnByValue:true,expression:
    `({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio, ekran: screen.width+'×'+screen.height })`})).result.value)
}
for (const o of olcum) console.log(`   viewport ${(o.w+'×'+o.h).padEnd(11)} DPR ${String(o.dpr).padEnd(5)} screen ${o.ekran}`)
k('%125 ölçekleme DPR 1.25 olarak uygulandı', olcum.some(o=>o.w===1536 && o.dpr===1.25))
k('FHD viewport 1920×920', olcum.some(o=>o.w===1920 && o.h===920 && o.dpr===1))
k('1366 dizüstü dahil', olcum.some(o=>o.w===1366))
k('16:10 dizüstü 1536×832 @1.25', olcum.some(o=>o.w===1536 && o.h===832 && o.dpr===1.25))
k('320 px telefon dahil', olcum.some(o=>o.w===320))
k('Android tablet 800 px dahil', olcum.some(o=>o.w===800))
b.close()

console.log('\n── WINDOWS SETİ ──')
await p.eval(`[...document.querySelectorAll('.sidebar .chip')].find(c=>c.textContent.includes('Windows')).click()`)
await sleep(4000)
const win = await p.eval(`[...document.querySelectorAll('.frame .frame-head .nm')].map(e=>e.textContent)`)
k('Windows seti uygulandı', win.length === 7 && win.every(x=>x.includes('Windows')), win.join(', '))

console.log('\n── CİHAZ AÇIKLAMALARI (ipucu) ──')
const notlu = await p.eval(`(()=>{const r=[...document.querySelectorAll('.dev-row')].find(x=>x.textContent.includes('%125'));
  return r ? r.getAttribute('title') : null})()`)
k('açıklama ipucuna eklendi', !!notlu && notlu.includes('ölçekleme'), (notlu??'').replace(/\n/g,' | '))

writeFileSync('varsayilan.png', Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'))
const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('konsolda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,2).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,200)))
p.close()
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
