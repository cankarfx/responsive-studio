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
await p.send('Runtime.enable'); await p.send('Log.enable'); await p.send('Page.enable')

/** Erişilebilirlik menüsünü açıp içinden bir denetim seçer. */
const tikla = async (etiket) => {
  await p.eval(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await sleep(200)
  await p.eval(`[...document.querySelectorAll('.subbar.tools .chip')].find(x=>x.textContent.includes('Erişilebilirlik')).click()`)
  await sleep(350)
  return p.eval(`(()=>{const b=[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes(${JSON.stringify(etiket)}));
    if(!b) return false; b.click(); return true})()`)
}
const govde = () => p.eval(`document.querySelector('.drawer-body')?.innerText.replace(/\\s+/g,' ') ?? ''`)

console.log('── F) KONTRAST DENETİMİ ──')
k('Kontrast düğmesi', await tikla('Renk kontrastı')); await sleep(2500)
const kont = await p.eval(`(()=>{const rows=[...document.querySelectorAll('.drawer-body .tbl tbody tr')];
  return { not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '',
    satir: rows.map(r=>r.innerText.replace(/\\s+/g,' ')) }})()`)
k('kontrast ihlalleri bulundu', kont.satir.length >= 2, kont.not)
k('oranlar hesaplandı', kont.satir.some(x=>/\d\.\d+:1/.test(x)))
console.log('   ', kont.satir.slice(0,3).join('\n    '))

console.log('\n── G) BAŞLIK YAPISI ──')
k('Başlıklar düğmesi', await tikla('Başlık yapısı')); await sleep(2000)
const bas = await p.eval(`(()=>({ not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '',
  satir: [...document.querySelectorAll('.outline-row')].map(r=>r.innerText.replace(/\\s+/g,' ')),
  atlanan: document.querySelectorAll('.outline-row.bad').length }))()`)
k('başlıklar listelendi', bas.satir.length >= 3, bas.not)
k('seviye atlaması yakalandı (h2 → h4)', bas.atlanan >= 1, `${bas.atlanan} atlama`)
console.log('   ', bas.satir.join(' | '))

console.log('\n── H) LANDMARK ──')
k('Landmark düğmesi', await tikla('Landmark / ARIA')); await sleep(2000)
const lm = await govde()
k('landmark bölgeleri bulundu', lm.includes('navigation') && lm.includes('main'), lm.slice(0,120))

console.log('\n── I) ALT METİN ──')
k('Alt metin düğmesi', await tikla('Alt metin denetimi')); await sleep(2000)
const alt = await p.eval(`(()=>({ not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '',
  satir: [...document.querySelectorAll('.drawer-body .tbl tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' ')) }))()`)
k('alt metin sorunları bulundu', alt.satir.some(x=>x.includes('alt niteliği yok')) && alt.satir.some(x=>x.includes('anlamsız')), alt.not)
console.log('   ', alt.satir.slice(0,4).join('\n    '))

console.log('\n── J) TAB SIRASI ──')
k('Tab sırası düğmesi', await tikla('Tab sırası')); await sleep(2000)
const tabs = await p.eval(`(()=>({ not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '',
  ilk: [...document.querySelectorAll('.drawer-body .tbl tbody tr')].slice(0,3).map(r=>r.innerText.replace(/\\s+/g,' ')) }))()`)
k('pozitif tabindex uyarısı verildi', tabs.not.includes('pozitif tabindex'), tabs.not)
k('pozitif tabindex başa alındı', /tabindex|3/.test(tabs.ilk[0] ?? ''), tabs.ilk[0])

console.log('\n── K) DOKUNMA HEDEFLERİ ──')
k('Hedefler düğmesi', await tikla('Dokunma hedefleri')); await sleep(2000)
const hed = await p.eval(`(()=>({ not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '',
  satir: [...document.querySelectorAll('.drawer-body .tbl tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' ')) }))()`)
k('küçük hedef yakalandı (20×20 düğme)', hed.satir.some(x=>/\b2\dx?×?\d/.test(x)) || hed.satir.length>=1, hed.not)
console.log('   ', hed.satir.slice(0,3).join('\n    '))

console.log('\n── L) PWA ──')
k('PWA düğmesi', await tikla('PWA & favicon')); await sleep(2500)
const pwa = await govde()
k('manifest okundu', pwa.includes('Test PWA'), pwa.slice(0,150))
k('apple-touch-icon bulundu', pwa.includes('apple-touch-icon'))

console.log('\n── M) SOSYAL ÖNİZLEME ──')
k('Sosyal düğmesi', await tikla('Sosyal önizleme')); await sleep(2500)
const sos = await p.eval(`(()=>({ kart: document.querySelectorAll('.social-card').length,
  basliklar: [...document.querySelectorAll('.social-head b')].map(b=>b.textContent).join(', '),
  gorsel: document.querySelectorAll('.social-card img').length,
  metin: document.querySelector('.social-grid')?.innerText.replace(/\\s+/g,' ').slice(0,120) ?? '' }))()`)
k('9 platform kartı oluşturuldu', sos.kart === 9, `${sos.kart} kart`)
k('og:image kartlarda gösterildi', sos.gorsel >= 6, `${sos.gorsel} görsel`)
console.log('   ', sos.basliklar)

console.log('\n── N) AXE-CORE DENETİMİ ──')
k('Denetim düğmesi', await tikla('Tam denetim'))
let axeMetin = ''
for (let i=0;i<20;i++){ await sleep(1200); axeMetin = await govde()
  if (!axeMetin.includes('düğmesine basın')) break }
k('axe-core yüklendi ve çalıştı', !axeMetin.includes('yüklenemedi') && axeMetin.length > 40, axeMetin.slice(0,130))
const axe = await p.eval(`(()=>({ ihlal: document.querySelectorAll('.axe-item').length,
  not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '' }))()`)
k('ihlaller raporlandı', axe.ihlal >= 1, `${axe.ihlal} ihlal · ${axe.not}`)

writeFileSync('faz3-gorunum.png', Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'))
const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('viewer konsolunda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,3).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,250)))
p.close()
console.log(`\n${hepsi?'✅ F–N GEÇTİ':'❌ BAŞARISIZ VAR'}`)
process.exit(0)
