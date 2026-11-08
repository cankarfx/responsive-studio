import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
import { readdirSync, readFileSync } from 'node:fs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
/* Chrome mutlak yol ister; klasör yoksa indirme sessizce düşer. */
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const DL = resolve(dirname(fileURLToPath(import.meta.url)), 'indirilen')
rmSync(DL, { recursive: true, force: true })
mkdirSync(DL, { recursive: true })
const ok=(b)=>b?'✓':'✗'; let hepsi=true
const k=(ad,c,ek='')=>{hepsi&&=!!c;console.log(` ${ok(c)} ${ad}${ek?' — '+ek:''}`)}

for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
const tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab); await sleep(1500)
const p = new Session(tab.webSocketDebuggerUrl); await p.connect()
await p.send('Runtime.enable'); await p.send('Page.enable'); await p.send('Log.enable')
await p.send('Browser.setDownloadBehavior', { behavior:'allowAndName', downloadPath: DL, eventsEnabled: true })

console.log('── EKRAN KAYDI (WebM) ──')
await p.send('Runtime.evaluate',{ userGesture:true, expression:
  `[...document.querySelectorAll('.subbar.tools .chip')].find(x=>((x.getAttribute('title')||'')+(x.getAttribute('data-tip')||'')).includes('Ekran kaydı')).click()` })
await sleep(2000)
const kaydediyor = await p.eval(`!!document.querySelector('.chip.rec')`)
k('kayıt başladı', kaydediyor, await p.eval(`document.querySelector('.toast')?.textContent ?? '-'`))
if (kaydediyor) {
  // Biraz etkilesim uret
  for (let i=0;i<3;i++){ await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:600+i*80,y:400}); await sleep(700) }
  await p.send('Runtime.evaluate',{ userGesture:true, expression:
    `[...document.querySelectorAll('.subbar.tools .chip')].find(x=>((x.getAttribute('title')||'')+(x.getAttribute('data-tip')||'')).includes('Kaydı durdur')).click()` })
  for (let i=0;i<12;i++){ await sleep(800)
    const t = await p.eval(`document.querySelector('.toast')?.textContent ?? null`)
    if (t) { k('kayıt indirildi', t.includes('indirildi'), t); break } }
  await sleep(1500)
  const f = readdirSync(DL)
  k('dosya oluştu', f.length >= 1, f.join(', '))
  if (f.length) {
    const buf = readFileSync(`${DL}/${f[0]}`)
    k('geçerli WebM (EBML imzası)', buf[0]===0x1a && buf[1]===0x45 && buf[2]===0xdf && buf[3]===0xa3,
      `${Math.round(buf.length/1024)} KB`)
  }
}
const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('konsolda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,2).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,220)))
p.close()
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
