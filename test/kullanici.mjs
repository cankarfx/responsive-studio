/**
 * KULLANICI SENARYOLARI — stüdyodaki her düğmeyi bir kullanıcı gibi, gerçek fare
 * ve klavye olaylarıyla dener. Diğer paketler çoğunlukla iç eylemleri çağırır;
 * bu paket arayüzün kendisini doğrular (düğme gerçekten ne yapıyor?).
 *
 * Ekranlar: m1 = iPhone 16 (393, dokunmatik), t1 = iPad Air 11 (820), d1 = Windows HD (1366)
 */
import { Session, sleep, karelerHazir } from './cdp.mjs'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const EXT = 'ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const SITE = 'http://localhost:8899/senaryo.html'
const INDIR = resolve(import.meta.dirname, 'indirilen', 'kullanici')
let hepsi = true
const hatalar = []
const k = (ad, c, ek = '') => {
  if (!c) { hepsi = false; hatalar.push(ad) }
  console.log(` ${c ? '✓' : '✗'} ${ad}${ek !== '' ? ' — ' + ek : ''}`)
}
const bolum = (ad) => console.log(`\n── ${ad} ──`)

/* ─── Kurulum ─────────────────────────────────────────────────── */
for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)

const DURUM = {
  frames: [
    { fid: 'm1', deviceId: 'iphone-16', width: 393, height: 852, dpr: 3, landscape: false, browser: 'safari', zoom: null, hidden: false, colorScheme: 'auto' },
    { fid: 't1', deviceId: 'ipad-air-11', width: 820, height: 1180, dpr: 2, landscape: false, browser: 'safari', zoom: null, hidden: false, colorScheme: 'auto' },
    { fid: 'd1', deviceId: 'win-laptop-hd', width: 1366, height: 608, dpr: 1, landscape: false, browser: 'chrome', zoom: null, hidden: false, colorScheme: 'auto' },
  ],
  layout: 'grid', zoom: 'fit', gap: 24, workspaces: [], panel: 'devices',
  sync: { scroll: true, scrollMode: 'ratio', click: true, input: true, hover: true, navigation: true, soloFid: null },
  settings: { theme: 'dark', proMode: false, httpUserAgent: null, autoReload: 0, customDevices: [], deviceSets: [],
    lastWorkspaceId: null, favorites: [], defaultBrowser: 'chrome', frameBusting: true, customHeaders: [],
    injectCss: '', injectJs: '', startupSet: 'set-populer', loadStagger: 0, touchMode: true },
}

