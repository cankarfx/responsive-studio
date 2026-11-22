/**
 * OTURUM TEST SUNUCUSU — gerçek bir üyelik sitesinin çerez yapısını taklit eder:
 *   https://can.rs.test:8443   uygulama (oturum ipucu çerezini JS ile okur)
 *   https://api.rs.test:8443   API (HttpOnly yenileme çerezi, CORS + credentials)
 * Alan adları Chrome'a `--host-resolver-rules` ile 127.0.0.1'e yönlendirilir;
 * sertifika her açılışta geçici olarak üretilir (Chrome `--ignore-certificate-errors`).
 */
import { createServer } from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'rs-oturum-'))
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
  '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem'), '-subj', '/CN=rs.test',
  '-addext', 'subjectAltName=DNS:*.rs.test,DNS:rs.test,DNS:*.rs2.test'], { stdio: 'ignore' })

const API = 'https://api.rs.test:8443'
const SAYFA = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Üyelik</title>
<script>/* sayfanın İLK satırı: henüz hiçbir şey yüklenmeden çerez okunur */ window.__ilk = document.cookie</script></head><body>
<h1 id="durum">yükleniyor</h1>
<script>
  window.giris = async () => {
    await fetch('${API}/login', { method: 'POST', credentials: 'include' })
    document.cookie = 'hint=1; domain=rs.test; path=/; SameSite=Lax; Secure; max-age=3600'
    document.cookie = 'hintd=1; domain=rs.test; path=/; Secure; max-age=3600'
    document.cookie = 'hintn=1; domain=rs.test; path=/; SameSite=None; Secure; max-age=3600'
    await fetch('/sid', { credentials: 'include' })
  }
  window.me = async () => (await (await fetch('${API}/me', { credentials: 'include' })).json()).rt
  window.tazele = () => fetch('${API}/tazele', { method: 'POST', credentials: 'include' })
  window.sid = async () => (await fetch('/sid-oku', { credentials: 'include' })).text()
  /* Gerçek uygulamalar gibi: "oturum var mı?" sorusunu çerezle cevapla, sonra sunucuya sor */
  addEventListener('load', async () => {
    const ipucu = document.cookie.split(';').some((p) => p.trim() === 'hint=1')
    document.getElementById('durum').textContent = ipucu && (await me()) ? 'GİRİŞ YAPILDI' : 'GİRİŞ EKRANI'
  })
</script></body></html>`

createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, (req, res) => {
  const host = (req.headers.host ?? '').split(':')[0]
  const cerez = req.headers.cookie ?? ''
  if (host === 'api.rs.test') {
    if (req.headers.origin) {
      res.setHeader('access-control-allow-origin', req.headers.origin)
      res.setHeader('access-control-allow-credentials', 'true')
    }
    if (req.method === 'OPTIONS') { res.setHeader('access-control-allow-methods', 'GET,POST'); res.end(); return }
    if (req.url === '/login') {
      res.setHeader('set-cookie', 'rt=GIZLI; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600')
      res.end('ok'); return
    }
    if (req.url === '/me') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ rt: /(^|;\s*)rt=GIZLI/.test(cerez) })); return
    }
    if (req.url === '/tazele') {
      /* Sunucunun yanıtla koyduğu, JS'in okuyabileceği bir çerez */
      res.setHeader('set-cookie', 'tazelendi=1; Domain=rs.test; Path=/; Secure; SameSite=Lax; Max-Age=3600')
      res.end('ok'); return
    }
  }
  if (req.url === '/yonlendir') {
    /* Başka bir siteye sunucu yönlendirmesi — çerez anlık görüntüsü oraya sızmamalı */
    res.writeHead(302, { location: 'https://kotu.rs2.test:8443/' }); res.end(); return
  }
  if (host === 'kotu.rs2.test') {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end('<!doctype html><title>baska site</title><h1>başka site</h1><script>window.__ilk = { ad: window.name, hash: location.hash, cerez: document.cookie }</script>')
    return
  }
  if (req.url === '/sid') {
    res.setHeader('set-cookie', 'sid=ASIL; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600')
    res.end('ok'); return
  }
  if (req.url === '/sid-oku') {
    res.end(/(^|;\s*)sid=([^;]*)/.exec(cerez)?.[2] ?? '(yok)'); return
  }
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end(SAYFA)
}).listen(8443, () => console.log('oturum sunucusu hazır (8443)'))
