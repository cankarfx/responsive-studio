import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
import { writeFileSync } from 'node:fs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok = (b) => b ? '✓' : '✗'
let hepsi = true
const kontrol = (ad, kosul, ek='') => { hepsi &&= kosul; console.log(` ${ok(kosul)} ${ad}${ek?' — '+ek:''}`) }

for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
let tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html`)}`,{method:'PUT'})).json()
let p = new Session(tab.webSocketDebuggerUrl); await p.connect(); await p.send('Runtime.enable')
/* Sayfa yüklenip chrome.* hazır olana kadar bekle — yoksa yarış oluyor */
for (let i = 0; i < 40; i++) {
  if (await p.eval(`typeof chrome !== 'undefined' && !!chrome.storage`).catch(() => false)) break
  await sleep(250)
}
await p.eval(`chrome.storage.local.clear()`); p.close()
await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)

tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab); await sleep(1500)
p = new Session(tab.webSocketDebuggerUrl); await p.connect()
await p.send('Runtime.enable'); await p.send('Log.enable'); await p.send('Page.enable')

console.log('\n── ARAYÜZ ──')
const ui = await p.eval(`({
  baslik: document.title, ekran: document.querySelectorAll('iframe').length,
  cihaz: document.querySelectorAll('.dev-row').length,
  setler: document.querySelectorAll('.sidebar .chip').length,
  senkronCip: document.querySelectorAll('.subbar .chip').length,
})`)
kontrol('viewer yüklendi', ui.baslik.includes('Responsive Studio'), ui.baslik)
kontrol('varsayılan 11 ekran açıldı', ui.ekran === 11, `${ui.ekran} iframe`)
kontrol('cihaz kütüphanesi', ui.cihaz > 150, `${ui.cihaz} satır`)
kontrol('hazır setler', ui.setler >= 9, `${ui.setler} set`)
kontrol('senkron denetimleri', ui.senkronCip >= 5, `${ui.senkronCip} çip`)

const hatalar = p.events.filter(e => e.method==='Runtime.exceptionThrown' ||
  (e.method==='Log.entryAdded' && e.params.entry.level==='error' && !String(e.params.entry.text).includes('favicon')))
kontrol('konsolda hata yok', hatalar.length === 0, `${hatalar.length} hata`)
if (hatalar.length) for (const h of hatalar.slice(0,3)) console.log('    ', JSON.stringify(h.params).slice(0,200))
writeFileSync('regresyon.png', Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'))
p.close()

console.log('\n── ÇERÇEVE İÇİ EMÜLASYON (X-Frame-Options: DENY gönderen sunucu) ──')
const b = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl); await b.connect()
const { targetInfos } = await b.send('Target.getTargets')
const frames = targetInfos.filter(t=>t.type==='iframe' && t.url.includes('localhost:8899'))
kontrol('tüm ekranlar yüklendi (header bypass)', frames.length === 11, `${frames.length}/11`)
const veri = []
for (const it of frames) {
  const { sessionId } = await b.send('Target.attachToTarget',{targetId:it.targetId,flatten:true})
  const send=(m,pp={})=>new Promise((res,rej)=>{const id=++b.id;b.pending.set(id,{res,rej});b.ws.send(JSON.stringify({id,method:m,params:pp,sessionId}))})
  await send('Runtime.enable')
  veri.push((await send('Runtime.evaluate',{returnByValue:true,expression:`({
    w:innerWidth, h:innerHeight, sw:screen.width, sh:screen.height,
    dpr:devicePixelRatio, touch:navigator.maxTouchPoints,
    ua:navigator.userAgent.split(')')[0]+')', mobil:navigator.userAgentData?.mobile,
    kip:getComputedStyle(document.querySelector('.mode'),'::after').content,
    hashTemiz:!location.hash.includes('__rs='), sbGenislik:innerWidth-document.documentElement.clientWidth })`})).result.value)
}
/* 11 kare, 10 farklı genişlik: 1536 iki kez (FHD %125 ve 16:10 %125 — yükseklikleri farklı) */
kontrol('genişlikler cihaza göre', new Set(veri.map(v=>v.w)).size === 10, veri.map(v=>v.w).sort((a,b)=>a-b).join(', '))
kontrol('DPR cihaza göre', new Set(veri.map(v=>v.dpr)).size >= 4, [...new Set(veri.map(v=>v.dpr))].join(', '))
kontrol('UA cihaza göre', new Set(veri.map(v=>v.ua)).size >= 4, `${new Set(veri.map(v=>v.ua)).size} farklı`)
kontrol('dokunma yalnızca mobil/tablette', veri.filter(v=>v.touch>0).length === 6, `${veri.filter(v=>v.touch>0).length} dokunmatik`)
/* Kare sırası Target.getTargets'a bağlı — genişliğe göre bul */
const enDar = veri.find(v=>v.w===320), enGenis = veri.find(v=>v.w===1920)
kontrol('CSS media query doğru', !!enDar && !!enGenis && enDar.kip.includes('MOBIL') && enGenis.kip.includes('MASAUSTU'))
kontrol('yapılandırma adresten temizlendi', veri.every(v=>v.hashTemiz))
kontrol('kaydırma çubuğu viewport daraltmıyor', veri.every(v=>v.sbGenislik===0))

console.log('\n── MASAÜSTÜ: VIEWPORT ≠ EKRAN ──')
const masa = veri.filter(v=>v.w>=1366)
for (const m of masa) console.log(`   viewport ${(m.w+'×'+m.h).padEnd(11)} screen ${(m.sw+'×'+m.sh).padEnd(11)} DPR ${m.dpr}`)
kontrol('masaüstünde ekran yüksekliği viewport’tan büyük', masa.every(m=>m.sh > m.h), `${masa.length} masaüstü ekranı`)
kontrol('mobilde viewport = ekran', veri.filter(v=>v.w<900).every(v=>v.sh===v.h && v.sw===v.w))
kontrol('Windows %125 ölçekleme DPR 1.25', veri.some(v=>v.w===1536 && v.dpr===1.25))
b.close()
console.log(`\n${hepsi ? '✅ TÜM KONTROLLER GEÇTİ' : '❌ BAŞARISIZ KONTROL VAR'}`)
process.exit(hepsi?0:1)
