/**
 * CİHAZ EMÜLASYONU — MAIN world, document_start.
 *
 * Sayfanın kendi JavaScript'i çalışmadan ÖNCE navigator/screen/window üzerindeki
 * cihaz sinyallerini değiştirir. Yapılandırma URL fragment'ı üzerinden gelir
 * (bkz. lib/payload.ts — fragment sunucuya gönderilmez).
 *
 * NOT: CSS `@media (pointer: coarse)` / `prefers-color-scheme` gibi sorguların
 * gerçek değeri iframe içinde değiştirilemez — bunlar Pro Mod (CDP) gerektirir.
 * Genişlik tabanlı media query'ler ise iframe gerçekten o genişlikte olduğu için
 * doğal olarak doğru çalışır.
 */
import type { FramePayload, MediaOverrides } from '@/lib/types'
import { DEFAULT_MEDIA } from '@/lib/types'
import { PREFIX, insideViewer, readPayload, stripPayload } from '@/lib/payload'

const cfg = readPayload()
if (cfg && insideViewer()) {
  /* Köprü script'i (ISOLATED world) de okuyabilsin diye window.name'e yaz —
     iki script'in çalışma sırası garanti değil, bu yüzden iki kanal da dolu tutulur. */
  try { window.name = PREFIX + JSON.stringify(cfg) } catch { /* yoksay */ }
  applyEmulation(cfg)
  listenMediaOverrides(cfg.token)
  /* Konsol yakalama ve canlı JS, sayfanın KENDİ bağlamına enjekte edilir
     (bkz. installPageBridge). Enjeksiyon engellenirse eklenti içi yedeğe düşer. */
  if (!installPageBridge(cfg.token, cfg.fid)) {
    installConsoleCapture(cfg.token, cfg.fid)
    listenExec(cfg.token, cfg.fid)
  }
  /* Sayfanın kendi kodu çalışmadan adresi temizle */
  stripPayload(cfg.h)
}

function def(target: object, prop: string, get: () => unknown) {
  try {
    Object.defineProperty(target, prop, { get, configurable: true, enumerable: true })
  } catch {
    /* bazı özellikler kilitli olabilir — sessizce geç */
  }
}

