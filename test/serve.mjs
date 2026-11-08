import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
const dir = new URL('./fixtures/site/', import.meta.url)
const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.json':'application/json', '.png':'image/png' }
createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/?')) console.log('ISTEK', Date.now())
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0]
  const ext = p.slice(p.lastIndexOf('.'))
  try {
    let body = readFileSync(new URL('.' + p, dir))
    if (ext === '.html') {
      body = body.toString().replace('</body>',
        `<div class=box id=srv>SUNUCU-UA: ${req.headers['user-agent']}</div>` +
        `<div class=box id=hdr>X-TEST: ${req.headers['x-test-baslik'] ?? '(yok)'} | AUTH: ${req.headers['authorization'] ?? '(yok)'}</div>` +
        `<div class="box dis">Dis CSS: </div></body>`)
    }
    res.writeHead(200, { 'content-type': TYPES[ext] ?? 'text/plain',
      'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'" })
    res.end(body)
  } catch { res.writeHead(404); res.end('yok') }
}).listen(8899, () => console.log('test sunucusu hazir'))