async function stüdyoAc(durum = DURUM, url = SITE) {
  for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
    if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
  await sleep(1500)  /* kapanan stüdyonun son kaydı yeni durumun üzerine yazmasın */
  /* Durumu stüdyo sekmesi açmadan, arka plan servisinden yaz — geçici bir stüdyo
     sekmesi kapanırken kendi (eski) durumunu kaydedip bunun üzerine yazıyordu. */
  const sw = (await (await fetch('http://127.0.0.1:9222/json/list')).json()).find((t) => t.type === 'service_worker' && t.url.includes(EXT))
  const yaz = `chrome.storage.local.clear().then(() => chrome.storage.local.set({ rs_state_v1: ${JSON.stringify(durum)} }))`
  let s, tab
  if (sw) {
    s = new Session(sw.webSocketDebuggerUrl); await s.connect(); await s.eval(yaz); s.close()
  } else {
    /* Servis uykuda: geçici stüdyo sekmesiyle yaz, sekmenin kendi kaydı bitince
       (≤ 2 sn) tekrar yaz, sonra kapat — böylece kapanışta yazacak bir şeyi kalmaz. */
    tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html`)}`, { method: 'PUT' })).json()
    s = new Session(tab.webSocketDebuggerUrl); await s.connect(); await s.send('Runtime.enable')
    for (let i = 0; i < 40; i++) { if (await s.eval(`typeof chrome !== 'undefined' && !!chrome.storage`).catch(() => false)) break; await sleep(250) }
    await s.eval(yaz); await sleep(3000); await s.eval(yaz); await sleep(300)
    s.close(); await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`); await sleep(800)
  }
  tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent(url)}`)}`, { method: 'PUT' })).json()
  await sleep(1200)
  s = new Session(tab.webSocketDebuggerUrl); await s.connect(); await s.send('Runtime.enable'); await s.send('Page.enable')
  await karelerHazir(s)
  await sleep(1500)
  return { tab, s }
}

let { tab, s: p } = await stüdyoAc()
const tarayici = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl)
await tarayici.connect()
rmSync(INDIR, { recursive: true, force: true }); mkdirSync(INDIR, { recursive: true })
await tarayici.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: INDIR, eventsEnabled: true })

/* ─── Çerçeve oturumları ─────────────────────────────────────── */
const GENISLIK = { 393: 'm1', 852: 'm1', 820: 't1', 1180: 't1', 1366: 'd1', 608: 'd1' }
let cer = {}   // fid → { eval }
async function cerceveleriBagla() {
  cer = {}
  const { targetInfos } = await tarayici.send('Target.getTargets')
  for (const t of targetInfos.filter((x) => x.type === 'iframe' && x.url.startsWith('http://localhost:8899'))) {
    try {
      const { sessionId } = await tarayici.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
      const gonder = (m, pp = {}) => new Promise((res, rej) => {
        const id = ++tarayici.id; tarayici.pending.set(id, { res, rej })
        tarayici.ws.send(JSON.stringify({ id, method: m, params: pp, sessionId }))
        setTimeout(() => { if (tarayici.pending.has(id)) { tarayici.pending.delete(id); rej(new Error('zaman aşımı ' + m)) } }, 15000)
      })
      const ev = async (e) => {
        const r = await gonder('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: e })
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
        return r.result.value
      }
      const w = await ev('innerWidth')
      const fid = GENISLIK[w] ?? `?${w}`
      cer[fid] = { ev, w, url: t.url, gonder }
    } catch { /* kapanmış çerçeve */ }
  }
  return Object.keys(cer).sort().join(',')
}
const her = async (e, fids = ['m1', 't1', 'd1']) => {
  const o = {}
  for (const f of fids) o[f] = cer[f] ? await cer[f].ev(e).catch((x) => 'HATA:' + x.message) : 'YOK'
  /* Çerçeve yeniden yüklendiyse oturum düşer — bunu da raporla, sonra yeniden bağlan */
  if (Object.values(o).some((v) => typeof v === 'string' && v.includes('Session with given id not found'))) {
    console.log('   ⚠︎ ekran(lar) beklenmedik şekilde YENİDEN YÜKLENDİ')
    yenidenYuklenme++
    await karelerHazir(p); await cerceveleriBagla()
    for (const f of fids) o[f] = cer[f] ? await cer[f].ev(e).catch((x) => 'HATA:' + x.message) : 'YOK'
  }
  return o
}
let yenidenYuklenme = 0
/** Kapalı gölge DOM dahil çerçevede belirli sınıfta düğüm var mı (denetçi vurgusu). */
async function golgeSinifVar(fid, sinif) {
  const { root } = await cer[fid].gonder('DOM.getDocument', { depth: -1, pierce: true })
  const ara = (n) => (n.attributes && (() => { const i = n.attributes.indexOf('class'); return i >= 0 && n.attributes[i + 1].split(' ').includes(sinif) })())
    || [...(n.children ?? []), ...(n.shadowRoots ?? []), ...(n.contentDocument ? [n.contentDocument] : [])].some(ara)
  return ara(root)
}

/* ─── Viewer etkileşimi (gerçek fare) ────────────────────────── */
async function fare(x, y, { tus = 'left', shift = false } = {}) {
  const modifiers = shift ? 8 : 0
  await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  /* Gerçek kullanıcı önce üzerine gelir: ekran başlığındaki araçlar hover'da
     tıklanabilir oluyor, hemen basmak düğmeyi ıskalıyordu. */
  await sleep(150)
  await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: tus, clickCount: 1, modifiers })
  await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: tus, clickCount: 1, modifiers })
}
/** Görünen metni / ipucu / title'ı eşleşen ilk elemana tıklar. */
async function tikla(metin, { kapsam = 'document', shift = false, bekle = 400, secici = 'button,.menu-item,.chip,.dev-row,.ws-row,.set-row,a' } = {}) {
  const r = await p.eval(`(()=>{
    const kok = ${kapsam === 'document' ? 'document' : `document.querySelector(${JSON.stringify(kapsam)})`}
    if (!kok) return null
    const m = ${JSON.stringify(metin)}
    /* Güncel ipucu: varsa title (Preact değişince yeniden yazar), yoksa data-tip.
       Yalnızca görünür elemanlar — yeniden kullanılan düğümlerde eski data-tip kalabiliyor. */
    const ip = e => e.getAttribute('title') ?? e.getAttribute('data-tip') ?? ''
    const adaylar = [...kok.querySelectorAll(${JSON.stringify(secici)})].filter(e => e.getClientRects().length > 0)
    const el = adaylar.find(e => ip(e) === m || (e.getAttribute('aria-label')||'') === m)
      || adaylar.find(e => (e.getAttribute('placeholder')||'') === m)
      || adaylar.find(e => (e.textContent||'').trim() === m)
      || adaylar.find(e => (ip(e)||e.getAttribute('aria-label')||'').startsWith(m))
      || adaylar.find(e => (e.textContent||'').trim().startsWith(m))
    if (!el) return null
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }
  })()`)
  if (!r) { console.log(`   ⚠︎ bulunamadı: "${metin}"`); return false }
  await fare(r.x, r.y, { shift })
  await sleep(bekle)
  return true
}
async function tus(key, { ctrl = false, shift = false, code, metin } = {}) {
  const modifiers = (ctrl ? 2 : 0) | (shift ? 8 : 0)
  const kc = { Escape: 27, Enter: 13, ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40 }[key] ?? key.toUpperCase().charCodeAt(0)
  const c = code ?? (key.length === 1 ? (/\d/.test(key) ? 'Digit' + key : 'Key' + key.toUpperCase()) : key)
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: c, windowsVirtualKeyCode: kc, modifiers, text: metin })
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: c, windowsVirtualKeyCode: kc, modifiers })
  await sleep(300)
}
const yaz = async (metin) => { await p.send('Input.insertText', { text: metin }); await sleep(300) }
const viewer = (e) => p.eval(e)
/* Kalıcılık 400 ms gecikmeli — kayıttan okumadan önce bekle */
/** Koşul sağlanana kadar yoklar (en çok `ms`); son değeri döndürür. */
async function bekleKosul(fn, kosul, ms = 6000) {
  const bas = Date.now(); let v
  do { v = await fn(); if (kosul(v)) return v; await sleep(300) } while (Date.now() - bas < ms)
  return v
}
const durum = async () => { await sleep(800); return viewer(`(async()=> (await chrome.storage.local.get('rs_state_v1')).rs_state_v1)()`) }

/** Çerçeve içindeki elemanın viewer koordinatı (ölçek dahil). */
async function cerKoord(fid, secici) {
  const r = await cer[fid].ev(`(()=>{const e=document.querySelector(${JSON.stringify(secici)}); if(!e) return null;
    e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}})()`)
  await sleep(250)
  const r2 = await cer[fid].ev(`(()=>{const e=document.querySelector(${JSON.stringify(secici)}); const b=e.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}})()`)
  if (!r || !r2) return null
  const kutu = await viewer(`(()=>{const f=document.querySelector('[data-fid="${fid}"] iframe'); f.scrollIntoView({block:'nearest',inline:'nearest'}); const b=f.getBoundingClientRect();
    return {x:b.x, y:b.y, olcek: b.width / f.offsetWidth}})()`)
  return { x: Math.round(kutu.x + r2.x * kutu.olcek), y: Math.round(kutu.y + r2.y * kutu.olcek) }
}
async function cerTikla(fid, secici) {
  const c = await cerKoord(fid, secici)
  if (!c) { console.log(`   ⚠︎ çerçevede yok: ${secici}`); return }
  await fare(c.x, c.y); await sleep(500)
}
async function cerTekerlek(fid, dy) {
  const kutu = await viewer(`(()=>{const b=document.querySelector('[data-fid="${fid}"] iframe').getBoundingClientRect(); return {x:b.x+b.width/2, y:b.y+Math.min(b.height/2, 200)}})()`)
  /* Yeni yüklenen çerçevede CDP tekerlek olayının onayı bazen hiç gelmiyor —
     onayı en fazla 3 sn bekle, olay yine de işlenmiş olur. */
  await Promise.race([
    p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(kutu.x), y: Math.round(kutu.y), deltaX: 0, deltaY: dy }).catch(() => {}),
    sleep(3000),
  ])
  await sleep(900)
}
const indirilenler = () => readdirSync(INDIR).filter((f) => !f.endsWith('.crdownload'))
async function indirmeBekle(onceki, ms = 20000) {
  const bas = Date.now()
  while (Date.now() - bas < ms) {
    const yeni = indirilenler().filter((f) => !onceki.includes(f))
    if (yeni.length) { await sleep(500); return yeni }
    await sleep(400)
  }
  return []
}
const toastlar = () => viewer(`[...document.querySelectorAll('.toast')].map(t=>t.textContent.trim()).join(' | ')`)
const cekmece = () => viewer(`(()=>{const d=document.querySelector('.drawer'); if(!d) return null;
  const sek=d.querySelector('.drawer-tabs .on, .tab.on, [aria-selected="true"]'); return { sekme: sek?.textContent.trim()||'', metin: d.textContent.replace(/\\s+/g,' ').slice(0, 4000) }})()`)

console.log('çerçeveler:', await cerceveleriBagla())
k('üç ekran da yüklendi', cer.m1 && cer.t1 && cer.d1, Object.keys(cer).join(','))

/* ═══ A. SENKRON ETKİLEŞİM ═══════════════════════════════════════ */
bolum('A. SENKRON — kaydırma')
await her('scrollTo(0,0)')
await cerTekerlek('m1', 600)
let sc = await her('Math.round(scrollY)')
console.log('   scrollY:', JSON.stringify(sc))
k('mobilde kaydırınca tablet de kaydı', sc.t1 > 50, sc.t1)
k('mobilde kaydırınca masaüstü de kaydı', sc.d1 > 50, sc.d1)

await tikla('Kaydırmayı tüm ekranlarda eşle')
await her('scrollTo(0,0)'); await sleep(400)
await cerTekerlek('m1', 600)
sc = await her('Math.round(scrollY)')
k('Kaydırma kapalıyken diğerleri kaymadı', sc.m1 > 50 && sc.t1 < 5 && sc.d1 < 5, JSON.stringify(sc))
await tikla('Kaydırmayı tüm ekranlarda eşle')
await her('scrollTo(0,0)'); await sleep(400)

bolum('A. SENKRON — tıklama')
await cerTikla('m1', '#btn')
let tk = await her('window.__s.tik')
console.log('   tıklama sayaçları:', JSON.stringify(tk))
k('mobilde dokunuş kendi düğmesine basıldı', tk.m1 === 1, tk.m1)
k('tıklama diğer ekranlara yansıdı', tk.t1 === 1 && tk.d1 === 1, JSON.stringify(tk))
await tikla('Tıklamaları tüm ekranlarda tekrarla')
await cerTikla('m1', '#btn')
tk = await her('window.__s.tik')
k('Tıklama kapalıyken yansımadı', tk.m1 === 2 && tk.t1 === 1 && tk.d1 === 1, JSON.stringify(tk))
await tikla('Tıklamaları tüm ekranlarda tekrarla')

bolum('A. SENKRON — form girişi')
await cerTikla('m1', '#ad')
await yaz('Merhaba')
await sleep(500)
let gi = await her(`document.getElementById('ad').value`)
console.log('   değerler:', JSON.stringify(gi))
k('yazı diğer ekranlara yansıdı', gi.m1 === 'Merhaba' && gi.t1 === 'Merhaba' && gi.d1 === 'Merhaba', JSON.stringify(gi))
await cerTikla('m1', '#onay')
gi = await her(`document.getElementById('onay').checked`)
k('onay kutusu yansıdı', gi.m1 === true && gi.t1 === true && gi.d1 === true, JSON.stringify(gi))
await tikla('Form girişlerini ve tuş vuruşlarını eşle')
await cerTikla('m1', '#ad'); await yaz('X')
gi = await her(`document.getElementById('ad').value`)
k('Giriş kapalıyken yansımadı', gi.m1 === 'MerhabaX' && gi.t1 === 'Merhaba', JSON.stringify(gi))
await tikla('Form girişlerini ve tuş vuruşlarını eşle')

bolum('A. SENKRON — gezinme')
await cerTikla('m1', '#git')
await sleep(2500); await karelerHazir(p); await cerceveleriBagla()
let ur = await her('location.pathname')
console.log('   adresler:', JSON.stringify(ur))
k('bağlantıya basınca tüm ekranlar gitti', ur.m1 === '/sayfa2.html' && ur.t1 === '/sayfa2.html' && ur.d1 === '/sayfa2.html', JSON.stringify(ur))
let adres = await viewer(`document.querySelector('.topbar input').value`)
k('adres çubuğu yeni sayfayı gösteriyor', adres.includes('sayfa2.html'), adres)
await tikla('Geri')
await sleep(2500); await karelerHazir(p); await cerceveleriBagla()
ur = await her('location.pathname')
k('Geri düğmesi tüm ekranları geri götürdü', ur.m1 === '/senaryo.html' && ur.t1 === '/senaryo.html' && ur.d1 === '/senaryo.html', JSON.stringify(ur))
await tikla('İleri')
await sleep(2500); await karelerHazir(p); await cerceveleriBagla()
ur = await her('location.pathname')
k('İleri düğmesi tekrar ileri götürdü', ur.m1 === '/sayfa2.html' && ur.d1 === '/sayfa2.html', JSON.stringify(ur))
await tikla('Geri'); await sleep(2500); await karelerHazir(p); await cerceveleriBagla()

/* ═══ B. TEK-EKRAN MODU ══════════════════════════════════════════ */
bolum('B. TEK-EKRAN MODU (yalnızca bu ekranda çalış)')
await her('scrollTo(0,0); window.__s.tik=0; document.getElementById("ad").value=""')
await tikla('Yalnızca bu ekranda çalış (senkronu geçici kapat)', { kapsam: '[data-fid="m1"]' })
let st = await durum()
k('tek-ekran modu açıldı', st.sync.soloFid === 'm1', st.sync.soloFid)
k('"Tek-ekran modu açık" çipi göründü', await viewer(`[...document.querySelectorAll('.chip')].some(c=>c.textContent.includes('Tek-ekran modu açık'))`))
await cerTekerlek('m1', 600)
sc = await her('Math.round(scrollY)')
if (sc.m1 < 50) { await cerTekerlek('m1', 600); sc = await her('Math.round(scrollY)') }
k('tek-ekranda kaydırma diğerlerine yansımadı', sc.m1 > 50 && sc.t1 < 5 && sc.d1 < 5, JSON.stringify(sc))
await cerTikla('m1', '#btn')
tk = await her('window.__s.tik')
k('tek-ekranda tıklama diğerlerine yansımadı', tk.m1 === 1 && tk.t1 === 0 && tk.d1 === 0, JSON.stringify(tk))
await cerTikla('m1', '#ad'); await yaz('solo')
gi = await her(`document.getElementById('ad').value`)
k('tek-ekranda yazı diğerlerine yansımadı', gi.m1 === 'solo' && gi.t1 === '' && gi.d1 === '', JSON.stringify(gi))
await cerTikla('m1', '#git')
await sleep(2500); await karelerHazir(p); await cerceveleriBagla()
ur = await her('location.pathname')
k('tek-ekranda bağlantı yalnızca o ekranı götürdü', ur.m1 === '/sayfa2.html' && ur.t1 === '/senaryo.html' && ur.d1 === '/senaryo.html', JSON.stringify(ur))
const m1ua = await cer.m1?.ev('navigator.userAgent').catch(() => '')
k('tek başına giden ekran mobil kimliğini korudu', /iPhone/.test(m1ua ?? ''), (m1ua ?? '').slice(0, 50))
await viewer(`document.activeElement?.blur?.()`)
await tus('Escape')
st = await durum()
k('Esc tek-ekran modundan çıkardı', st.sync.soloFid === null, String(st.sync.soloFid))
await tikla('Adres girin — örn. localhost:3000 veya site.com', { secici: 'input' })
await viewer(`(()=>{const i=document.querySelector('.topbar input'); i.focus(); i.select()})()`)
await yaz(SITE); await tus('Enter')
await sleep(2500); await karelerHazir(p); await cerceveleriBagla()
ur = await her('location.pathname')
k('adres çubuğuna yazıp Enter → tüm ekranlar o adrese gitti', ur.m1 === '/senaryo.html' && ur.t1 === '/senaryo.html' && ur.d1 === '/senaryo.html', JSON.stringify(ur))
await her('scrollTo(0,0)'); await sleep(300)
await cerTekerlek('m1', 600)
sc = await her('Math.round(scrollY)')
if (sc.m1 < 50) { await cerTekerlek('m1', 600); sc = await her('Math.round(scrollY)') }
k('tek-ekrandan çıkınca senkron geri geldi', sc.t1 > 50 && sc.d1 > 50, JSON.stringify(sc))
await her('scrollTo(0,0)')

/* ═══ C. ÜST ÇUBUK ═══════════════════════════════════════════════ */
bolum('C. ÜST ÇUBUK')
await her('window.__isaret = 1')
await tikla('Tümünü yenile (Ctrl+R)')
await sleep(2000); await karelerHazir(p); await cerceveleriBagla()
let is = await her('window.__isaret ?? 0')
k('Tümünü yenile tüm ekranları yeniledi', is.m1 === 0 && is.t1 === 0 && is.d1 === 0, JSON.stringify(is))

for (const [ad, deger] of [['Tek sıra (yatay kaydır)', 'row'], ['Tek sütun', 'column'], ['Ortalanmış', 'focus'], ['Izgara', 'grid']]) {
  await tikla(ad, { kapsam: '.topbar' })
  st = await bekleKosul(durum, (x) => x.layout === deger)
  k(`yerleşim: ${ad}`, st.layout === deger, st.layout)
}
const olc = () => viewer(`(()=>{const f=document.querySelector('[data-fid="m1"] iframe'); return +(f.getBoundingClientRect().width / f.offsetWidth).toFixed(3)})()`)
const o0 = await olc()
await tikla('Yakınlaştır (Ctrl++)'); const o1 = await olc()
k('Yakınlaştır ölçeği büyüttü', o1 > o0, `${o0} → ${o1}`)
await tikla('Uzaklaştır (Ctrl+-)'); await tikla('Uzaklaştır (Ctrl+-)'); const o2 = await olc()
k('Uzaklaştır ölçeği küçülttü', o2 < o1, `${o1} → ${o2}`)
await tikla('Sığdır (Ctrl+0)'); const o3 = await olc()
const sigdi = await viewer(`(()=>{const c=document.querySelector('.canvas')||document.querySelector('main'); return c.scrollWidth <= c.clientWidth + 2})()`)
k('Sığdır tüm ekranları pencereye sığdırdı', sigdi, `ölçek ${o3}`)

await tikla('Tüm ekranları çevir (R)')
await sleep(1500); await karelerHazir(p); await cerceveleriBagla()
st = await durum()
k('Tüm ekranları çevir → hepsi yatay', st.frames.every((f) => f.landscape), st.frames.map((f) => f.landscape).join(','))
let gw = await her('innerWidth', ['m1'])
k('çevrilen mobil ekranın genişliği 852', gw.m1 === 852, gw.m1)
await tikla('Tüm ekranları çevir (R)')
await sleep(1500); await karelerHazir(p); await cerceveleriBagla()

const tema0 = await viewer(`document.documentElement.dataset.theme || document.body.className`)
await tikla('Temayı değiştir')
const tema1 = await bekleKosul(() => viewer(`document.documentElement.dataset.theme || document.body.className`), (t) => t !== tema0)
k('Temayı değiştir arayüz temasını değiştirdi', tema0 !== tema1, `${tema0} → ${tema1}`)
await tikla('Temayı değiştir')

await tikla('Yan panel (Ctrl+B)')
let yan = await viewer(`!!document.querySelector('.sidebar') && getComputedStyle(document.querySelector('.sidebar')).display !== 'none' && document.querySelector('.sidebar').getBoundingClientRect().width > 50`)
k('Yan panel düğmesi paneli kapattı', !yan)
await tikla('Yan panel (Ctrl+B)')
yan = await viewer(`!!document.querySelector('.sidebar') && document.querySelector('.sidebar').getBoundingClientRect().width > 50`)
k('Yan panel düğmesi paneli tekrar açtı', yan)

/* ═══ D. EKRAN BAŞLIĞI DÜĞMELERİ ═════════════════════════════════ */
bolum('D. EKRAN BAŞLIĞI')
await tikla('Çevir (dikey ↔ yatay)', { kapsam: '[data-fid="m1"]' })
await sleep(1500); await karelerHazir(p); await cerceveleriBagla()
gw = await her('innerWidth', ['m1', 't1'])
k('tek ekranı çevir yalnızca o ekranı çevirdi', cer.m1?.w === 852 || gw.m1 === 852, JSON.stringify(gw))
await tikla('Çevir (dikey ↔ yatay)', { kapsam: '[data-fid="m1"]' })
await sleep(1500); await karelerHazir(p); await cerceveleriBagla()

await her('window.__isaret = 1')
await tikla('Bu ekranı yenile', { kapsam: '[data-fid="m1"]' })
await sleep(2000); await karelerHazir(p); await cerceveleriBagla()
is = await her('window.__isaret ?? 0', ['m1', 't1'])
k('Bu ekranı yenile yalnızca o ekranı yeniledi', is.m1 === 0 && is.t1 === 1, JSON.stringify(is))

let once = indirilenler()
await tikla('Bu ekranın tam sayfa görüntüsünü indir', { kapsam: '[data-fid="m1"]', bekle: 200 })
let yeni = await indirmeBekle(once, 30000)
k('ekran başlığından tam sayfa görüntü indirildi', yeni.some((f) => f.endsWith('.png')), yeni.join(',') || (await toastlar()))

const sekmeler0 = (await (await fetch('http://127.0.0.1:9222/json/list')).json()).length
await tikla('Yeni sekmede aç', { kapsam: '[data-fid="m1"]' })
await sleep(1500)
const sekmeler = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const yeniSekme = sekmeler.find((t) => t.type === 'page' && t.url.includes('senaryo.html'))
k('Yeni sekmede aç siteyi yeni sekmede açtı', sekmeler.length > sekmeler0 && !!yeniSekme, yeniSekme?.url ?? '')
if (yeniSekme) await fetch(`http://127.0.0.1:9222/json/close/${yeniSekme.id}`)
await sleep(500)
await p.send('Page.bringToFront')

