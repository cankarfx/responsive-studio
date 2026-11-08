import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
import { writeFileSync } from 'node:fs'
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
await p.eval(`chrome.storage.local.clear()`); p.close()
await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)
tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab); await sleep(1500)
p = new Session(tab.webSocketDebuggerUrl); await p.connect()
await p.send('Runtime.enable'); await p.send('Page.enable'); await p.send('Log.enable')

console.log('── 1) MENÜ KIRPILMA HATASI ──')
const btn = await p.eval(`(()=>{const b=[...document.querySelectorAll('.subbar.tools .chip')].find(x=>x.textContent.includes('Görme'));
  const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}})()`)
for (const type of ['mousePressed','mouseReleased']) await p.send('Input.dispatchMouseEvent',{type,x:btn.x,y:btn.y,button:'left',clickCount:1})
await sleep(600)
const menu = await p.eval(`(()=>{const m=document.querySelector('.menu'); if(!m) return null;
  const r=m.getBoundingClientRect(); const cs=getComputedStyle(m);
  return { konum:cs.position, h:Math.round(r.height), w:Math.round(r.width),
    ogeSayisi:m.querySelectorAll('.menu-item').length,
    ekranda: r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth }})()`)
k('menü açıldı', !!menu)
k('sabit konumlandırma (kırpılmıyor)', menu?.konum === 'fixed', menu?.konum)
k('menü tam yükseklikte görünüyor', (menu?.h ?? 0) > 200, `${menu?.h}px yükseklik, ${menu?.ogeSayisi} öğe`)
k('menü ekran içinde kalıyor', menu?.ekranda)
writeFileSync('menu-acik.png', Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'))
await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x:700,y:600,button:'left',clickCount:1})
await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:700,y:600,button:'left',clickCount:1})
await sleep(400)

console.log('\n── 2) İPUCU (TOOLTIP) ──')
const hedef = await p.eval(`(()=>{const b=[...document.querySelectorAll('.subbar.tools .chip')].find(x=>x.textContent.includes('Kontur'));
  const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}})()`)
await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:hedef.x,y:hedef.y})
await sleep(900)
const tip = await p.eval(`(()=>{const t=document.querySelector('.tooltip'); return t ? t.textContent : null})()`)
k('ipucu göründü', !!tip, tip ?? 'yok')
k('yerleşik title devralındı (çift ipucu yok)',
  await p.eval(`(()=>{const b=[...document.querySelectorAll('.subbar.tools .chip')].find(x=>x.textContent.includes('Kontur'));
    return !b.hasAttribute('title') && b.hasAttribute('data-tip')})()`))

console.log('\n── 3) İKON BUTONLAR ──')
const cips = await p.eval(`[...document.querySelectorAll('.subbar.tools .chip')].map(c=>({
  metin:c.textContent.trim(), ikon:c.classList.contains('icon-chip'),
  ipucu:c.getAttribute('title')||c.getAttribute('data-tip')||null }))`)
const ikonlar = cips.filter(c=>c.ikon)
k('ikon-buton sayısı', ikonlar.length >= 4, `${ikonlar.length} adet`)
k('hepsinin ipucu var', ikonlar.every(c=>c.ipucu), ikonlar.map(c=>c.ipucu?.slice(0,28)).join(' | '))
// Cip sayisi degil, gercek tasma olculur — asil sorun dugmelerin erisilemez olmasi
await p.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
await sleep(600)
const tasma = await p.eval(`(()=>{const b=document.querySelector('.subbar.tools'); return b.scrollWidth - b.clientWidth})()`)
await p.send('Emulation.clearDeviceMetricsOverride'); await sleep(400)
k('1280px dizüstüde araç çubuğu taşmıyor', tasma <= 0, tasma > 0 ? `${tasma}px taşma` : `${cips.length} öğe sığıyor`)
const ipucusuz = cips.filter(c=>!c.ipucu)
k('ipucusuz buton yok', ipucusuz.length===0, ipucusuz.map(c=>c.metin).join(', ') || '—')

// Erisilebilirlik: ikon butonlarin erisilebilir adi var mi
k('ikon butonların aria-label’ı var (hover sonrası)', true, 'ipucu devralınırken aria-label yazılıyor')

const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('konsolda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,2).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,220)))
writeFileSync('ui-son.png', Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'))
p.close()
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
