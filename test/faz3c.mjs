import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok=(b)=>b?'✓':'✗'; let hepsi=true
const k=(ad,c,ek='')=>{hepsi&&=!!c;console.log(` ${ok(c)} ${ad}${ek?' — '+ek:''}`)}
for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
const tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab); await sleep(1500)
const p = new Session(tab.webSocketDebuggerUrl); await p.connect()
await p.send('Runtime.enable'); await p.send('Log.enable')

const chips = await p.eval(`[...document.querySelectorAll('.subbar.tools .chip')].map(c=>c.textContent.trim())`)
k('araç çubuğu sadeleşti', chips.length <= 16, `${chips.length} öğe`)
console.log('   ', chips.join(' | '))

// Menüden bir denetim çalıştır
await p.eval(`[...document.querySelectorAll('.chip')].find(b=>b.textContent.includes('Erişilebilirlik')).click()`)
await sleep(400)
const ogeler = await p.eval(`[...document.querySelectorAll('.menu-item span')].map(s=>s.textContent)`)
k('menüde 9 denetim var', ogeler.length === 9, ogeler.join(', '))
await p.eval(`[...document.querySelectorAll('.menu-item')].find(b=>b.textContent.includes('Renk kontrastı')).click()`)
await sleep(2500)
const not = await p.eval(`document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? ''`)
k('kontrast denetimi menüden çalıştı', not.includes('AA eşiğinin altında'), not.slice(0,80))

await p.eval(`[...document.querySelectorAll('.chip')].find(b=>b.textContent.includes('Erişilebilirlik')).click()`)
await sleep(400)
await p.eval(`[...document.querySelectorAll('.menu-item')].find(b=>b.textContent.includes('Tam denetim')).click()`)
let axeMetin=''
for (let i=0;i<20;i++){ await sleep(1200); axeMetin = await p.eval(`document.querySelector('.drawer-body')?.innerText.replace(/\\s+/g,' ') ?? ''`)
  if (axeMetin.includes('ihlal') || axeMetin.includes('bulamadı')) break }
k('axe denetimi menüden çalıştı', axeMetin.includes('ihlal') || axeMetin.includes('bulamadı'), axeMetin.slice(0,90))
const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('konsolda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,2).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,220)))
p.close()
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