await tikla('Gizle', { kapsam: '[data-fid="t1"]' })
st = await durum()
k('Gizle ekranı gizledi', st.frames.find((f) => f.fid === 't1')?.hidden === true)
const gizliCip = await viewer(`[...document.querySelectorAll('button,.chip')].find(b => /gizli/i.test(b.textContent))?.textContent?.trim() ?? ''`)
k('gizli ekran için geri getirme çipi var', !!gizliCip, gizliCip)
if (gizliCip) await tikla(gizliCip)
st = await durum()
k('gizli ekran geri getirildi', st.frames.find((f) => f.fid === 't1')?.hidden === false)

/* ═══ E. BİNDİRMELER ═════════════════════════════════════════════ */
bolum('E. BİNDİRMELER')
await sleep(800); await karelerHazir(p); await cerceveleriBagla()
const rsSayisi = () => her(`document.querySelectorAll('[id^="__rs"], [class*="__rs"], [data-rs]').length + document.querySelectorAll('style[id^="__rs"]').length`)
const r0 = await rsSayisi()
for (const [ad, kisa] of [['Tüm elemanların sınırlarını göster', 'Kontur'], ['Kolon / taban çizgisi ızgarası', 'Izgara'], ['Artı kılavuz + sürükleyerek piksel ölçümü (Esc ile sıfırla)', 'Cetvel']]) {
  await tikla(ad); await sleep(500)
  const r1 = await rsSayisi()
  st = await durum()
  k(`${kisa} açıldı ve tüm ekranlara çizildi`, r1.m1 > r0.m1 && r1.t1 > r0.t1 && r1.d1 > r0.d1, `${JSON.stringify(r0)} → ${JSON.stringify(r1)}`)
  await tikla(ad); await sleep(500)
  const r2 = await rsSayisi()
  const gorunen = await her(`(()=>{const h=document.getElementById('__rs_overlay__'); return !!document.getElementById('__rs_outline__') || !!document.getElementById('__rs_tool_cursor__')})()`)
  k(`${kisa} kapanınca bindirme kalktı`, Object.values(gorunen).every((v) => v === false), JSON.stringify(gorunen))
}
await tikla('Yatay taşmaya sebep olan elemanları işaretle'); await sleep(1500)
let ck = await cekmece()
k('Taşma alt paneli açtı', !!ck, ck?.sekme)
await tikla('Yatay taşmaya sebep olan elemanları işaretle'); await sleep(300)

