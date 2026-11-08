/**
 * TEST KOŞUCUSU
 *
 * Kullanım:
 *   node test/calistir.mjs            → tüm paketleri sırayla çalıştırır
 *   node test/calistir.mjs faz3 ui    → yalnızca adı geçenleri
 *   node test/calistir.mjs --kur      → Chrome ve sunucuları başlatır, bekler
 *
 * Testler gerçek Chrome'da, CDP üzerinden çalışır. Ayrıntı: GELISTIRICI-REHBERI.md
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const DIR = dirname(fileURLToPath(import.meta.url))
const KOK = resolve(DIR, '..')
const PROFIL = resolve(DIR, '.profil')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** Sırası önemli: hafif olanlar önce, tarayıcıyı yoranlar sonra. */
const PAKETLER = [
  'regresyon',   // Faz 1 çekirdek: header bypass, cihaz emülasyonu, senkron
  'varsayilan',  // açılış seti, Windows ölçekleme, viewport ≠ ekran
  'faz2',        // konsol, kırılım noktaları, taşma, meta, görseller, bağlantılar
  'faz2c',       // tasarım bindirmesi, fontlar, Web Vitals
  'faz3',        // gerçek CSS medya emülasyonu, görme simülasyonu, metin ölçeği
  'faz3b',       // erişilebilirlik denetimleri, sosyal önizleme, PWA
  'faz3c',       // araç çubuğu düzeni ve menüler
  'faz4',        // cetvel, canlı kod, CSS değişkenleri, depolama, HTTP başlıkları
  'parmak',      // parmak modu: CSS media + :hover + JS hover bastırma
  'modern',      // adoptedStyleSheets + Shadow DOM kapsaması
  'kaydirma',    // sürükleyerek kaydırma, ivme, dokunuş/sürükleme ayrımı
  'atif',        // sitenin hataları eklentiye atfedilmemeli
  'sirala',      // ekranları sürükleyerek yeniden sıralama
  'ui',          // menü kırpılması, ipucu, ikon butonlar, taşma
  'kayit',       // WebM ekran kaydı (ek Chrome bayrağı ister)
  'guvenlik',    // viewer sitelere kapalı, SW komut doğrulaması, sahte mesaj eleme
]

const bekle = (ms) => new Promise((r) => setTimeout(r, ms))

async function cdpHazir(sn = 20) {
  for (let i = 0; i < sn * 2; i++) {
    try { await fetch('http://127.0.0.1:9222/json/version'); return true } catch { /* bekle */ }
    await bekle(500)
  }
  return false
}

function kur() {
  rmSync(PROFIL, { recursive: true, force: true })
  mkdirSync(PROFIL, { recursive: true })
  spawn('node', [resolve(DIR, 'serve.mjs')], { detached: true, stdio: 'ignore' }).unref()
  spawn('node', [resolve(DIR, 'cdn-serve.mjs')], { detached: true, stdio: 'ignore' }).unref()
  spawn(CHROME, [
    `--user-data-dir=${PROFIL}`,
    '--enable-unsafe-extension-debugging',   // CDP ile eklenti yüklemek için şart
    '--remote-debugging-port=9222',
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--window-size=1600,1100',
    '--auto-accept-this-tab-capture',        // kayıt testi izin penceresi açmasın
    '--auto-select-desktop-capture-source=Responsive Studio',
    'about:blank',
  ], { detached: true, stdio: 'ignore' }).unref()
}

function kapat() {
  spawnSync('pkill', ['-f', `user-data-dir=${PROFIL}`])
  spawnSync('pkill', ['-f', 'test/serve.mjs'])
  spawnSync('pkill', ['-f', 'test/cdn-serve.mjs'])
}

const arg = process.argv.slice(2)
if (!existsSync(resolve(KOK, 'dist/manifest.json'))) {
  console.error('dist/ yok — önce `npm run build` çalıştırın.')
  process.exit(1)
}

kapat()
await bekle(1000)
kur()
if (!(await cdpHazir())) { console.error('Chrome CDP açılmadı'); process.exit(1) }
spawnSync('node', [resolve(DIR, 'reload.mjs')], { cwd: DIR, stdio: 'ignore' })
await bekle(2000)

if (arg.includes('--kur')) {
  console.log('Chrome ve test sunucuları hazır (CDP: 9222). Kapatmak için Ctrl+C.')
  process.on('SIGINT', () => { kapat(); process.exit(0) })
  await new Promise(() => {})
}

const secili = arg.filter((a) => !a.startsWith('--'))
const liste = secili.length ? PAKETLER.filter((p) => secili.includes(p)) : PAKETLER
let basarisiz = 0

for (const ad of liste) {
  process.stdout.write(ad.padEnd(12) + ': ')
  const r = spawnSync('node', [resolve(DIR, `${ad}.mjs`)], { cwd: DIR, encoding: 'utf8' })
  const cikti = (r.stdout ?? '') + (r.stderr ?? '')
  const sonuc = cikti.split('\n').reverse().find((l) => l.includes('✅') || l.includes('❌'))
  if (sonuc?.includes('✅')) {
    console.log(sonuc.trim())
  } else {
    basarisiz++
    console.log(sonuc?.trim() ?? '❌ ÇALIŞMADI')
    for (const l of cikti.split('\n').filter((x) => x.includes('✗'))) console.log('    ' + l.trim())
  }
  await bekle(4000)
}

kapat()
console.log(basarisiz ? `\n${basarisiz} paket başarısız` : '\nTüm paketler geçti')
process.exit(basarisiz ? 1 : 0)
