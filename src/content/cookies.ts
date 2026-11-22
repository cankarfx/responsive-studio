/**
 * ÇEREZ KÖPRÜSÜ — stüdyo çerçevesinde `document.cookie`'yi tamamlar.
 *
 * SORUN (Chrome 157'de ölçüldü): Üst sayfa `chrome-extension://` olduğunda Chrome,
 * çerçevenin AĞ isteklerine SameSite=Lax/Strict çerezleri ekliyor (eklenti istisnası),
 * ama sayfanın JavaScript'i `document.cookie` ile bunları GÖREMİYOR ve YAZAMIYOR —
 * yalnızca SameSite=None çerezler görünüyor. SameSite belirtilmemiş çerezler de
 * Lax sayıldığı için sitelerin çoğu etkilenir: "oturum var mı?" diye çereze bakan
 * siteler stüdyoda çıkış yapmış görünür.
 *
 * ÇÖZÜM: Görünmeyen (HttpOnly olmayan) çerezleri service worker `chrome.cookies`
 * ile okur ve buraya gönderir; getter bunları yerel değerin sonuna ekler. Sayfanın
 * yazdığı ama Chrome'un reddettiği çerezler service worker üzerinden gerçek çerez
 * deposuna yazılır. HttpOnly çerezler hiçbir zaman sayfaya verilmez.
 *
 * Bu dosyanın iki yarısı var: MAIN world (sayfanın `document.cookie`'si) ve
 * ISOLATED world (service worker ile konuşan köprü). Aralarında aynı pencereye
 * `postMessage` kullanılır; taşınan veri zaten sayfanın kendi çerezleri.
 */

export interface ShimCookie {
  name: string
  value: string
  removed?: boolean
}

/* ─── MAIN world ──────────────────────────────────────────────────── */

function cookieNames(s: string): Set<string> {
  const out = new Set<string>()
  for (const part of s.split(';')) {
    const p = part.trim()
    if (!p) continue
    const i = p.indexOf('=')
    out.add(i >= 0 ? p.slice(0, i).trim() : p)
  }
  return out
}

export function installCookieShim(token: string, ilk: ShimCookie[] | null = null) {
  const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
  if (!desc?.get || !desc.set) return
  const nativeGet = desc.get
  const nativeSet = desc.set
  /** Chrome'un bu çerçevede gizlediği çerezler: ad → değer */
  const extra = new Map<string, string>()
  /* Stüdyonun yükle gönderdiği anlık görüntü — sayfanın ilk satırı bile görsün */
  for (const c of ilk ?? []) if (typeof c?.name === 'string' && typeof c.value === 'string') extra.set(c.name, c.value)

  try {
    Object.defineProperty(Document.prototype, 'cookie', {
      configurable: true,
      enumerable: desc.enumerable,
      get(this: Document) {
        const own = nativeGet.call(this) as string
        if (this !== document || !extra.size) return own
        const have = cookieNames(own)
        const add: string[] = []
        for (const [k, v] of extra) if (!have.has(k)) add.push(`${k}=${v}`)
        if (!add.length) return own
        return own ? `${own}; ${add.join('; ')}` : add.join('; ')
      },
      set(this: Document, v: unknown) {
        nativeSet.call(this, v)
        if (this !== document) return
        const raw = String(v)
        const first = raw.split(';')[0]
        const eq = first.indexOf('=')
        if (eq <= 0) return
        const name = first.slice(0, eq).trim()
        const value = first.slice(eq + 1).trim()
        if (!name) return
        const maxAge = /;\s*max-age\s*=\s*(-?\d+)/i.exec(raw)
        const expires = /;\s*expires\s*=\s*([^;]+)/i.exec(raw)
        const gone = (maxAge && Number(maxAge[1]) <= 0)
          || (!maxAge && expires && Date.parse(expires[1]) < Date.now())
        /* Chrome kabul ettiyse (ör. SameSite=None) yapacak bir şey yok */
        if (!gone && cookieNames(nativeGet.call(this) as string).has(name)) return
        if (gone) extra.delete(name)
        else extra.set(name, value)
        try { window.postMessage({ __rsCookieSet: token, raw }, location.origin) } catch { /* yoksay */ }
      },
    })
  } catch { return }

  window.addEventListener('message', (e) => {
    if (e.source !== window) return
    const d = e.data as { __rsCookies?: string; list?: ShimCookie[]; replace?: boolean } | null
    if (!d || d.__rsCookies !== token || !Array.isArray(d.list)) return
    if (d.replace) extra.clear()
    for (const c of d.list) {
      if (!c || typeof c.name !== 'string' || typeof c.value !== 'string') continue
      if (c.removed) extra.delete(c.name)
      else extra.set(c.name, c.value)
    }
  })
}

/* ─── ISOLATED world (köprü) ──────────────────────────────────────── */

interface ChangedCookie extends ShimCookie {
  domain: string
  hostOnly: boolean
  path: string
  secure: boolean
}

/** Bu çerez bu belgenin `document.cookie`'sinde görünür mü? (alan, yol, güvenli bağlantı) */
function appliesHere(c: ChangedCookie): boolean {
  const host = location.hostname.toLowerCase()
  const d = c.domain.toLowerCase().replace(/^\./, '')
  const domainOk = c.hostOnly ? host === d : host === d || host.endsWith(`.${d}`)
  const p = c.path || '/'
  const pathOk = location.pathname === p || location.pathname.startsWith(p.endsWith('/') ? p : `${p}/`)
  const secureOk = !c.secure || location.protocol === 'https:'
  return domainOk && pathOk && secureOk
}

/**
 * @param sakla güncel listenin tamamıyla çağrılır — köprü bunu window.name'deki
 *              yüke koyar; aynı kökende bir sonraki sayfa anında görsün diye.
 */
export function startCookieBridge(token: string, sakla: (l: ShimCookie[]) => void) {
  const guncel = new Map<string, string>()
  const post = (list: ShimCookie[], replace = false) => {
    if (replace) guncel.clear()
    for (const c of list) { if (c.removed) guncel.delete(c.name); else guncel.set(c.name, c.value) }
    sakla([...guncel].map(([name, value]) => ({ name, value })))
    try { window.postMessage({ __rsCookies: token, list, replace }, location.origin) } catch { /* yoksay */ }
  }

  chrome.runtime.sendMessage({ t: 'frameCookies' })
    .then((r: { ok?: boolean; cookies?: ShimCookie[] } | undefined) => {
      if (r?.ok && Array.isArray(r.cookies)) post(r.cookies, true)
    })
    .catch(() => { /* service worker uykudan uyanamadı — sayfa yine çalışır */ })

  window.addEventListener('message', (e) => {
    if (e.source !== window) return
    const d = e.data as { __rsCookieSet?: string; raw?: unknown } | null
    if (!d || d.__rsCookieSet !== token || typeof d.raw !== 'string' || d.raw.length > 4096) return
    chrome.runtime.sendMessage({ t: 'frameCookieSet', raw: d.raw }).catch(() => { /* yoksay */ })
  })

  /* Sunucunun ya da başka bir ekranın değiştirdiği çerezler */
  chrome.runtime.onMessage.addListener((m: { t?: string; c?: ChangedCookie }) => {
    if (m?.t !== 'rsCookie' || !m.c || !appliesHere(m.c)) return
    post([{ name: m.c.name, value: m.c.value, removed: m.c.removed }])
  })
}