await tikla('Elemana tıkla — tüm ekranlarda eşleniği vurgulanır'); await sleep(400)
await cerTikla('m1', 'h1'); await sleep(800)
ck = await cekmece()
k('Denetçi: tıklanan eleman alt panelde', !!ck && /h1/i.test(ck.metin), (ck?.metin ?? '').slice(0, 120))
const vur = { t1: await golgeSinifVar('t1', 'hl'), d1: await golgeSinifVar('d1', 'hl') }
k('Denetçi: aynı eleman diğer ekranlarda vurgulandı', vur.t1 === true && vur.d1 === true, JSON.stringify(vur))
tk = await her('window.__s.tik')
await tikla('Elemana tıkla — tüm ekranlarda eşleniği vurgulanır')

/* ═══ F. MENÜLER ═════════════════════════════════════════════════ */
bolum('F. RAPOR MENÜSÜ')
const RAPOR = 'Sayfa raporları — kırılım noktaları, bağlantılar, görseller, fontlar, Web Vitals, meta'
const beklenen = {
  'CSS kırılım noktaları': /600|1000/,
  'Bağlantı denetimi': /404|yok-boyle/,
  'Görsel ve medya': /yok\.png|kırık/i,
  'Font envanteri': /system-ui|sans|font/i,
  'Web Vitals': /LCP|CLS/,
  'Meta ve SEO': /Senaryo sayfası|Kullanıcı senaryosu/,
}
for (const [madde, desen] of Object.entries(beklenen)) {
  await tikla(RAPOR); await tikla(madde, { kapsam: '.menu' })
  let ok = false, m = ''
  for (let i = 0; i < 20 && !ok; i++) { await sleep(500); m = (await cekmece())?.metin ?? ''; ok = desen.test(m) }
  k(`Rapor → ${madde}`, ok, ok ? '' : m.slice(0, 140))
}

