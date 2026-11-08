/* Ekranları sürükleyerek yeniden sıralama */
import { Session, sleep, karelerHazirTab } from './cdp.mjs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok=(b)=>b?'✓':'✗'; let hepsi=true
const k=(ad,c,ek='')=>{hepsi&&=!!c;console.log(` ${ok(c)} ${ad}${ek?' — '+ek:''}`)}

for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
let tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html`)}`,{method:'PUT'})).json()
let p = new Session(tab.webSocketDebuggerUrl); await p.connect(); await p.send('Runtime.enable')
for (let i=0;i<40;i++){ if(await p.eval(`typeof chrome!=='undefined' && !!chrome.storage`).catch(()=>false)) break; await sleep(250) }
await p.eval(`chrome.storage.local.clear()`); p.close()
await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)
tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab); await sleep(1500)
p = new Session(tab.webSocketDebuggerUrl); await p.connect()
await p.send('Runtime.enable'); await p.send('Log.enable')

const adlar = () => p.eval(`[...document.querySelectorAll('.stage .frame .frame-head .nm')].map(e=>e.textContent)`)
/** Kare başlığının orta noktası (sayfa koordinatı) */
const basligiBul = (i) => p.eval(`(()=>{const f=document.querySelectorAll('.stage .frame')[${i}];
  f.scrollIntoView({block:'center'}); const r=f.querySelector('.frame-head').getBoundingClientRect();
  return {x:Math.round(r.left+30), y:Math.round(r.top+r.height/2)}})()`)
const kutuBul = (i) => p.eval(`(()=>{const f=document.querySelectorAll('.stage .frame')[${i}];
  const r=f.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+40)}})()`)

const once = await adlar()
console.log('── ÖNCE ──'); console.log('   ' + once.join(' | '))
k('11 ekran var', once.length === 11, `${once.length}`)

// 1. ekranı 3. ekranın SAĞINA bırak
console.log('\n── 1. ekranı 3.’nün sağına sürükle ──')
const bas = await basligiBul(0)
const hedef = await kutuBul(2)
await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x:bas.x,y:bas.y,button:'left',clickCount:1,buttons:1})
for (let i=1;i<=8;i++) {
  await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,
    x: Math.round(bas.x + (hedef.x + 40 - bas.x)*i/8), y: Math.round(bas.y + (hedef.y - bas.y)*i/8)})
  await sleep(70)
}
const gosterge = await p.eval(`document.querySelectorAll('.frame.drop-before, .frame.drop-after').length
  + '/' + document.querySelectorAll('.frame.dragging').length`)
k('bırakma göstergesi ve sürüklenen kare işaretlendi', gosterge === '1/1', gosterge)
await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:hedef.x+40,y:hedef.y,button:'left',clickCount:1})
await sleep(600)

const sonra = await adlar()
console.log('── SONRA ──'); console.log('   ' + sonra.join(' | '))
k('sıra değişti', sonra.join() !== once.join())
k('hiç ekran kaybolmadı/çoğalmadı', sonra.length === 11 && once.every(x=>sonra.includes(x)))
k('sürüklenen ekran öne değil arkaya gitti', sonra.indexOf(once[0]) > 0, `${once[0]} → ${sonra.indexOf(once[0])}. sıra`)
k('geçici sınıflar temizlendi',
  await p.eval(`document.querySelectorAll('.frame.dragging,.frame.drop-before,.frame.drop-after').length === 0
    && !document.body.classList.contains('reordering')`))

console.log('\n── KALICILIK ──')
await sleep(900)
const kayit = await p.eval(`(async()=>{const g=await chrome.storage.local.get('rs_state_v1');
  return g.rs_state_v1.frames.length})()`)
k('sıra depoya yazıldı', kayit === 11, `${kayit} kare`)
const depoReorder = await p.eval(`(async()=>{const g=await chrome.storage.local.get('rs_state_v1');
  return 'reorder' in g.rs_state_v1})()`)
k('geçici sürükleme durumu kalıcılaştırılmadı', depoReorder === false)

console.log('\n── BAŞLIKTAKİ BUTONLAR HÂLÂ ÇALIŞIYOR ──')
const kb = await p.eval(`(()=>{const f=document.querySelectorAll('.stage .frame')[0];
  f.scrollIntoView({block:'center'});
  const b=[...f.querySelectorAll('.frame-head .tools .btn')].find(x=>(x.getAttribute('data-tip')||x.title||'').includes('Gizle'));
  if(!b) return null; const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`)
if (kb) {
  /* .tools yalnızca .frame:hover iken pointer-events alıyor — önce üzerine gel */
  await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:kb.x,y:kb.y})
  await sleep(300)
  await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x:kb.x,y:kb.y,button:'left',clickCount:1,buttons:1})
  await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:kb.x,y:kb.y,button:'left',clickCount:1})
  await sleep(500)
}
const kalan = await adlar()
k('“Gizle” butonu sürükleme yüzünden bozulmadı', kalan.length === 10, `${kalan.length} görünür ekran`)

const errs = p.events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'))
k('konsolda hata yok', errs.length===0, `${errs.length}`)
errs.slice(0,2).forEach(e=>console.log('   ',JSON.stringify(e.params).slice(0,200)))
p.close()
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