function applyEmulation(c: FramePayload & { h?: string }) {
  const nav = Navigator.prototype
  const win = window as unknown as Record<string, unknown>

  /* ── navigator ─────────────────────────────────────────────── */
  def(nav, 'userAgent', () => c.ua)
  def(nav, 'appVersion', () => c.ua.replace(/^Mozilla\//, ''))
  def(nav, 'platform', () => c.platform)
  def(nav, 'vendor', () =>
    c.os === 'ios' || c.os === 'ipados' || c.os === 'macos' ? 'Apple Computer, Inc.' : 'Google Inc.')
  def(nav, 'maxTouchPoints', () => (c.touch ? 5 : 0))

  /* ── Client Hints (navigator.userAgentData) ────────────────── */
  const u = c.uaData
  const highEntropy = {
    architecture: u.architecture,
    bitness: u.bitness,
    brands: u.brands,
    fullVersionList: u.brands.map((b) => ({ brand: b.brand, version: u.uaFullVersion })),
    mobile: u.mobile,
    model: u.model,
    platform: u.platform,
    platformVersion: u.platformVersion,
    uaFullVersion: u.uaFullVersion,
    wow64: u.wow64,
  }
  const fakeUAD = {
    brands: u.brands.map((b) => ({ brand: b.brand, version: b.version })),
    mobile: u.mobile,
    platform: u.platform,
    getHighEntropyValues(hints: string[]) {
      const out: Record<string, unknown> = {
        brands: highEntropy.brands,
        mobile: highEntropy.mobile,
        platform: highEntropy.platform,
      }
      for (const h of hints) {
        if (h in highEntropy) out[h] = (highEntropy as Record<string, unknown>)[h]
      }
      return Promise.resolve(out)
    },
    toJSON() {
      return { brands: this.brands, mobile: this.mobile, platform: this.platform }
    },
  }
  def(nav, 'userAgentData', () => fakeUAD)

  /* ── ekran ölçüleri ────────────────────────────────────────── */
  /* Masaüstünde ekran ile tarayıcı viewport'u farklıdır: `innerWidth` iframe'in
     gerçek boyutundan gelir, `screen.*` ise fiziksel ekranı bildirmelidir. */
  const sw = c.screenW || c.width
  const sh = c.screenH || c.height
  const sp = Screen.prototype
  def(sp, 'width', () => sw)
  def(sp, 'height', () => sh)
  def(sp, 'availWidth', () => sw)
  /* Görev çubuğu / Dock, kullanılabilir yüksekliği azaltır */
  def(sp, 'availHeight', () => (sh > c.height ? sh - 40 : sh))
  def(sp, 'colorDepth', () => 24)
  def(sp, 'pixelDepth', () => 24)

  def(win, 'devicePixelRatio', () => c.dpr)
  /* Pencere dış ölçüsü: viewport + tarayıcı arayüzü */
  def(win, 'outerWidth', () => c.width)
  def(win, 'outerHeight', () => (sh > c.height ? Math.min(sh, c.height + 112) : c.height))
  def(win, 'screenX', () => 0)
  def(win, 'screenY', () => 0)
  def(win, 'screenLeft', () => 0)
  def(win, 'screenTop', () => 0)

  /* eski `window.orientation` API'si */
  const isLandscape = sw > sh
  if (c.touch) def(win, 'orientation', () => (isLandscape ? 90 : 0))

  /* ── dokunma desteği sinyali ───────────────────────────────── */
  if (c.touch) {
    if (!('ontouchstart' in window)) {
      try {
        ;(window as unknown as Record<string, unknown>).ontouchstart = null
        ;(document as unknown as Record<string, unknown>).ontouchstart = null
        Object.defineProperty(document.documentElement, 'ontouchstart', {
          value: null, writable: true, configurable: true,
        })
      } catch { /* yoksay */ }
    }
    installTouchBridge()
  } else {
    def(nav, 'maxTouchPoints', () => 0)
  }

  /* ── matchMedia: JS tarafı sorgular için doğru cevap ────────── */
  patchMatchMedia(c)
}

/** Çalışma anında güncellenebilen medya override'ları (viewer'dan gelir). */
let mediaOverrides: MediaOverrides = { ...DEFAULT_MEDIA }

/**
 * Köprü script'i (ISOLATED world) medya ayarları değişince buraya haber verir.
 * İki dünya nesne paylaşamaz ama aynı `window` üzerinden mesajlaşabilir.
 */
function listenMediaOverrides(token: string) {
  window.addEventListener('message', (e) => {
    const d = e.data as { __rsMedia?: string; overrides?: MediaOverrides }
    if (e.source !== window) return /* yalnızca köprü (aynı pencere) */
    if (!d || d.__rsMedia !== token || !d.overrides) return
    mediaOverrides = d.overrides
    /* Dinleyen sayfa kodunun haberi olsun diye bir resize tetikle */
    try { window.dispatchEvent(new Event('resize')) } catch { /* yoksay */ }
  })
}

/**
 * matchMedia'yı sarmalar: pointer/hover/prefers-* gibi cihaz ve kullanıcı
 * tercihi sorguları JS'ten sorulduğunda emüle edilen değeri döndürür.
 * (CSS tarafı ayrıca content/media.ts'te stylesheet yeniden yazımıyla halledilir.)
 */
function patchMatchMedia(c: FramePayload) {
  const original = window.matchMedia.bind(window)
  const coarse = c.touch

  function override(query: string): boolean | null {
    const q = query.toLowerCase()
    if (/\(\s*any-?pointer\s*:\s*coarse\s*\)/.test(q)) return coarse
    if (/\(\s*any-?pointer\s*:\s*fine\s*\)/.test(q)) return !coarse
    if (/\(\s*pointer\s*:\s*coarse\s*\)/.test(q)) return coarse
    if (/\(\s*pointer\s*:\s*fine\s*\)/.test(q)) return !coarse
    if (/\(\s*pointer\s*:\s*none\s*\)/.test(q)) return false
    if (/\(\s*any-?hover\s*:\s*none\s*\)/.test(q)) return coarse
    if (/\(\s*any-?hover\s*:\s*hover\s*\)/.test(q)) return !coarse
    if (/\(\s*hover\s*:\s*none\s*\)/.test(q)) return coarse
    if (/\(\s*hover\s*:\s*hover\s*\)/.test(q)) return !coarse
    const mo = mediaOverrides
    const scheme = mo.colorScheme !== 'auto' ? mo.colorScheme : c.colorScheme
    if (scheme !== 'auto') {
      if (/prefers-color-scheme\s*:\s*dark/.test(q)) return scheme === 'dark'
      if (/prefers-color-scheme\s*:\s*light/.test(q)) return scheme === 'light'
    }
    if (mo.reducedMotion !== 'auto') {
      if (/prefers-reduced-motion\s*:\s*reduce/.test(q)) return mo.reducedMotion === 'reduce'
      if (/prefers-reduced-motion\s*:\s*no-preference/.test(q)) return mo.reducedMotion === 'no-preference'
      if (/\(\s*prefers-reduced-motion\s*\)/.test(q)) return mo.reducedMotion === 'reduce'
    }
    if (mo.contrast !== 'auto') {
      if (/prefers-contrast\s*:\s*more/.test(q)) return mo.contrast === 'more'
      if (/prefers-contrast\s*:\s*less/.test(q)) return mo.contrast === 'less'
      if (/prefers-contrast\s*:\s*no-preference/.test(q)) return false
    }
    if (mo.forcedColors !== 'auto') {
      if (/forced-colors\s*:\s*active/.test(q)) return mo.forcedColors === 'active'
      if (/forced-colors\s*:\s*none/.test(q)) return mo.forcedColors !== 'active'
    }
    if (/\(\s*resolution\s*:/.test(q) || /device-pixel-ratio/.test(q)) {
      const m = /([0-9.]+)\s*(dppx|x)?\s*\)/.exec(q)
      if (m) {
        const target = parseFloat(m[1])
        if (/min-/.test(q)) return c.dpr >= target
        if (/max-/.test(q)) return c.dpr <= target
        return Math.abs(c.dpr - target) < 0.01
      }
    }
    return null
  }

  window.matchMedia = function (query: string): MediaQueryList {
    const real = original(query)
    const forced = override(query)
    if (forced === null) return real
    return new Proxy(real, {
      get(t, p, r) {
        if (p === 'matches') return forced
        const v = Reflect.get(t, p, r)
        return typeof v === 'function' ? v.bind(t) : v
      },
    })
  }
}

/** Fare olaylarını dokunma olaylarına çevirir (pointer → touch). */
function installTouchBridge() {
  if (typeof Touch === 'undefined' || typeof TouchEvent === 'undefined') return
  const map: Record<string, string> = {
    pointerdown: 'touchstart',
    pointermove: 'touchmove',
    pointerup: 'touchend',
    pointercancel: 'touchcancel',
  }
  let active = false

  for (const [src, dst] of Object.entries(map)) {
    window.addEventListener(
      src,
      (e) => {
        const pe = e as PointerEvent
        if (pe.pointerType !== 'mouse' || !pe.isTrusted) return
        if (src === 'pointerdown') active = true
        else if (!active) return
        if (src === 'pointerup' || src === 'pointercancel') active = false

        const target = (pe.target as Element) ?? document.body
        let touch: Touch
        try {
          touch = new Touch({
            identifier: 1,
            target,
            clientX: pe.clientX, clientY: pe.clientY,
            screenX: pe.screenX, screenY: pe.screenY,
            pageX: pe.pageX, pageY: pe.pageY,
            radiusX: 11, radiusY: 11, rotationAngle: 0, force: 1,
          })
        } catch { return }

        const ended = dst === 'touchend' || dst === 'touchcancel'
        const te = new TouchEvent(dst, {
          bubbles: true, cancelable: true, composed: true,
          touches: ended ? [] : [touch],
          targetTouches: ended ? [] : [touch],
          changedTouches: [touch],
        })
        target.dispatchEvent(te)
      },
      { capture: true, passive: true },
    )
  }
}


/**
 * SAYFA TARAFI KÖPRÜ — hata atfını doğru yere yönlendirir.
 *
 * SORUN: `console.error`'ı doğrudan eklenti kodundan sarmalarsak, sayfanın kendi
 * hataları çağrı yığınında bizim script'imizi gördüğü için **eklentiye atfediliyor**
 * ve `chrome://extensions` hata listesini test edilen sitenin hatalarıyla dolduruyor
 * (Chrome 152'de ölçüldü).
 *
 * ÇÖZÜM: aşağıdaki fonksiyonun gövdesi metin olarak sayfaya enjekte edilir; böylece
 * sayfanın kendi kodu sayılır ve sitenin hataları siteye ait kalır. Fonksiyon tamamen
 * kendi kendine yeterli olmalıdır — dış kapsamdan hiçbir şeye başvuramaz, çünkü
 * derleme sonrası yalnızca metni gömülür.
 */
function pageBridgeSource(token: string, fid: string) {
  const w = window as unknown as Record<string, unknown>
  if (w.__rsPageBridge) return
  w.__rsPageBridge = true

  let gonderildi = 0
  function post(level: string, text: string, source?: string) {
    if (gonderildi++ > 300) return
    try {
      window.parent.postMessage(
        { __rs: token, m: { t: 'console', fid, level, text: String(text).slice(0, 600), source } },
        location.ancestorOrigins[0],
      )
    } catch (e) { /* yoksay */ }
  }

  function fmt(args: IArguments) {
    const out: string[] = []
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      if (typeof a === 'string') { out.push(a); continue }
      if (a instanceof Error) { out.push(a.name + ': ' + a.message); continue }
      try { out.push(String(JSON.stringify(a)).slice(0, 200)) } catch (e) { out.push(String(a)) }
    }
    return out.join(' ')
  }

  const seviyeler = ['error', 'warn']
  for (let k = 0; k < seviyeler.length; k++) {
    (function (lv) {
      const c = console as unknown as Record<string, (...a: unknown[]) => void>
      const orijinal = c[lv].bind(console)
      c[lv] = function () {
        post(lv, fmt(arguments))
        orijinal.apply(console, Array.prototype.slice.call(arguments))
      }
    })(seviyeler[k])
  }

  window.addEventListener('error', function (e) {
    const t = e.target as unknown as Record<string, string>
    if (e.target && e.target !== (window as unknown as EventTarget)) {
      post('error', 'Yüklenemedi: ' + (t.src || t.href || t.tagName), String(t.tagName || '').toLowerCase())
    } else {
      post('error', e.message + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')')
    }
  }, true)

  window.addEventListener('unhandledrejection', function (e) {
    const r = e.reason as { message?: string } | string
    post('error', 'İşlenmemiş promise reddi: '
      + (typeof r === 'string' ? r : (r && r.message) || String(r)))
  })

  /* Canlı JS de sayfa bağlamında çalışsın — kullanıcı kodunun hataları da
     eklentiye değil sayfaya ait olsun. */
  window.addEventListener('message', function (e) {
    const d = e.data as { __rsExec?: string; code?: string }
    if (e.source !== window || !d || d.__rsExec !== token || typeof d.code !== 'string') return
    try {
      (0, eval)(d.code)
    } catch (err) {
      const m = err instanceof Error ? err.name + ': ' + err.message : String(err)
      post('error', 'Canlı JS hatası — ' + m, 'canlı kod')
    }
  })
}

/** Köprüyü sayfaya enjekte eder. Başarılıysa true döner. */
function installPageBridge(token: string, fid: string): boolean {
  if (window.top === window.self) return false
  try {
    const el = document.createElement('script')
    el.textContent = `(${pageBridgeSource.toString()})(${JSON.stringify(token)},${JSON.stringify(fid)})`
    document.documentElement.appendChild(el)
    el.remove()
    /* Sayfanın CSP'si satır içi script'i engellemişse bayrak yazılmaz */
    return !!(window as unknown as Record<string, unknown>).__rsPageBridge
  } catch {
    return false
  }
}

/**
 * CANLI JS ÇALIŞTIRICI (yedek) — sayfa köprüsü enjekte edilemediğinde kullanılır.
 *
 * Content script'lerin ISOLATED world'ünden sayfaya eklenen satır içi
 * `<script>` elemanları MV3'te çalıştırılmıyor (Chrome 152'de ölçüldü).
 * Bu yüzden köprü script'i kodu buraya iletiyor; burası sayfanın kendi
 * dünyası olduğu için kod normal sayfa kodu gibi çalışıyor.
 */
function listenExec(token: string, fid: string) {
  window.addEventListener('message', (e) => {
    const d = e.data as { __rsExec?: string; code?: string }
    if (e.source !== window || !d || d.__rsExec !== token || typeof d.code !== 'string') return
    try {
      new Function(d.code)()
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      try {
        window.parent.postMessage(
          { __rs: token, m: { t: 'console', fid, level: 'error', text: `Canlı JS hatası — ${msg}`, source: 'canlı kod' } },
          location.ancestorOrigins[0],
        )
      } catch { /* yoksay */ }
    }
  })
}

/**
 * KONSOL TOPLAYICI (yedek) — sayfa köprüsü enjekte edilemediğinde kullanılır.
 * Bu yol, sayfanın hatalarının eklentiye atfedilmesine yol açar; bu yüzden
 * yalnızca sayfa CSP'si satır içi script'i engellediğinde devreye girer.
 */
function installConsoleCapture(token: string, fid: string) {
  if (window.top === window.self) return
  let sent = 0
  const post = (level: 'error' | 'warn' | 'info', text: string, source?: string) => {
    if (sent++ > 300) return // taşkın koruması
    try {
      window.parent.postMessage({ __rs: token, m: { t: 'console', fid, level, text: text.slice(0, 600), source } }, location.ancestorOrigins[0])
    } catch { /* yoksay */ }
  }

  const fmt = (args: unknown[]) =>
    args.map((a) => {
      if (typeof a === 'string') return a
      if (a instanceof Error) return `${a.name}: ${a.message}`
      try { return JSON.stringify(a)?.slice(0, 200) ?? String(a) } catch { return String(a) }
    }).join(' ')

  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      post(level, fmt(args))
      original(...args)
    }
  }

  window.addEventListener('error', (e) => {
    if (e.target && e.target !== window) {
      /* Kaynak yükleme hatası (img/script/link) */
      const el = e.target as HTMLElement & { src?: string; href?: string }
      post('error', `Yüklenemedi: ${el.src || el.href || el.tagName}`, el.tagName.toLowerCase())
    } else {
      post('error', `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`)
    }
  }, true)

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string } | string
    post('error', 'İşlenmemiş promise reddi: ' + (typeof r === 'string' ? r : r?.message ?? String(r)))
  })
}