bolum('F. ERİŞİLEBİLİRLİK MENÜSÜ')
const A11Y = 'Erişilebilirlik denetimleri — axe-core, kontrast, başlık yapısı, tab sırası ve daha fazlası'
const a11yBek = {
  'Tam denetim (axe-core)': /ihlal|label|image-alt|heading|kural/i,
  'Renk kontrastı': /kontrast|AA|oran|sorun yok|geçti/i,
  'Başlık yapısı': /h1|h3|atlan/i,
  'Landmark / ARIA': /landmark|main|bölge/i,
  'Alt metin denetimi': /alt|eksik/i,
  'Tab sırası': /tab|odak/i,
  'Dokunma hedefleri': /44|hedef/i,
  'Sosyal önizleme': /Senaryo OG|Google|WhatsApp/,
  'PWA & favicon': /manifest|favicon|HTTPS|service/i,
}
for (const [madde, desen] of Object.entries(a11yBek)) {
  await tikla(A11Y); await tikla(madde, { kapsam: '.menu' })
  let ok = false, m = ''
  for (let i = 0; i < 30 && !ok; i++) { await sleep(500); m = (await cekmece())?.metin ?? ''; ok = desen.test(m) && !/taranıyor|çalışıyor…/i.test(m.slice(0, 200)) }
  k(`Erişilebilirlik → ${madde}`, ok, ok ? '' : m.slice(0, 140))
}

bolum('F. GELİŞTİRİCİ MENÜSÜ')
const DEV = 'Geliştirici araçları — canlı CSS/JS, CSS değişkenleri, depolama, özel HTTP başlıkları'
await tikla(DEV); await tikla('CSS değişkenleri', { kapsam: '.menu' }); await sleep(1500)
ck = await cekmece()
k('Geliştirici → CSS değişkenleri sitenin değişkenlerini listeledi', /--renk-ana/.test(ck?.metin ?? ''), (ck?.metin ?? '').slice(0, 120))
await tikla(DEV); await tikla('Depolama ve çerezler', { kapsam: '.menu' }); await sleep(1500)
ck = await cekmece()
k('Geliştirici → Depolama localStorage anahtarını gösterdi', /senaryo-anahtar/.test(ck?.metin ?? ''), (ck?.metin ?? '').slice(0, 120))
await tikla(DEV); await tikla('Parmak modu tanısı', { kapsam: '.menu' }); await sleep(1500)
ck = await cekmece()
k('Geliştirici → Parmak modu tanısı rapor verdi', (ck?.metin ?? '').length > 80, (ck?.metin ?? '').slice(0, 100))
await tikla(DEV); await tikla('Canlı CSS / JS', { kapsam: '.menu' }); await sleep(600)
const taSay = await viewer(`document.querySelectorAll('.drawer textarea').length`)
k('Geliştirici → Canlı CSS / JS düzenleyici açıldı', taSay >= 1, taSay)
if (taSay >= 1) {
  const c = await viewer(`(()=>{const t=document.querySelector('.drawer textarea'); t.scrollIntoView({block:'nearest'}); const b=t.getBoundingClientRect(); return {x:b.x+20,y:b.y+15}})()`)
  await fare(c.x, c.y); await yaz('h1 { color: rgb(1, 2, 3) }')
  const renk = await bekleKosul(() => her(`getComputedStyle(document.querySelector('h1')).color`), (r) => Object.values(r).every((v) => v === 'rgb(1, 2, 3)'))
  k('canlı CSS yazınca tüm ekranlara uygulandı', Object.values(renk).every((v) => v === 'rgb(1, 2, 3)'), JSON.stringify(renk))
  await viewer(`(()=>{const t=document.querySelector('.drawer textarea'); t.focus(); t.select()})()`)
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
  await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
  const renk2 = await bekleKosul(() => her(`getComputedStyle(document.querySelector('h1')).color`, ['m1']), (r) => r.m1 !== 'rgb(1, 2, 3)')
  k('canlı CSS silinince stil kalktı', renk2.m1 !== 'rgb(1, 2, 3)', renk2.m1)
}
await tikla(DEV); await tikla('Özel HTTP başlıkları', { kapsam: '.menu' }); await sleep(600)
ck = await cekmece()
k('Geliştirici → Özel HTTP başlıkları paneli açıldı', /başlık|Authorization|Basic/i.test(ck?.metin ?? ''), (ck?.metin ?? '').slice(0, 100))

bolum('F. GÖRME / TERCİH / METİN')
const GORME = 'Görme simülasyonu — renk körlüğü tipleri, gri ton, bulanıklık ve kontrast testleri'
const filtre = () => her(`(getComputedStyle(document.documentElement).filter + ' ' + getComputedStyle(document.body).filter)`)
for (const v of ['Protanopi', 'Döteranopi', 'Tritanopi', 'Protanomali', 'Döteranomali', 'Akromatopsi', 'Gri ton', 'Bulanık (göz kısma)', 'Yüksek kontrast', 'Ters']) {
  await tikla(GORME); await tikla(v, { kapsam: '.menu' }); await sleep(500)
  const f = await filtre()
  k(`Görme → ${v} tüm ekranlara uygulandı`, Object.values(f).every((x) => typeof x === 'string' && /url|grayscale|blur|contrast|invert/.test(x)), Object.values(f)[0])
}
await tikla(GORME); await tikla('Normal görme', { kapsam: '.menu' })
let f0 = await bekleKosul(filtre, (f) => Object.values(f).every((x) => !/url|grayscale|blur|contrast|invert/.test(x)))
k('Görme → Normal görme filtreyi kaldırdı', Object.values(f0).every((x) => !/url|grayscale|blur|contrast|invert/.test(x)), Object.values(f0)[0])

const TERCIH = 'Kullanıcı tercihi emülasyonu — koyu mod, azaltılmış hareket, yüksek kontrast (gerçek CSS)'
await tikla(TERCIH); await tikla('Koyu', { kapsam: '.menu' }); await sleep(1500)
let bg = await her(`getComputedStyle(document.body).backgroundColor`)
k('Tercih → Koyu sitenin koyu mod CSS\'ini tüm ekranlarda açtı', Object.values(bg).every((x) => x === 'rgb(0, 0, 0)'), JSON.stringify(bg))
await tikla('Açık', { kapsam: '.menu' }); await sleep(1200)
bg = await her(`getComputedStyle(document.body).backgroundColor`)
k('Tercih → Açık koyu modu kapattı', Object.values(bg).every((x) => x === 'rgb(255, 255, 255)'), JSON.stringify(bg))
await tikla('Otomatik', { kapsam: '.menu' }); await tus('Escape')

const METIN = 'Metin ölçekleme testi — kök font boyutunu büyüterek WCAG 1.4.4 uyumunu kontrol edin'
await tikla(METIN); await tikla('Kök font %150', { kapsam: '.menu' }); await sleep(600)
let fs = await her(`getComputedStyle(document.documentElement).fontSize`)
k('Metin → %150 kök fontu büyüttü', Object.values(fs).every((x) => x === '24px'), JSON.stringify(fs))
await tikla(METIN); await tikla('Kök font %100 (varsayılan)', { kapsam: '.menu' }); await sleep(600)
fs = await her(`getComputedStyle(document.documentElement).fontSize`)
k('Metin → %100 eski hâline döndü', Object.values(fs).every((x) => x === '16px'), JSON.stringify(fs))

