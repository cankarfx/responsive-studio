/**
 * DURUM ÇUBUĞU VE GÜVENLİ ALAN — telefon ekranlarında saat/pil çubuğu çizilir;
 * sıradan siteler çubuğun ALTINDAN başlar (gerçek Safari gibi), `viewport-fit=cover`
 * siteler altına uzanır ve `env(safe-area-inset-*)` cihazın gerçek değerini alır
 * (satır içi, geç eklenen, iç içe ve cross-origin stylesheet'lerde de).
 */
import { Session, sleep, karelerHazir } from './cdp.mjs'

const EXT = 'ocnniomdddfffmfbpocmhdjbdmpnkhjn'
let hepsi = true
const k = (ad, c, ek = '') => { if (!c) hepsi = false; console.log(` ${c ? '✓' : '✗'} ${ad}${ek !== '' ? ' — ' + (typeof ek === 'string' ? ek : JSON.stringify(ek)) : ''}`) }
const liste = async () => (await fetch('http://127.0.0.1:9222/json/list')).json()
const bekleKosul = async (fn, kosul, ms = 5000) => {
  const bas = Date.now(); let v
  do { v = await fn(); if (kosul(v)) return v; await sleep(200) } while (Date.now() - bas < ms)
  return v
}

for (const t of await liste()) if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
await sleep(1000)

const cihaz = (fid, deviceId, width, height) => ({ fid, deviceId, width, height, dpr: 1, landscape: false, browser: 'chrome', zoom: null, hidden: false, colorScheme: 'auto' })
const DURUM = {
  frames: [cihaz('i1', 'iphone-17-pro', 402, 874), cihaz('g1', 'galaxy-s25', 360, 780), cihaz('m1', 'win-laptop-hd', 1366, 608)],
  layout: 'grid', zoom: 'fit', gap: 24, workspaces: [], panel: 'settings',
  sync: { scroll: true, scrollMode: 'ratio', click: true, input: true, hover: true, navigation: true, soloFid: null },
  settings: { theme: 'dark', startupSet: 'set-populer', loadStagger: 0, touchMode: true, customDevices: [], deviceSets: [], favorites: [], customHeaders: [] },
}
async function swSession() {
  for (let i = 0; i < 2; i++) {
    const sw = (await liste()).find((t) => t.type === 'service_worker' && t.url.includes(EXT))
    if (sw) { const s = new Session(sw.webSocketDebuggerUrl); await s.connect(); return s }
    const u = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/manifest.json`)}`, { method: 'PUT' })).json()
    await sleep(1000); await fetch(`http://127.0.0.1:9222/json/close/${u.id}`)
  }
  throw new Error('servis çalışanına bağlanılamadı')
}
const sw = await swSession()
await sw.eval(`chrome.storage.local.clear().then(() => chrome.storage.local.set({ rs_state_v1: ${JSON.stringify(DURUM)} }))`)

const tarayici = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl)
await tarayici.connect()

async function studyo(site) {
  const tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent(site)}`)}`, { method: 'PUT' })).json()
  await sleep(1200)
  const v = new Session(tab.webSocketDebuggerUrl); await v.connect(); await v.send('Runtime.enable')
  await karelerHazir(v); await sleep(1500)
  return { tab, v }
}
/** Çerçevedeki sayfada ifade çalıştır — çerçeve stüdyodaki fid'den bulunur */
async function kare(v, fid) {
  const genislik = await v.eval(`document.querySelector('[data-fid="${fid}"] iframe').width`)
  const { targetInfos } = await tarayici.send('Target.getTargets')
  const adaylar = targetInfos.filter((x) => x.type === 'iframe' && x.url.includes('localhost:8899'))
  for (const t of adaylar) {
    const { sessionId } = await tarayici.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
    const ev = (expr) => new Promise((res, rej) => {
      const id = ++tarayici.id; tarayici.pending.set(id, { res, rej })
      tarayici.ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true }, sessionId }))
    }).then((r) => r.result?.value)
    if (String(await ev('innerWidth')) === String(genislik)) return ev
  }
  throw new Error('çerçeve bulunamadı: ' + fid)
}
const cubuk = (v, fid) => v.eval(`(()=>{const f=document.querySelector('[data-fid="${fid}"]'); const s=f.querySelector('.statusbar');
  const ifr=f.querySelector('iframe'); const sc=f.querySelector('.frame-scaler');
  return s ? { var: true, tur: s.dataset.rsStatusbar, bg: getComputedStyle(s).backgroundColor, renk: getComputedStyle(s).color,
    saat: s.textContent.trim(), yuk: s.getBoundingClientRect().height, ifrH: +ifr.height, ust: parseFloat(sc.style.top)||0 }
    : { var: false, ifrH: +ifr.height, ust: parseFloat(sc.style.top)||0 } })()`)
const ayar = (v) => v.eval(`(()=>{const r=[...document.querySelectorAll('.sidebar .set-row')].find(x=>x.textContent.includes('Durum çubuğu / güvenli alan')); if(!r) return false; r.click(); return true})()`)

