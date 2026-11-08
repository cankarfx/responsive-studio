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
await p.eval(`chrome.storage.local.clear()`); p.close()
await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)
tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab); await sleep(1500)
p = new Session(tab.webSocketDebuggerUrl); await p.connect()
await p.send('Runtime.enable'); await p.send('Log.enable')

/** Menüyü kapatıp yenisini açar — menüler üst üste binmesin */
const menuAc = async (etiket) => {
  await p.eval(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await sleep(200)
  await p.eval(`[...document.querySelectorAll('.chip')].find(b=>b.textContent.includes(${JSON.stringify(etiket)})).click()`)
  await sleep(400)
  return p.eval(`!!document.querySelector('.menu')`)
}
const menuSec = async (metin) => {
  const bulundu = await p.eval(`(()=>{const b=[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes(${JSON.stringify(metin)}));
    if(!b) return false; b.click(); return true})()`)
  await sleep(1400); return bulundu
}
const frameEval = async (expr) => {
  const b = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl)
  await b.connect()
  const { targetInfos } = await b.send('Target.getTargets')
  const out = []
  for (const it of targetInfos.filter(t=>t.type==='iframe' && t.url.includes('localhost:8899'))) {
    const { sessionId } = await b.send('Target.attachToTarget',{targetId:it.targetId,flatten:true})
    const send=(m,pp={})=>new Promise((res,rej)=>{const id=++b.id;b.pending.set(id,{res,rej});b.ws.send(JSON.stringify({id,method:m,params:pp,sessionId}))})
    await send('Runtime.enable')
    out.push((await send('Runtime.evaluate',{returnByValue:true,expression:expr})).result.value)
  }
  b.close(); return out
}
const durum = () => frameEval(`({ tema: getComputedStyle(document.querySelector('.tema'),'::after').content,
  dis: getComputedStyle(document.querySelector('.dis'),'::after').content,
  bg: getComputedStyle(document.body).backgroundColor,
  js: matchMedia('(prefers-color-scheme: dark)').matches })`)

console.log('── A) GERÇEK CSS RENK ŞEMASI (işletim sistemi KOYU → AÇIK zorla) ──')
const once = await durum()
console.log('   başlangıç (OS koyu):', JSON.stringify(once[0]))
await menuAc('Tercih')
await p.eval(`(()=>{const r=[...document.querySelectorAll('.menu-row')].find(x=>x.textContent.includes('Renk şeması'));
  [...r.querySelectorAll('button')].find(b=>b.textContent==='Açık').click()})()`)
await sleep(2500)
const acik = await durum()
console.log('   açık zorlandı  :', JSON.stringify(acik[0]))
k('satır içi CSS açık moda geçti', acik.every(x=>x.tema.includes('ACIK')))
k('HARİCİ stylesheet de açık moda geçti', acik.every(x=>x.dis.includes('DIS-ACIK')))
k('gerçek arka plan beyaza döndü', acik.every(x=>x.bg === 'rgb(255, 255, 255)'), acik[0].bg)
k('JS matchMedia uyumlu (dark=false)', acik.every(x=>x.js === false))

console.log('\n── B) KOYU ZORLAMA + GERİ ALMA ──')
await p.eval(`(()=>{const r=[...document.querySelectorAll('.menu-row')].find(x=>x.textContent.includes('Renk şeması'));
  [...r.querySelectorAll('button')].find(b=>b.textContent==='Koyu').click()})()`)
await sleep(2000)
const koyu = await durum()
k('koyu zorlandı', koyu.every(x=>x.tema.includes('KOYU') && x.bg === 'rgb(17, 17, 17)'))
await p.eval(`(()=>{const r=[...document.querySelectorAll('.menu-row')].find(x=>x.textContent.includes('Renk şeması'));
  [...r.querySelectorAll('button')].find(b=>b.textContent==='Otomatik').click()})()`)
await sleep(2000)
const geri = await durum()
k('otomatiğe dönünce OS tercihine (koyu) geri döndü', geri.every(x=>x.tema.includes('KOYU')))
k('stylesheet bozulmadı (dış CSS hâlâ çalışıyor)', geri.every(x=>x.dis.includes('DIS-KOYU')), geri[0].dis)

console.log('\n── C) AZALTILMIŞ HAREKET + KONTRAST TERCİHİ ──')
await p.eval(`(()=>{const rows=[...document.querySelectorAll('.menu-row')];
  [...rows.find(x=>x.textContent.includes('Azaltılmış')).querySelectorAll('button')].find(b=>b.textContent==='Azalt').click();
  [...rows.find(x=>x.textContent.includes('Kontrast tercihi')).querySelectorAll('button')].find(b=>b.textContent==='Yüksek').click()})()`)
await sleep(2200)
const pref = await frameEval(`({ hareket: getComputedStyle(document.querySelector('.hareket'),'::after').content,
  kontrast: getComputedStyle(document.querySelector('.kontrast'),'::after').content })`)
k('prefers-reduced-motion: reduce uygulandı', pref.every(x=>x.hareket.includes('AZALTILMIS')), pref[0].hareket)
k('prefers-contrast: more uygulandı', pref.every(x=>x.kontrast.includes('YUKSEK')), pref[0].kontrast)

console.log('\n── D) RENK KÖRLÜĞÜ SİMÜLASYONU ──')
k('Görme menüsü açıldı', await menuAc('Görme'))
k('Döteranopi seçildi', await menuSec('Döteranopi'))
const vis = await frameEval(`({ f: getComputedStyle(document.documentElement).filter, svg: !!document.getElementById('__rs_vision_svg__') })`)
k('feColorMatrix filtresi uygulandı', vis.every(x=>x.f.includes('rs-vision')), vis[0].f)
k('SVG filtre tanımı enjekte edildi', vis.every(x=>x.svg))

console.log('\n── E) METİN ÖLÇEKLEME (WCAG 1.4.4) ──')
k('Metin menüsü açıldı', await menuAc('Metin'))
k('%200 seçildi', await menuSec('%200'))
const ts = await frameEval(`getComputedStyle(document.documentElement).fontSize`)
k('kök font boyutu 32px oldu', ts.every(x=>parseFloat(x) >= 31), ts[0])

const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('viewer konsolunda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,2).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,250)))
p.close()
console.log(`\n${hepsi?'✅ A–E GEÇTİ':'❌ BAŞARISIZ VAR'}`)
process.exit(0)