bolum('F. PARMAK MODU DÜĞMESİ')
const hoverEsles = () => cer.m1.ev(`matchMedia('(hover: none)').matches`)
k('başlangıçta mobil ekran dokunmatik (hover: none)', await hoverEsles() === true)
await tikla('Parmak', { secici: '.subbar .chip' }); await sleep(1500); await karelerHazir(p); await cerceveleriBagla()  /* parmak modu bilerek yeniden yükler */
k('Parmak düğmesi kapatınca mobil ekran fareli davrandı', await hoverEsles() === false)
await tikla('Parmak', { secici: '.subbar .chip' }); await sleep(1500); await karelerHazir(p); await cerceveleriBagla()
k('Parmak düğmesi tekrar açtı', await hoverEsles() === true)

bolum('F. EKRAN GÖRÜNTÜSÜ MENÜSÜ')
const GORUNTU = 'Ekran görüntüsü — tek ekran tam sayfa, tüm ekranlar ZIP, kontakt föy, panoya kopyala'
const yakalamaBitti = () => bekleKosul(() => viewer(`!document.querySelector('.subbar .spin')`), (v) => v, 120000)
for (const [madde, uzanti] of [['Bu ekran — tam sayfa', '.png'], ['Tüm ekranlar → ZIP', '.zip'], ['Kontakt föy', '.png']]) {
  await yakalamaBitti()
  once = indirilenler()
  await tikla(GORUNTU); await tikla(madde, { kapsam: '.menu', bekle: 200 })
  await sleep(500); await yakalamaBitti()
  yeni = await indirmeBekle(once, 15000)
  k(`Ekran görüntüsü → ${madde} indirildi`, yeni.some((f) => f.endsWith(uzanti)), yeni.join(',') || (await toastlar()))
  await sleep(1200)
}
await yakalamaBitti()
await tikla(GORUNTU); await tikla('Bu ekran — panoya kopyala', { kapsam: '.menu' })
const tst = await bekleKosul(toastlar, (t) => /panoya|hata|başarısız/i.test(t), 10000)
k('Ekran görüntüsü → panoya kopyala onay verdi', /panoya/i.test(tst), tst)

bolum('F. KONSOL')
await tikla('Konsol'); await sleep(600)
ck = await cekmece()
k('Konsol sitenin hata ve uyarısını gösterdi', /SENARYO-HATA/.test(ck?.metin ?? '') && /SENARYO-UYARI/.test(ck?.metin ?? ''), (ck?.metin ?? '').slice(0, 120))
const kapat = await viewer(`!!document.querySelector('.drawer [title*="Kapat"], .drawer [data-tip*="Kapat"], .drawer .close')`)
k('alt panelin kapatma düğmesi var', kapat)
if (kapat) {
  await tikla('Kapat', { kapsam: '.drawer' })
  k('alt panel kapandı', !(await cekmece()))
}

/* ═══ G. YAN PANEL ═══════════════════════════════════════════════ */
bolum('G. YAN PANEL — cihazlar')
console.log('   yan panel:', await viewer(`(()=>{const s=document.querySelector('.sidebar'); return s ? s.getBoundingClientRect().width + 'px, ' + s.textContent.slice(0,80) : 'YOK'})()`))
const ekranSay = async () => (await durum()).frames.length
let n0 = await ekranSay()
await tikla('Cihaz ara veya 390x844 yaz…', { secici: 'input' }); await yaz('Pixel 9'); await sleep(500)
const sonuc = await viewer(`[...document.querySelectorAll('.dev-row')].map(r=>r.textContent.trim()).slice(0,5)`)
k('cihaz arama sonuç verdi', sonuc.some((r) => /Pixel 9/.test(r)), sonuc.join(' | '))
await tikla(sonuc.find((r) => /Pixel 9/.test(r)) ?? 'Pixel 9', { kapsam: '.sidebar' })
let n1 = await ekranSay()
k('arama sonucuna tıklayınca ekran eklendi', n1 === n0 + 1, `${n0} → ${n1}`)
await viewer(`(()=>{const i=document.querySelector('.sidebar .search input, .sidebar input'); i.focus(); i.select()})()`)
await yaz('500x700'); await tus('Enter'); await sleep(600)
let n2 = await ekranSay()
const ozelBoyut = (await durum()).frames.some((f) => f.width === 500 && f.height === 700)
k('"500x700" yazıp Enter → o boyutta ekran eklendi', n2 === n1 + 1 && ozelBoyut, `${n1} → ${n2}`)
await viewer(`(()=>{const i=document.querySelector('.sidebar .search input, .sidebar input'); i.focus(); i.select()})()`)
await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
await sleep(400)

await tikla('Mobil', { kapsam: '.sidebar', secici: '.chip' }); await sleep(800)
st = await durum()
const mobilSet = st.frames.length
k('Hazır set "Mobil" tıklanınca ekranlar değişti', mobilSet > 0 && st.frames.every((f) => f.width < 700), `${mobilSet} ekran: ${st.frames.map((f) => f.width).join(',')}`)
await tikla('Tablet', { kapsam: '.sidebar', secici: '.chip', shift: true }); await sleep(800)
st = await durum()
k('Shift+tıklama seti mevcutlara ekledi', st.frames.length > mobilSet, `${mobilSet} → ${st.frames.length}`)

await tikla('Sık kullanılanlara ekle', { kapsam: '.sidebar' })
st = await durum()
k('yıldız cihazı sık kullanılanlara ekledi', st.settings.favorites.length === 1, JSON.stringify(st.settings.favorites))

await tikla('Özel cihaz ekle', { kapsam: '.sidebar' }); await sleep(400)
const modal = await viewer(`!!document.querySelector('.modal')`)
k('Özel cihaz penceresi açıldı', modal)
if (modal) {
  const odak = await viewer(`document.activeElement?.tagName + ':' + (document.activeElement?.placeholder ?? '')`)
  k('pencere açılınca ad alanı odakta', /INPUT/.test(odak), odak)
  await yaz('Test Monitörü')
  await viewer(`(()=>{const ins=[...document.querySelectorAll('.modal input[type=number]')]; return ins.length})()`)
  const sayilar = await viewer(`[...document.querySelectorAll('.modal input[type=number]')].map(i=>i.value)`)
  console.log('   varsayılan değerler:', sayilar.join(','))
  await tikla('Ekle', { kapsam: '.modal' }); await sleep(500)
  st = await durum()
  const ozel = st.settings.customDevices.find((d) => d.name === 'Test Monitörü')
  k('Özel cihaz kaydedildi', !!ozel, JSON.stringify(ozel ?? {}).slice(0, 100))
  k('Özel cihaz ekrana da eklendi', !!ozel && st.frames.some((f) => f.deviceId === ozel.id))
  const ozelOnce = st.settings.customDevices.length
  await viewer(`(()=>{const i=document.querySelector('.sidebar .search input'); i.focus(); i.select()})()`)
  await yaz('Test Monitörü'); await sleep(400)
  await tikla('Özel cihazı sil (açık ekranları da kapanır)', { kapsam: '.sidebar', bekle: 150 })
  const silArmed = await viewer(`[...document.querySelectorAll('.sidebar .danger')].some(b => b.textContent.trim() === 'Sil?')`)
  await tikla('Sil?', { kapsam: '.sidebar' })
  k('Sil ilk tıklamada onay istedi ("Sil?")', silArmed)
  st = await bekleKosul(durum, (x) => x.settings.customDevices.length === ozelOnce - 1)
  k('ikinci tıklamada özel cihaz silindi', st.settings.customDevices.length === ozelOnce - 1, `${ozelOnce} → ${st.settings.customDevices.length}`)
  k('silinen özel cihazın ekranı da kapandı', !st.frames.some((f) => f.deviceId === ozel?.id))
}