/* ═══ 1. Sıradan site ═══ */
console.log('\n── Sıradan site: çubuğun altından başlar ──')
let { tab, v } = await studyo('http://localhost:8899/duz.html')
let iC = await bekleKosul(() => cubuk(v, 'i1'), (x) => x.var && x.bg === 'rgb(255, 233, 214)')
k('iPhone 17 Pro: durum çubuğu çizildi, saat 9:41', iC.var && iC.saat === '9:41', iC)
k('çubuk sitenin üst rengiyle boyandı, yazı siyah', iC.bg === 'rgb(255, 233, 214)' && iC.renk === 'rgb(0, 0, 0)', `${iC.bg} / ${iC.renk}`)
k('site çubuğun altından başlıyor (874 − 62 = 812)', iC.ifrH === 812 && iC.ust > 0, iC)
let ev = await kare(v, 'i1')
let o = await ev('olc()')
k('sayfanın innerHeight 812, sabit üst menü en üstte (0)', o.h === 812 && o.bas === 0, o)
k('viewport-fit=cover değil → env(safe-area-inset-top) 0', o.ust === 0, o)
const gC = await cubuk(v, 'g1')
k('Galaxy S25: Android çubuğu, site 24 px aşağıda', gC.var && gC.ifrH === 780 - 24, gC)
const mC = await cubuk(v, 'm1')
k('masaüstünde durum çubuğu yok, yükseklik değişmedi', !mC.var && mC.ifrH === 608 && mC.ust === 0, mC)
const ada = await v.eval(`!!document.querySelector('[data-fid="i1"] .island')`)
k('Dynamic Island çubuğun üstünde duruyor', ada)

console.log('\n── Ayar kapatılınca eski hâl ──')
k('ayar satırı bulundu', await ayar(v))
let kapali = await bekleKosul(() => cubuk(v, 'i1'), (x) => !x.var)
k('çubuk kalktı, site tam yükseklikte (874)', !kapali.var && kapali.ifrH === 874 && kapali.ust === 0, kapali)
k('sayfa yeniden yüklenmeden innerHeight 874 oldu', (await bekleKosul(() => ev('innerHeight'), (h) => h === 874)) === 874)
await ayar(v)
await bekleKosul(() => cubuk(v, 'i1'), (x) => x.var)
v.close(); await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)

/* ═══ 2. viewport-fit=cover ═══ */
console.log('\n── viewport-fit=cover: içerik altına uzanır, env() gerçek değer ──')
;({ tab, v } = await studyo('http://localhost:8899/kapsam.html'))
iC = await bekleKosul(() => cubuk(v, 'i1'), (x) => x.var && x.tur === 'cover')
k('çubuk saydam, site tam yükseklikte (874)', iC.tur === 'cover' && iC.bg === 'rgba(0, 0, 0, 0)' && iC.ifrH === 874 && iC.ust === 0, iC)
k('koyu theme-color → yazı beyaz', iC.renk === 'rgb(255, 255, 255)', iC.renk)
ev = await kare(v, 'i1')
o = await bekleKosul(() => ev('olc()'), (x) => x.ust === 62 && x.alt === 34 && x.gec === 34)
k('aynı-origin kural: üst 62', o.ust === 62, o)
k('@media içindeki calc(): 63', o.ic === 63, o)
k('satır içi style: alt 34', o.satir === 34, o)
k('cross-origin stylesheet (max()): alt 34', o.alt === 34, o)
k('sonradan eklenen stil (CSS değişkeni): 34', o.gec === 34, o)
k('dikeyde sol/sağ 0', o.sol === 0 && o.sag === 0, o)
const g = await kare(v, 'g1')
k('Galaxy S25: üst 24', (await bekleKosul(() => g('olc()'), (x) => x.ust === 24)).ust === 24)
const m = await kare(v, 'm1')
const mo = await m('olc()')
k('masaüstünde env() 0 (yedek değer değil, gerçek Chrome gibi)', mo.ust === 0 && mo.alt === 4, mo)

console.log('\n── Yatay çevirme ──')
await v.eval(`document.querySelector('[data-fid="i1"] button[title="Çevir (dikey ↔ yatay)"]').click()`)
await sleep(800)
const yC = await cubuk(v, 'i1')
k('yatayda durum çubuğu yok', !yC.var, yC)
ev = await kare(v, 'i1')
o = await bekleKosul(() => ev('olc()'), (x) => x.sol === 62)
k('yatayda ada yana geçti: sol/sağ 62, üst 0, alt 21', o.sol === 62 && o.sag === 62 && o.ust === 0 && o.alt === 21, o)
await v.eval(`document.querySelector('[data-fid="i1"] button[title="Çevir (dikey ↔ yatay)"]').click()`)
await sleep(800)

console.log('\n── Ayar kapalı ──')
await ayar(v)
ev = await kare(v, 'i1')
o = await bekleKosul(() => ev('olc()'), (x) => x.ust === 0)
k('env() değerleri 0\'a döndü (cross-origin yedek 4 px)', o.ust === 0 && o.satir === 0 && o.alt === 4 && o.gec === 0, o)
await ayar(v)
o = await bekleKosul(() => ev('olc()'), (x) => x.ust === 62)
k('yeniden açılınca geri geldi', o.ust === 62 && o.alt === 34, o)

console.log('\n── Yeniden yükleme ──')
await v.eval(`document.querySelector('[data-fid="i1"] button[title="Bu ekranı yenile"]').click()`)
await sleep(2500)
ev = await kare(v, 'i1')
o = await bekleKosul(() => ev('olc()'), (x) => x.ust === 62 && x.alt === 34)
k('yenilenen sayfada değerler korunur', o.ust === 62 && o.alt === 34, o)

/* Normal sekmede hiçbir şey değişmez */
const nt = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent('http://localhost:8899/kapsam.html')}`, { method: 'PUT' })).json()
await sleep(1500)
const n = new Session(nt.webSocketDebuggerUrl); await n.connect(); await n.send('Runtime.enable')
const no = await n.eval('olc()')
k('normal sekmede env() dokunulmadı (0)', no.ust === 0 && no.alt === 4, no)
n.close(); await fetch(`http://127.0.0.1:9222/json/close/${nt.id}`)

v.close(); await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)
tarayici.close(); sw.close()
console.log(hepsi ? '\n✅ GEÇTİ' : '\n❌ BAŞARISIZ')
process.exit(hepsi ? 0 : 1)
