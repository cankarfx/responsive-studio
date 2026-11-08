import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
import { writeFileSync } from 'node:fs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok = (b) => b ? '✓' : '✗'
let hepsi = true
const k = (ad, kosul, ek='') => { hepsi &&= !!kosul; console.log(` ${ok(kosul)} ${ad}${ek?' — '+ek:''}`) }

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

const menuSec = async (menu, oge) => {
  await p.eval(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await sleep(200)
  await p.eval(`[...document.querySelectorAll('.subbar.tools .chip')].find(x=>((x.textContent||'')+(x.getAttribute('title')||'')+(x.getAttribute('data-tip')||'')).includes(${JSON.stringify(menu)})).click()`)
  await sleep(350)
  return p.eval(`(()=>{const b=[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes(${JSON.stringify(oge)}));
    if(!b) return false; b.click(); return true})()`)
}
const chipTikla = async (txt) => p.eval(`(()=>{const b=[...document.querySelectorAll('.subbar.tools .chip')].find(x=>((x.textContent||'')+(x.getAttribute('title')||'')+(x.getAttribute('data-tip')||'')).includes(${JSON.stringify(txt)}));
  if(!b) return false; b.click(); return true})()`)
const clickTxt = async (txt) => {
  const r = await p.eval(`(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes(${JSON.stringify(txt)}));
    if(!e)return null; const b=e.getBoundingClientRect(); return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
  if(!r) return false
  for (const type of ['mousePressed','mouseReleased']) await p.send('Input.dispatchMouseEvent',{type,x:r.x,y:r.y,button:'left',clickCount:1})
  return true
}

console.log('\n── A) KONSOL TOPLAYICI ──')
await chipTikla('Konsol'); await sleep(1200)
const konsol = await p.eval(`(()=>{const rows=[...document.querySelectorAll('.drawer-body .tbl tr')];
  return { satir: rows.length, metin: rows.map(r=>r.innerText.replace(/\\s+/g,' ')) }})()`)
k('konsol kayıtları toplandı', konsol.satir >= 2, `${konsol.satir} satır`)
k('sayfadaki console.error yakalandı', JSON.stringify(konsol.metin).includes('Test hatasi'))
k('sayfadaki console.warn yakalandı', JSON.stringify(konsol.metin).includes('Test uyarisi'))
console.log('   örnek:', konsol.metin[0])

console.log('\n── B) CSS KIRILIM NOKTASI TESPİTİ ──')
await menuSec('Rapor','CSS kırılım'); await sleep(2500)
const bp = await p.eval(`(()=>{const rows=[...document.querySelectorAll('.drawer-body .tbl tbody tr')];
  return rows.map(r=>r.children[0].textContent+' '+r.children[1].textContent)})()`)
k('kırılım noktaları çıkarıldı', bp.length >= 5, `${bp.length} nokta`)
k('480 / 600 / 768 / 1024 / 1280 bulundu',
  ['480','600','768','1024','1280'].every(v=>bp.some(x=>x.startsWith(v+'px'))))
console.log('   bulunan:', bp.join(' | '))

console.log('\n── C) YATAY TAŞMA DEDEKTÖRÜ ──')
await chipTikla('Taşma'); await sleep(2000)
const tasma = await p.eval(`(()=>{const rows=[...document.querySelectorAll('.drawer-body .tbl tbody tr')];
  return { grup: document.querySelectorAll('.drawer-group').length,
           ilk: rows[0]?.innerText.replace(/\\s+/g,' ') ?? null, satir: rows.length }})()`)
k('taşan eleman bulundu', tasma.satir >= 1, `${tasma.satir} kayıt, ${tasma.grup} ekran`)
k('taşma miktarı hesaplandı', /\+\d+px/.test(tasma.ilk ?? ''), tasma.ilk)

console.log('\n── D) META TARAMASI ──')
await menuSec('Rapor','Meta ve SEO'); await sleep(1500)
const meta = await p.eval(`document.querySelector('.drawer-body')?.innerText.replace(/\\s+/g,' ') ?? ''`)
k('meta etiketleri listelendi', meta.includes('description') && meta.includes('canonical'))
console.log('   ', meta.slice(0,180))

console.log('\n── E) GÖRSEL DENETİMİ ──')
await menuSec('Rapor','Görsel ve medya'); await sleep(2000)
const gorsel = await p.eval(`document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? ''`)
k('kırık görsel tespit edildi', gorsel.includes('kırık'), gorsel)

console.log('\n── F) BAĞLANTI DENETİMİ ──')
await menuSec('Rapor','Bağlantı denetimi'); await sleep(4000)
const bag = await p.eval(`(()=>({ not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '',
  satir: [...document.querySelectorAll('.drawer-body .tbl tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' ')) }))()`)
k('bağlantılar denetlendi', bag.satir.length >= 3, bag.not)
k('404 bulundu', JSON.stringify(bag.satir).includes('404'))
k('dış bağlantı denetlendi (SW üzerinden)', bag.satir.some(x=>x.includes('example.com') && x.startsWith('200')),
  bag.satir.find(x=>x.includes('example.com')) ?? 'bulunamadı')
console.log('   ', bag.satir.slice(0,4).join('\n    '))

writeFileSync('faz2-a.png', Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'))
p.close()
console.log(`\n${hepsi ? '✅ A–F GEÇTİ' : '❌ BAŞARISIZ VAR'}`)
process.exit(0)
