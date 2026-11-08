import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok=(b)=>b?'✓':'✗'; let hepsi=true
const k=(ad,c,ek='')=>{hepsi&&=!!c;console.log(` ${ok(c)} ${ad}${ek?' — '+ek:''}`)}

async function hatalar() {
  for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
    if (t.url.startsWith('chrome://extensions')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
  const tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome://extensions/?errors=${EXT}`)}`,{method:'PUT'})).json()
  await sleep(2500)
  const s = new Session(tab.webSocketDebuggerUrl); await s.connect(); await s.send('Runtime.enable')
  const list = await s.eval(`(() => { const out=[]; const gez=(k,d)=>{ if(d>20) return;
    for (const el of k.querySelectorAll('*')) { if (el.shadowRoot) gez(el.shadowRoot,d+1) }
    for (const el of k.querySelectorAll('.error-message')) { const t=(el.textContent||'').trim(); if(t) out.push(t) } }
    gez(document,0); return [...new Set(out)] })()`)
  s.close(); await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)
  return list
}

// Temiz baslangic: hatalari sil
console.log('── ÖNCE: hata listesi temizleniyor ──')
{
  for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
    if (t.url.startsWith('chrome://extensions')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
  const tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome://extensions/?errors=${EXT}`)}`,{method:'PUT'})).json()
  await sleep(2500)
  const s = new Session(tab.webSocketDebuggerUrl); await s.connect(); await s.send('Runtime.enable')
  await s.eval(`(() => { const gez=(k,d)=>{ if(d>20) return null;
    for (const el of k.querySelectorAll('*')) { if (el.shadowRoot) { const r=gez(el.shadowRoot,d+1); if(r) return r } }
    for (const el of k.querySelectorAll('cr-button, button')) { if ((el.textContent||'').includes('Tümünü temizle')) return el }
    return null }; const b=gez(document,0); if(b) b.click(); return !!b })()`)
  s.close(); await sleep(1000)
  await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)
}
console.log('   kalan:', (await hatalar()).length)

// Stüdyoyu ac — test sayfasi console.error/warn cagiriyor
for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
const vtab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(vtab); await sleep(2500)

console.log('\n── SONRA: eklentiye atfedilen hatalar ──')
const list = await hatalar()
for (const h of list) console.log('   •', h.slice(0,110))
k('sitenin console.error’u artık eklentiye atfedilmiyor', !list.some(h=>h.includes('Test hatasi')))
k('sitenin console.warn’u artık eklentiye atfedilmiyor', !list.some(h=>h.includes('Test uyarisi')))
k('yalnızca sandbox uyarısı kalıyor', list.every(h=>h.includes('sandbox')), `${list.length} kayıt`)
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
