/**
 * GİRİŞ YAPILMIŞ SİTELER — stüdyo çerçevesinde sitenin JavaScript'i kendi
 * SameSite=Lax / ayarsız çerezlerini görebilmeli (Chrome bunları gizliyor; çerez
 * köprüsü tamamlıyor). HttpOnly çerezler ise asla görünmemeli ve ezilememeli.
 *
 * Sunucu: test/oturum-serve.mjs (https://can.rs.test:8443 + https://api.rs.test:8443)
 */
import { Session, sleep, karelerHazir } from './cdp.mjs'

const EXT = 'ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const SITE = 'https://can.rs.test:8443/'
let hepsi = true
const k = (ad, c, ek = '') => { if (!c) hepsi = false; console.log(` ${c ? '✓' : '✗'} ${ad}${ek !== '' ? ' — ' + ek : ''}`) }
const liste = async () => (await fetch('http://127.0.0.1:9222/json/list')).json()
const bekleKosul = async (fn, kosul, ms = 4000) => {
  const bas = Date.now(); let v
  do { v = await fn(); if (kosul(v)) return v; await sleep(200) } while (Date.now() - bas < ms)
  return v
}

for (const t of await liste()) if (t.url.includes('viewer.html') || t.url.includes('rs.test')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
await sleep(1000)
const tarayici = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl)
await tarayici.connect()
const jar = async () => (await tarayici.send('Storage.getCookies')).cookies.filter((c) => c.domain.includes('rs.test'))
await tarayici.send('Storage.clearCookies')

