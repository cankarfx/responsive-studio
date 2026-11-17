/**
 * İKİ STÜDYO SEKMESİ — aynı anda açık iki stüdyo birbirinin ekran düzenini ezmemeli.
 * Kayıt dilim dilim yazılır (her dilimde son DEĞİŞTİREN kazanır, son kapanan değil);
 * yenilenen sekme kendi düzenine döner; ayarlar sekmeler arasında taşınır.
 */
import { Session, sleep, karelerHazir } from './cdp.mjs'

const EXT = 'ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const SITE = 'http://localhost:8899/senaryo.html'
let hepsi = true
const k = (ad, c, ek = '') => { if (!c) hepsi = false; console.log(` ${c ? '✓' : '✗'} ${ad}${ek !== '' ? ' — ' + ek : ''}`) }
const liste = async () => (await fetch('http://127.0.0.1:9222/json/list')).json()

for (const t of await liste()) if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
await sleep(1500)

const cihaz = (fid, deviceId, width, height) => ({ fid, deviceId, width, height, dpr: 1, landscape: false, browser: 'chrome', zoom: null, hidden: false, colorScheme: 'auto' })
const DURUM = {
  frames: [cihaz('a1', 'iphone-16', 393, 852), cihaz('a2', 'ipad-air-11', 820, 1180), cihaz('a3', 'win-laptop-hd', 1366, 608)],
  layout: 'grid', zoom: 'fit', gap: 24, workspaces: [], panel: 'devices',
  sync: { scroll: true, scrollMode: 'ratio', click: true, input: true, hover: true, navigation: true, soloFid: null },
  settings: { theme: 'dark', startupSet: 'set-populer', loadStagger: 0, touchMode: true, customDevices: [], deviceSets: [], favorites: [], customHeaders: [] },
}

/* Durumu arka plan servisinden yaz (servis uykudaysa uyandırmak için önce bir sekme açılır) */
async function swSession() {
  for (let i = 0; i < 2; i++) {
    const sw = (await liste()).find((t) => t.type === 'service_worker' && t.url.includes(EXT))
    if (sw) { const s = new Session(sw.webSocketDebuggerUrl); await s.connect(); return s }
    const t = await (await fetch(`http://127.0.0.1:9222/json/new?about:blank`, { method: 'PUT' })).json()
    await sleep(500); await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
    const u = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/manifest.json`)}`, { method: 'PUT' })).json()
    await sleep(1000); await fetch(`http://127.0.0.1:9222/json/close/${u.id}`)
  }
  throw new Error('servis çalışanına bağlanılamadı')
}
const sw = await swSession()
await sw.eval(`chrome.storage.local.clear().then(() => chrome.storage.local.set({ rs_state_v1: ${JSON.stringify(DURUM)} }))`)
/* Arka plandaki sekmenin zamanlayıcıları Chrome tarafından ~1 sn'ye kısılır */
const kayit = async () => { await sleep(2000); return sw.eval(`chrome.storage.local.get('rs_state_v1').then((g) => g.rs_state_v1)`) }

async function stüdyo() {
  const tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent(SITE)}`)}`, { method: 'PUT' })).json()
  await sleep(1200)
  const s = new Session(tab.webSocketDebuggerUrl); await s.connect(); await s.send('Runtime.enable'); await s.send('Page.enable')
  await karelerHazir(s); await sleep(1200)
  return { tab, s }
}
const ekranSayisi = (s) => s.eval(`document.querySelectorAll('.frame').length`)
const dugme = (s, title, i = 0) => s.eval(`(()=>{const b=[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('title')??b.getAttribute('data-tip'))===${JSON.stringify(title)})[${i}]; if(!b) return false; b.click(); return true})()`)

console.log('\n── İki sekme aynı anda ──')
const A = await stüdyo()
const B = await stüdyo()
k('A ve B 3 ekranla açıldı', (await ekranSayisi(A.s)) === 3 && (await ekranSayisi(B.s)) === 3)

k('A: bir ekran kaldırıldı', await dugme(A.s, 'Kaldır'))
await sleep(300)
let r = await kayit()
k('kayıtta 2 ekran (A)', r.frames.length === 2, r.frames.length)

k('B: yerleşim "Tek sütun" yapıldı', await dugme(B.s, 'Tek sütun'))
r = await kayit()
k('kayıtta yerleşim tek sütun (B)', r.layout === 'column', r.layout)
k('B\'nin kaydı A\'nın ekran düzenini ezmedi (hâlâ 2 ekran)', r.frames.length === 2, r.frames.length)

console.log('\n── Yenilenen sekme kendi düzenine döner ──')
await B.s.send('Page.reload'); await sleep(1500); await karelerHazir(B.s); await sleep(1000)
k('B yenilenince kendi 3 ekranı geri geldi (A\'nınkine değil)', (await ekranSayisi(B.s)) === 3, await ekranSayisi(B.s))
k('B yenilenince kendi yerleşimi (tek sütun)', await B.s.eval(`!!document.querySelector('button.on[title="Tek sütun"], button.on[data-tip="Tek sütun"]')`))
r = await kayit()
k('B\'nin yenilenmesi ortak kaydı değiştirmedi', r.frames.length === 2 && r.layout === 'column', `${r.frames.length} / ${r.layout}`)

console.log('\n── Ayarlar sekmeler arasında taşınır ──')
k('A: tema düğmesi', await dugme(A.s, 'Temayı değiştir'))
r = await kayit()
const yeniTema = r.settings.theme
k('kayıtta tema değişti', yeniTema === 'light', yeniTema)
k('B ayarı aldı', (await B.s.eval(`document.documentElement.dataset.theme`)) === 'light')
k('B: yerleşim "Izgara"', await dugme(B.s, 'Izgara'))
r = await kayit()
k('B\'nin kaydı A\'nın tema ayarını geri almadı', r.settings.theme === yeniTema, r.settings.theme)

console.log('\n── Kapanış sırası ──')
A.s.close(); await fetch(`http://127.0.0.1:9222/json/close/${A.tab.id}`); await sleep(1000)
B.s.close(); await fetch(`http://127.0.0.1:9222/json/close/${B.tab.id}`); await sleep(1000)
r = await kayit()
k('son kapanan B, değiştirmediği ekran düzenini ezmedi', r.frames.length === 2, r.frames.length)
const C = await stüdyo()
k('yeni sekme son değiştirilen düzenle açıldı (2 ekran, ızgara)', (await ekranSayisi(C.s)) === 2 && r.layout === 'grid', `${await ekranSayisi(C.s)} / ${r.layout}`)
C.s.close(); await fetch(`http://127.0.0.1:9222/json/close/${C.tab.id}`)

console.log('\n── Sıfırlama sekme kopyasını diriltmez ──')
const D = await stüdyo()
await sw.eval(`chrome.storage.local.clear()`); await sleep(300)
await D.s.send('Page.reload'); await sleep(1500); await karelerHazir(D.s); await sleep(800)
k('depo temizlenince yenilenen sekme eski düzeni geri getirmedi', (await ekranSayisi(D.s)) !== 2, await ekranSayisi(D.s))
D.s.close(); await fetch(`http://127.0.0.1:9222/json/close/${D.tab.id}`); await sleep(1500)
await sw.eval(`chrome.storage.local.clear()`)
sw.close()

console.log(hepsi ? '\n✅ GEÇTİ' : '\n❌ BAŞARISIZ')
process.exit(hepsi ? 0 : 1)
