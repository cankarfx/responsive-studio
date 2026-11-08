import { Session, sleep } from './cdp.mjs'
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const p = new Session(list.find(t=>t.url.includes('viewer.html')).webSocketDebuggerUrl)
await p.connect(); await p.send('Runtime.enable'); await p.send('Log.enable')
const ok=(b)=>b?'✓':'✗'; let hepsi=true
const k=(ad,c,ek='')=>{hepsi&&=!!c;console.log(` ${ok(c)} ${ad}${ek?' — '+ek:''}`)}

console.log('── K) TASARIM BİNDİRMESİ (sürükle-bırak) ──')
// 400x300 kirmizi PNG'yi surukle-birak ile ilk ekrana birak
await p.eval(`(async () => {
  const c = document.createElement('canvas'); c.width=400; c.height=300;
  const x=c.getContext('2d'); x.fillStyle='#e11'; x.fillRect(0,0,400,300);
  const blob = await new Promise(r=>c.toBlob(r,'image/png'));
  const file = new File([blob], 'tasarim.png', {type:'image/png'});
  const dt = new DataTransfer(); dt.items.add(file);
  const box = document.querySelector('.frame-box');
  box.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  return 'birakildi';
})()`)
await sleep(1200)
const ov = await p.eval(`(()=>{const img=document.querySelector('.overlay-img');
  return { var: !!img, opaklik: img?.style.opacity, bar: !!document.querySelector('.ov-bar'),
    toast: document.querySelector('.toast')?.textContent ?? null }})()`)
k('bindirme görseli eklendi', ov.var, ov.toast ?? '')
k('kontrol şeridi göründü', ov.bar)
k('varsayılan opaklık %50', ov.opaklik === '0.5')

// Ok tuslariyla hizalama
const once = await p.eval(`document.querySelector('.overlay-img').style.transform`)
await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
await sleep(500)
const sonra = await p.eval(`document.querySelector('.overlay-img').style.transform`)
k('ok tuşuyla hizalandı', once !== sonra, `${once} → ${sonra}`)

// Fark modu
await p.eval(`[...document.querySelectorAll('.ov-bar button')].find(b=>b.textContent==='fark').click()`)
await sleep(400)
k('fark (difference) modu', (await p.eval(`document.querySelector('.overlay-img').style.mixBlendMode`)) === 'difference')

// Kaldir
await p.eval(`document.querySelector('.ov-bar button.danger').click()`)
await sleep(400)
k('bindirme kaldırıldı', !(await p.eval(`!!document.querySelector('.overlay-img')`)))

console.log('\n── L) FONTLAR & VITALS ──')
const menuSec = async (menu, oge) => {
  await p.eval(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`)
  await sleep(200)
  await p.eval(`[...document.querySelectorAll('.subbar.tools .chip')].find(x=>((x.textContent||'')+(x.getAttribute('title')||'')+(x.getAttribute('data-tip')||'')).includes(${JSON.stringify(menu)})).click()`)
  await sleep(350)
  return p.eval(`(()=>{const b=[...document.querySelectorAll('.menu-item')].find(x=>x.textContent.includes(${JSON.stringify(oge)}));
    if(!b) return false; b.click(); return true})()`)
}
const clickTxt = async (txt) => {
  const r = await p.eval(`(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes(${JSON.stringify(txt)}));
    if(!e)return null; const b=e.getBoundingClientRect(); return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`)
  if(!r) return false
  for (const type of ['mousePressed','mouseReleased']) await p.send('Input.dispatchMouseEvent',{type,x:r.x,y:r.y,button:'left',clickCount:1})
  return true
}
await menuSec('Rapor','Font envanteri'); await sleep(2000)
const fonts = await p.eval(`[...document.querySelectorAll('.drawer-body .tbl tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' ')).slice(0,3)`)
k('font envanteri çıkarıldı', fonts.length >= 1, fonts.join(' | '))

await menuSec('Rapor','Web Vitals'); await sleep(2500)
const vit = await p.eval(`(()=>{const rows=[...document.querySelectorAll('.drawer-body .tbl tbody tr')];
  return { satir: rows.length, ilk: rows[0]?.innerText.replace(/\\s+/g,' ') ?? '' }})()`)
k('her ekran için vitals toplandı', vit.satir >= 5, `${vit.satir} ekran · ${vit.ilk}`)

const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('konsolda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,2).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,250)))
p.close()
console.log(`\n${hepsi?'✅ K–L GEÇTİ':'❌ BAŞARISIZ VAR'}`)
process.exit(0)