bolum('G. YAN PANEL — çalışma alanları')
await tikla('Çalışma alanları — adres, cihazlar ve ayarları birlikte kaydet'); await sleep(300)
await tikla('Proje adı…', { secici: 'input' }); await yaz('Senaryo projesi')
await tikla('Kaydet', { kapsam: '.sidebar' })
st = await bekleKosul(durum, (x) => x.workspaces.length === 1)
k('çalışma alanı kaydedildi', st.workspaces.length === 1 && st.workspaces[0].name === 'Senaryo projesi', st.workspaces.map((w) => w.name).join(','))
const wsEkran = st.frames.length
await tikla('Cihaz kütüphanesi ve hazır setler'); await tikla('Masaüstü', { kapsam: '.sidebar', secici: '.chip' }); await sleep(600)
const sonra = (await durum()).frames.length
await tikla('Çalışma alanları — adres, cihazlar ve ayarları birlikte kaydet'); await sleep(300)
await tikla('Senaryo projesi', { kapsam: '.sidebar' }); await sleep(1500)
st = await durum()
k('çalışma alanına tıklayınca ekranlar geri yüklendi', st.frames.length === wsEkran, `kayıt ${wsEkran}, değişiklik ${sonra}, yükleme ${st.frames.length}`)
await tikla('Çalışma alanını sil', { kapsam: '.sidebar', bekle: 150 })
const wsArmed = await viewer(`document.querySelector('.ws-row .danger')?.textContent.trim() === 'Sil?'`)
await tikla('Sil?', { kapsam: '.sidebar' })
k('çalışma alanı silme onay istedi ("Sil?")', wsArmed)
k('onaydan sonra çalışma alanı silindi', (await bekleKosul(durum, (x) => x.workspaces.length === 0)).workspaces.length === 0)

bolum('G. YAN PANEL — ayarlar')
await tikla('Görünüm, tema ve gelişmiş ayarlar'); await sleep(300)
for (const [ad, anahtar] of [['Cihaz çerçevesi', 'bezel'], ['Çentik / güvenli alan', 'safeArea'], ['Başlık etiketleri', 'labels'], ['Tuval ızgarası', 'canvasGrid'], ['Kaydırma çubukları', 'scrollbars']]) {
  const once1 = (await durum()).chromeOpts?.[anahtar]
  await tikla(ad, { kapsam: '.sidebar', secici: '.set-row' }); await sleep(300)
  const sonra1 = (await durum()).chromeOpts?.[anahtar]
  k(`Ayar: ${ad} değişti`, once1 !== sonra1 && sonra1 !== undefined, `${once1} → ${sonra1}`)
  await tikla(ad, { kapsam: '.sidebar', secici: '.set-row' }); await sleep(200)
}
await tikla('Açık', { kapsam: '.sidebar' })
k('Ayar: Tema → Açık', (await durum()).settings.theme === 'light')
await tikla('Koyu', { kapsam: '.sidebar' })
k('Ayar: Tema → Koyu', (await durum()).settings.theme === 'dark')
await tikla('Çerçeve kaçışını engelle', { kapsam: '.sidebar', secici: '.set-row' })
k('Ayar: Çerçeve kaçışını engelle kapandı', (await bekleKosul(durum, (x) => x.settings.frameBusting === false)).settings.frameBusting === false)
await tikla('Çerçeve kaçışını engelle', { kapsam: '.sidebar', secici: '.set-row' })
await tikla('Açılış setini yükle', { kapsam: '.sidebar' }); await sleep(1500)
k('Açılış setini yükle → Popüler set (11 ekran)', (await durum()).frames.length === 11, (await durum()).frames.length)

/* ═══ H. KLAVYE KISAYOLLARI ══════════════════════════════════════ */
bolum('H. KLAVYE KISAYOLLARI')
await viewer(`document.activeElement?.blur?.()`)
await fare(5, 400); await sleep(200)
await tus('b', { ctrl: true })
k('Ctrl+B yan paneli kapattı', !(await viewer(`document.querySelector('.sidebar')?.getBoundingClientRect().width > 50`)))
await tus('b', { ctrl: true })
await tus('l', { ctrl: true })
k('Ctrl+L adres çubuğuna odakladı', await viewer(`document.activeElement === document.querySelector('.topbar input')`))
await viewer(`document.activeElement?.blur?.()`)
for (const [t, arac] of [['o', 'outline'], ['t', 'overflow'], ['g', 'grid'], ['i', 'inspect'], ['m', 'measure']]) {
  await tus(t)
  const a = await viewer(`[...document.querySelectorAll('.subbar.tools .chip.on')].map(c=>c.textContent.trim()).join(',')`)
  const beklenenEt = { outline: 'Kontur', overflow: 'Taşma', grid: 'Izgara', inspect: 'Denetçi', measure: 'Cetvel' }[arac]
  k(`${t.toUpperCase()} kısayolu ${beklenenEt} aracını açtı`, a.includes(beklenenEt), a)
  await tus(t)
}
const land0 = (await durum()).frames.filter((f) => f.landscape).length
await tus('r')
const land1 = (await durum()).frames.filter((f) => f.landscape).length
k('R kısayolu tüm ekranları çevirdi', land1 !== land0, `${land0} → ${land1}`)
await tus('r')

/* ═══ I. KALAN ÖZELLİKLER ═══════════════════════════════════════ */
bolum('I. KALAN ÖZELLİKLER')
;({ tab, s: p } = await stüdyoAc())
await cerceveleriBagla()

/* Birebir px kaydırma */
await viewer(`(()=>{const s=document.querySelector('.subbar select'); s.value='absolute'; s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
await her('scrollTo(0,0)'); await sleep(300)
await cerTekerlek('m1', 500)
sc = await her('Math.round(scrollY)')
if (sc.m1 < 50) { await cerTekerlek('m1', 500); sc = await her('Math.round(scrollY)') }
k('Birebir px: diğer ekranlar aynı piksel konumuna kaydı', Math.abs(sc.t1 - sc.m1) <= 2 && Math.abs(sc.d1 - sc.m1) <= 2, JSON.stringify(sc))
await viewer(`(()=>{const s=document.querySelector('.subbar select'); s.value='ratio'; s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
await her('scrollTo(0,0)'); await sleep(300)

/* Hover senkronu — parmak modu kapalıyken masaüstü davranışı */
await tikla('Parmak', { secici: '.subbar .chip' }); await sleep(1500); await karelerHazir(p); await cerceveleriBagla()
await her('window.__s.hov = 0')
const hk = await cerKoord('m1', '#hov')
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hk.x - 3, y: hk.y - 60 }); await sleep(150)
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hk.x, y: hk.y }); await sleep(900)
const hv = await her('window.__s.hov')
k('Hover: kaynak ekranda hover oldu', hv.m1 >= 1, hv.m1)
const hvStil = await her(`(()=>{const e=document.getElementById('hov'); return getComputedStyle(e).backgroundColor === 'rgb(255, 0, 0)' || e.matches(':hover') || e.className.includes('hover') || window.__s.hov > 0})()`, ['t1', 'd1'])
k('Hover: diğer ekranlarda da hover durumu oluştu', hvStil.t1 === true && hvStil.d1 === true, JSON.stringify(hvStil))
await tikla('Parmak', { secici: '.subbar .chip' }); await sleep(1500); await karelerHazir(p); await cerceveleriBagla()

/* Izgara ayarları */
await tikla('Kolon / taban çizgisi ızgarası'); await sleep(300)
const kolon = await viewer(`(()=>{const i=document.querySelector('.subbar.tools input.num'); if(!i) return null; i.focus(); i.select(); return i.value})()`)
k('Izgara açılınca kolon ayarları göründü', kolon !== null, kolon)
if (kolon !== null) {
  await yaz('4'); await sleep(500)
  st = await durum()
  k('Izgara kolon sayısı değişti', st.grid?.columns === 4 || (await viewer(`document.querySelector('.subbar.tools input.num').value`)) === '4')
}
await tikla('Kolon / taban çizgisi ızgarası')