/* ── Normal sekmede giriş ── */
const nt = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(SITE)}`, { method: 'PUT' })).json()
await sleep(1500)
const n = new Session(nt.webSocketDebuggerUrl); await n.connect(); await n.send('Runtime.enable')
await n.eval(`giris()`)
await n.send('Page.reload'); await sleep(1500)
k('normal sekmede giriş yapıldı', (await n.eval(`document.getElementById('durum').textContent`)) === 'GİRİŞ YAPILDI')

/* ── Stüdyo ── */
const vt = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent(SITE)}`)}`, { method: 'PUT' })).json()
await sleep(1500)
const v = new Session(vt.webSocketDebuggerUrl); await v.connect(); await v.send('Runtime.enable')
await karelerHazir(v); await sleep(2500)

const { targetInfos } = await tarayici.send('Target.getTargets')
const kareler = []
for (const t of targetInfos.filter((x) => x.type === 'iframe' && x.url.startsWith(SITE)).slice(0, 3)) {
  const { sessionId } = await tarayici.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })
  const gonder = (m, pp = {}) => new Promise((res, rej) => {
    const id = ++tarayici.id; tarayici.pending.set(id, { res, rej })
    tarayici.ws.send(JSON.stringify({ id, method: m, params: pp, sessionId }))
    setTimeout(() => { if (tarayici.pending.has(id)) { tarayici.pending.delete(id); rej(new Error('zaman aşımı ' + m)) } }, 15000)
  })
  kareler.push(async (expr) => {
    const r = await gonder('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'hata')
    return r.result.value
  })
}
k('stüdyoda en az iki site çerçevesi bulundu', kareler.length >= 2, kareler.length)
const [a, b] = kareler

console.log('\n── Site stüdyoda giriş yapılmış görünür ──')
for (const [i, ev] of kareler.entries()) {
  const durum = await bekleKosul(() => ev(`document.getElementById('durum').textContent`), (x) => x === 'GİRİŞ YAPILDI')
  k(`ekran ${i + 1}: site "giriş yapıldı" dedi`, durum === 'GİRİŞ YAPILDI', durum)
}
const ilk = await a(`window.__ilk`)
k('sayfanın ilk satırı (head içi script) çerezi görür', /(^|; )hint=1/.test(ilk), ilk)
const c = await a(`document.cookie`)
k('SameSite=Lax çerez JS\'e görünür', /(^|; )hint=1/.test(c), c)
k('SameSite belirtilmemiş çerez JS\'e görünür', /(^|; )hintd=1/.test(c), c)
k('SameSite=None çerez JS\'e görünür', /(^|; )hintn=1/.test(c), c)
k('HttpOnly çerezler JS\'e GÖRÜNMEZ', !/sid=|rt=/.test(c), c)
k('istekler oturum çerezini taşır', (await a(`me()`)) === true)

console.log('\n── Ekranın yazdığı çerez ──')
await a(`document.cookie = 'yeni=42; path=/; SameSite=Lax; Secure; max-age=600'`)
k('yazan ekran hemen okur', /(^|; )yeni=42/.test(await a(`document.cookie`)))
const bGordu = await bekleKosul(() => b(`document.cookie`), (x) => /(^|; )yeni=42/.test(x))
k('diğer ekran da görür', /(^|; )yeni=42/.test(bGordu), bGordu)
const nGordu = await bekleKosul(() => n.eval(`document.cookie`), (x) => /(^|; )yeni=42/.test(x))
k('normal sekme de görür (gerçek çerez deposu)', /(^|; )yeni=42/.test(nGordu), nGordu)
await a(`document.cookie = 'yeni=; path=/; max-age=0'`)
k('silinen çerez yazan ekrandan kalktı', !/yeni=/.test(await a(`document.cookie`)))
const bSil = await bekleKosul(() => b(`document.cookie`), (x) => !/yeni=/.test(x))
k('silinen çerez diğer ekrandan kalktı', !/yeni=/.test(bSil), bSil)
k('silinen çerez depodan kalktı', !(await jar()).some((x) => x.name === 'yeni'))

console.log('\n── Sunucunun koyduğu çerez ──')
await a(`tazele()`)
const taz = await bekleKosul(() => b(`document.cookie`), (x) => /tazelendi=1/.test(x))
k('yanıtla gelen Lax çerez ekranlarda görünür', /tazelendi=1/.test(taz), taz)

console.log('\n── Güvenlik ──')
await a(`document.cookie = 'sid=SAHTE; path=/; Secure; SameSite=Lax'`)
await sleep(800)
k('sayfa HttpOnly oturum çerezini ezemez', (await a(`sid()`)) === 'ASIL', await a(`sid()`))
await a(`document.cookie = 'baska=1; domain=example.com; path=/; Secure'`)
await a(`document.cookie = 'kok=1; domain=test; path=/; Secure'`)
await sleep(800)
const kac = (await tarayici.send('Storage.getCookies')).cookies.filter((x) => x.name === 'baska' || x.name === 'kok')
k('başka alan adına / üst alan uzantısına çerez yazılamaz', kac.length === 0, JSON.stringify(kac.map((x) => x.domain)))
await a(`document.cookie = 'ht=1; path=/; HttpOnly; Secure'`)
await sleep(500)
k('sayfa HttpOnly çerez oluşturamaz', !(await jar()).some((x) => x.name === 'ht'))
/* Stüdyo dışındaki normal sekmede köprü çalışmaz */
k('normal sekmede çerez köprüsü yok', (await n.eval(`Object.getOwnPropertyDescriptor(Document.prototype, 'cookie').get.toString().includes('[native code]')`)) === true)

console.log('\n── Başka siteye yönlendirme ──')
const yt = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent(SITE + 'yonlendir')}`)}`, { method: 'PUT' })).json()
await sleep(1500)
const ys = new Session(yt.webSocketDebuggerUrl); await ys.connect(); await karelerHazir(ys); await sleep(2500)
const kotu = (await tarayici.send('Target.getTargets')).targetInfos.find((x) => x.type === 'iframe' && x.url.startsWith('https://kotu.rs2.test'))
k('ekran başka siteye yönlendi', !!kotu)
if (kotu) {
  const { sessionId } = await tarayici.send('Target.attachToTarget', { targetId: kotu.targetId, flatten: true })
  const r = await new Promise((res) => {
    const id = ++tarayici.id; tarayici.pending.set(id, { res, rej: res })
    tarayici.ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: 'JSON.stringify({ ilk: window.__ilk, simdi: { ad: window.name, hash: location.hash, cerez: document.cookie } })', returnByValue: true }, sessionId }))
  })
  const metin = r?.result?.value ?? ''
  k('ilk sitenin çerezleri yönlendirilen siteye sızmadı (ad, adres, document.cookie)', metin && !/hint|GIZLI|ASIL/.test(metin), metin.slice(0, 200))
}
ys.close()

v.close(); n.close()
for (const t of await liste()) if (t.url.includes('viewer.html') || t.url.includes('rs.test')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
await tarayici.send('Storage.clearCookies')
tarayici.close()
console.log(hepsi ? '\n✅ GEÇTİ' : '\n❌ BAŞARISIZ')
process.exit(hepsi ? 0 : 1)
