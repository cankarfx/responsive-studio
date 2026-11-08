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
await p.eval(`chrome.storage.local.clear()`)
/* Sekme açılışta son adresi kaydetmeye başlar; o kayıt bitmeden kapatılırsa
   kapanışta eski durumu geri yazar. Bekle, tekrar temizle, sonra kapat. */
await sleep(2500); await p.eval(`chrome.storage.local.clear()`); p.close()
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

console.log('── A) CETVEL / ÖLÇÜM ARACI (Faz 2 borcu) ──')
await p.eval(`[...document.querySelectorAll('.subbar.tools .chip')].find(x=>x.textContent.includes('Cetvel')).click()`)
await sleep(800)
const frame = await p.eval(`(()=>{const f=document.querySelector('.frame-box'); const r=f.getBoundingClientRect();
  return {x:Math.round(r.x+60), y:Math.round(r.y+120)}})()`)
await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:frame.x,y:frame.y})
await sleep(500)
const olcum1 = await frameEval(`(()=>{const h=document.getElementById('__rs_overlay__'); return !!h})()`)
k('bindirme katmanı oluştu', olcum1.some(Boolean))
// Suruklyerek olc
await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x:frame.x,y:frame.y,button:'left',clickCount:1})
await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:frame.x+80,y:frame.y+50,buttons:1})
await sleep(600)
const ss = await p.send('Page.captureScreenshot',{format:'png'})
writeFileSync('cetvel.png', Buffer.from(ss.data,'base64'))
await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:frame.x+80,y:frame.y+50,button:'left'})
k('ölçüm görüntüsü alındı (görsel kontrol için)', true, 'cetvel.png')
await p.eval(`[...document.querySelectorAll('.subbar.tools .chip')].find(x=>x.textContent.includes('Cetvel')).click()`)
await sleep(400)

console.log('\n── B) CANLI CSS ENJEKSİYONU (Faz 2 borcu) ──')
k('Canlı kod paneli açıldı', await menuSec('Geliştirici', 'Canlı CSS'))
await sleep(600)
await p.eval(`(()=>{const ta=document.querySelector('.code-area');
  const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  setter.call(ta, 'body { background: rgb(1, 2, 3) !important }');
  ta.dispatchEvent(new Event('input',{bubbles:true}))})()`)
await sleep(1500)
const css1 = await frameEval(`getComputedStyle(document.body).backgroundColor`)
k('CSS tüm ekranlara uygulandı', css1.every(x=>x==='rgb(1, 2, 3)'), css1[0])
// Yeniden yuklemede korunuyor mu
await p.eval(`document.querySelector('.topbar .btn[title^="Tümünü"]').click()`)
await sleep(900); await karelerHazir(p)
const css2 = await frameEval(`getComputedStyle(document.body).backgroundColor`)
k('yeniden yüklemede korundu', css2.every(x=>x==='rgb(1, 2, 3)'), css2[0])
// Temizle
await p.eval(`[...document.querySelectorAll('.code-tabs button')].find(b=>b.textContent.includes('Temizle')).click()`)
await sleep(1500)
const css3 = await frameEval(`getComputedStyle(document.body).backgroundColor`)
k('temizleme çalıştı', css3.every(x=>x!=='rgb(1, 2, 3)'), css3[0])

console.log('\n── C) CANLI JS ENJEKSİYONU ──')
await p.eval(`[...document.querySelectorAll('.code-tabs button')].find(b=>b.textContent==='JavaScript').click()`)
await sleep(400)
await p.eval(`(()=>{const ta=document.querySelector('.code-area');
  const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
  setter.call(ta, 'document.title = "JS CALISTI"');
  ta.dispatchEvent(new Event('input',{bubbles:true}))})()`)
await sleep(400)
await p.eval(`[...document.querySelectorAll('.code-tabs button')].find(b=>b.textContent==='Çalıştır').click()`)
await sleep(1200)
const js1 = await frameEval(`document.title`)
k('JS tüm ekranlarda çalıştı', js1.every(x=>x==='JS CALISTI'), js1[0])

console.log('\n── D) CSS DEĞİŞKENLERİ (Faz 2 borcu) ──')
k('CSS değişkenleri taraması', await menuSec('Geliştirici', 'CSS değişkenleri'))
await sleep(2500)
const vars = await p.eval(`(()=>({ not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '',
  satir: [...document.querySelectorAll('.drawer-body .tbl tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' ')),
  renkOrnegi: document.querySelectorAll('.var-swatch').length }))()`)
k('değişkenler bulundu', vars.satir.length >= 6, vars.not)
k('renk önizlemeleri çizildi', vars.renkOrnegi >= 2, `${vars.renkOrnegi} örnek`)
console.log('   ', vars.satir.slice(0,4).join('\n    '))

console.log('\n── E) DEPOLAMA GÖRÜNTÜLEYİCİ ──')
k('Depolama taraması', await menuSec('Geliştirici', 'Depolama'))
await sleep(2500)
const st = await p.eval(`(()=>({ not: document.querySelector('.drawer-note')?.innerText.replace(/\\s+/g,' ') ?? '',
  govde: document.querySelector('.drawer-body')?.innerText.replace(/\\s+/g,' ').slice(0,300) ?? '' }))()`)
k('localStorage okundu', st.govde.includes('oturum') && st.govde.includes('abc123'), st.not)
k('sessionStorage okundu', st.govde.includes('gecici'))
k('çerez sayısı bildirildi', /\d+ çerez/.test(st.not))
// Temizleme
await p.eval(`(()=>{const b=[...document.querySelectorAll('.drawer-group button')].find(x=>x.textContent.includes('Tümünü sil')); b.click()})()`)
await sleep(2000)
const ls = await frameEval(`localStorage.length`)
k('localStorage tüm ekranlarda temizlendi', ls.every(x=>x===0), `uzunluk ${ls[0]}`)

console.log('\n── F) ÖZEL HTTP BAŞLIKLARI ──')
k('Başlık paneli açıldı', await menuSec('Geliştirici', 'Özel HTTP başlıkları'))
await sleep(600)
await p.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Başlık ekle')).click()`)
await sleep(400)
await p.eval(`(()=>{const rows=document.querySelectorAll('.hdr-row');
  const r=rows[0]; const ins=r.querySelectorAll('input');
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  setter.call(ins[0],'X-Test-Baslik'); ins[0].dispatchEvent(new Event('input',{bubbles:true}));
  setter.call(ins[1],'merhaba-dunya'); ins[1].dispatchEvent(new Event('input',{bubbles:true}))})()`)
await sleep(1500)
await p.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Uygula ve yenile')).click()`)
await sleep(900); await karelerHazir(p)
const hdr = await frameEval(`document.getElementById('hdr')?.textContent ?? ''`)
k('özel başlık sunucuya ulaştı', hdr.every(x=>x.includes('merhaba-dunya')), hdr[0])

writeFileSync('faz4.png', Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'))
const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('viewer konsolunda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,3).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,240)))
p.close()
console.log(`\n${hepsi?'✅ A–F GEÇTİ':'❌ BAŞARISIZ VAR'}`)
process.exit(0)