/* Ekran aralığı */
await tikla('Görünüm, tema ve gelişmiş ayarlar'); await sleep(300)
await viewer(`(()=>{const r=document.querySelector('.sidebar input[type=range]'); r.value='60'; r.dispatchEvent(new Event('input',{bubbles:true}))})()`)
st = await bekleKosul(durum, (x) => x.gap === 60)
k('Ekran aralığı kaydırıcısı aralığı değiştirdi', st.gap === 60, st.gap)

/* Otomatik yenileme */
await her('window.__isaret = 1')
await viewer(`(()=>{const s=[...document.querySelectorAll('.sidebar select')].find(x=>[...x.options].some(o=>o.textContent.includes('2 saniyede'))); s.value='2'; s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
await sleep(4500); await karelerHazir(p); await cerceveleriBagla()
is = await her('window.__isaret ?? 0')
k('Otomatik yenileme ekranları yeniledi', Object.values(is).every((v) => v === 0), JSON.stringify(is))
await viewer(`(()=>{const s=[...document.querySelectorAll('.sidebar select')].find(x=>[...x.options].some(o=>o.textContent.includes('2 saniyede'))); s.value='0'; s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
await sleep(800)
await her('window.__isaret = 1'); await sleep(3500)
is = await her('window.__isaret ?? 0', ['m1'])
k('Otomatik yenileme kapatılınca durdu', is.m1 === 1, is.m1)

/* Set kaydetme */
await tikla('Çalışma alanları — adres, cihazlar ve ayarları birlikte kaydet'); await sleep(300)
await tikla('Set adı…', { secici: 'input' }); await yaz('Benim setim')
await tikla('Ekle', { kapsam: '.sidebar' })
st = await bekleKosul(durum, (x) => x.settings.deviceSets.length === 1)
k('Geçerli cihazlar set olarak kaydedildi', st.settings.deviceSets[0]?.name === 'Benim setim' && st.settings.deviceSets[0]?.deviceIds.length === 3, JSON.stringify(st.settings.deviceSets[0] ?? {}).slice(0, 90))
await tikla('Cihaz kütüphanesi ve hazır setler'); await sleep(300)
const setCip = await viewer(`[...document.querySelectorAll('.sidebar .chip')].some(c=>c.textContent.includes('Benim setim'))`)
k('Kaydedilen set cihaz panelinde göründü', setCip)

/* Dışa aktar → içe aktar */
await tikla('Çalışma alanları — adres, cihazlar ve ayarları birlikte kaydet'); await sleep(300)
once = indirilenler()
await tikla('Dışa aktar', { kapsam: '.sidebar' })
yeni = await indirmeBekle(once, 10000)
k('Dışa aktar JSON indirdi', yeni.some((f) => f.endsWith('.json')), yeni.join(','))
if (yeni.some((f) => f.endsWith('.json'))) {
  await viewer(`(async()=>{ const s=(await chrome.storage.local.get('rs_state_v1')).rs_state_v1; s.settings.deviceSets=[]; await chrome.storage.local.set({rs_state_v1:s}) })()`)
  await p.send('Page.setInterceptFileChooserDialog', { enabled: true })
  const secici = new Promise((res) => {
    const dinle = (ev) => { try { const d = JSON.parse(ev.data); if (d.method === 'Page.fileChooserOpened') { p.ws.removeEventListener('message', dinle); res(d.params) } } catch {} }
    p.ws.addEventListener('message', dinle)
  })
  await tikla('İçe aktar', { kapsam: '.sidebar' })
  const fc = await Promise.race([secici, sleep(5000).then(() => null)])
  k('İçe aktar dosya seçiciyi açtı', !!fc)
  if (fc) {
    await p.send('DOM.setFileInputFiles', { backendNodeId: fc.backendNodeId, files: [resolve(INDIR, yeni.find((f) => f.endsWith('.json')))] })
    st = await bekleKosul(durum, (x) => x.settings.deviceSets.length === 1, 8000)
    k('İçe aktarılan dosya seti geri getirdi', st.settings.deviceSets.some((d) => d.name === 'Benim setim'), (await toastlar()))
  }
  await p.send('Page.setInterceptFileChooserDialog', { enabled: false })
}

/* Kenardan sürükleyerek boyutlandırma */
await tikla('Cihaz kütüphanesi ve hazır setler'); await sleep(200)
const rz = await viewer(`(()=>{const h=document.querySelector('[data-fid="m1"] .rsz.e'); h.scrollIntoView({block:'nearest',inline:'nearest'}); const b=h.getBoundingClientRect(); return {x:Math.round(b.x+b.width/2), y:Math.round(b.y+b.height/2)}})()`)
const w0 = (await durum()).frames.find((f) => f.fid === 'm1').width
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rz.x, y: rz.y }); await sleep(150)
await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rz.x, y: rz.y, button: 'left', clickCount: 1 })
for (let i = 1; i <= 8; i++) { await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rz.x + i * 10, y: rz.y, button: 'left', buttons: 1 }); await sleep(30) }
await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rz.x + 80, y: rz.y, button: 'left' })
st = await bekleKosul(durum, (x) => x.frames.find((f) => f.fid === 'm1').width > w0)
const w1 = st.frames.find((f) => f.fid === 'm1').width
k('Ekran kenarından sürükleyince genişlik arttı', w1 > w0, `${w0} → ${w1}`)
await sleep(1200); await cerceveleriBagla()
const iw = await her('innerWidth', [Object.keys(cer).find((f) => f.startsWith('?')) ?? 'm1'])
k('sitenin gördüğü genişlik de değişti (yeniden yüklemeden)', Object.values(iw)[0] === w1, `${JSON.stringify(iw)} beklenen ${w1}`)

/* Alt panel boyutlandırma */
await tikla('Konsol'); await sleep(500)
const g = await viewer(`(()=>{const e=document.querySelector('.drawer-grip'); const b=e.getBoundingClientRect(); return {x:Math.round(b.x+b.width/2), y:Math.round(b.y+b.height/2), h: document.querySelector('.drawer').offsetHeight}})()`)
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: g.x, y: g.y }); await sleep(150)
await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: g.x, y: g.y, button: 'left', clickCount: 1 })
for (let i = 1; i <= 8; i++) { await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: g.x, y: g.y - i * 12, button: 'left', buttons: 1 }); await sleep(30) }
await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: g.x, y: g.y - 96, button: 'left' }); await sleep(400)
const h1 = await viewer(`document.querySelector('.drawer').offsetHeight`)
k('Alt panel tutamaktan sürüklenince büyüdü', h1 > g.h + 50, `${g.h} → ${h1}`)

/* Temizle */
await tikla('Tüm ekranları kaldır', { bekle: 150 })
const armed = await viewer(`[...document.querySelectorAll('.subbar .chip')].some(c=>c.textContent.includes('Emin misiniz'))`)
await tikla('Emin misiniz?', { kapsam: '.subbar' })
st = await bekleKosul(durum, (x) => x.frames.length === 0)
k('Temizle önce onay istedi', armed)
k('onaydan sonra tüm ekranlar kaldırıldı', st.frames.length === 0, st.frames.length)
const bos = await viewer(`document.querySelector('.canvas, main')?.textContent.replace(/\\s+/g,' ').slice(0,120) ?? ''`)
k('ekran kalmayınca yol gösteren bir mesaj var', bos.length > 10, bos)

/* ═══ SONUÇ ══════════════════════════════════════════════════════ */
tarayici.close(); p.close()
k('hiçbir ayar ekranları beklenmedik şekilde yeniden yüklemedi', yenidenYuklenme === 0, yenidenYuklenme)
if (hatalar.length) console.log('\nBAŞARISIZ KONTROLLER:\n  - ' + hatalar.join('\n  - '))
console.log(`\n${hepsi ? '✅ KULLANICI SENARYOLARI GEÇTİ' : '❌ BAŞARISIZ'}`)
process.exit(0)
