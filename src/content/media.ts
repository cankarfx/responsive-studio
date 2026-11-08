/**
 * GERÇEK CSS MEDYA EMÜLASYONU — izin gerektirmeyen yol.
 *
 * Chrome, bir iframe içinde `prefers-color-scheme` gibi medya özelliklerinin
 * gerçek değerini değiştirmeye izin vermiyor (CDP denendi, alt çerçevelerde
 * çalışmıyor — bkz. YOL-HARITASI.md §2.4). Bu yüzden değeri değiştirmek yerine
 * **kuralları yeniden yazıyoruz**: sayfanın stylesheet'lerindeki
 * `@media (prefers-color-scheme: dark)` koşulları, her zaman eşleşen
 * `(min-width: 0px)` veya hiç eşleşmeyen `(min-width: 999999px)` ile
 * değiştiriliyor. Sonuç, sitenin kendi koyu mod stillerinin gerçekten devreye
 * girmesi.
 *
 * Okunamayan (cross-origin) stylesheet'ler service worker üzerinden indirilip,
 * göreli adresleri mutlaklaştırılarak satır içi enjekte ediliyor.
 */
import type { MediaOverrides } from '@/lib/types'
import { installTouchScroll, removeTouchScroll } from './touch'

const ALWAYS = '(min-width: 0px)'
const NEVER = '(min-width: 999999px)'
const MARK = 'data-rs-media'

/** Değiştirilen kuralların özgün metni — geri almak için. */
const originalConditions = new WeakMap<CSSMediaRule, string>()
/** Devre dışı bırakılan <link> elemanları */
let disabledLinks: HTMLLinkElement[] = []
/** Enjekte edilen yedek <style> elemanları */
let injected: HTMLStyleElement[] = []
/** Aynı sheet iki kez indirilmesin */
const fetchCache = new Map<string, string>()

let current: MediaOverrides | null = null
let currentTouch = false
/**
 * EŞZAMANLILIK KORUMASI.
 * `applyMedia` birden çok yerden çağrılıyor (çerçeve açılışı, viewer mesajı,
 * tekrarlı taramalar) ve içinde `await` var. Korumasız bırakıldığında bir
 * çağrının `restoreAll()`'u, başka bir çağrının yarıda kalmış stylesheet
 * değişimini bozuyor ve sayfa stilsiz kalabiliyordu (ölçüldü).
 * `nesil` her yeni uygulamada artar; eski çağrılar kendi nesilleri geçersizse
 * sessizce çekilir. `kuyruk` ise çağrıların üst üste binmesini engeller.
 */
let nesil = 0
let kuyruk: Promise<void> = Promise.resolve()
let observer: MutationObserver | null = null

function swFetch(url: string): Promise<string | null> {
  if (fetchCache.has(url)) return Promise.resolve(fetchCache.get(url)!)
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ t: 'fetch', url, kind: 'css' }, (r) => {
        void chrome.runtime.lastError
        const text = r?.ok && r.text ? (r.text as string) : null
        if (text) fetchCache.set(url, text)
        resolve(text)
      })
    } catch { resolve(null) }
  })
}

/* ═══ Koşul yeniden yazımı ═══════════════════════════════════════════ */

interface Rule { re: RegExp; on: (m: RegExpMatchArray) => boolean | null }

/** Geçerli override'lara göre bir medya özelliğini ALWAYS/NEVER'a çevirir. */
function buildRules(o: MediaOverrides, touch: boolean): Rule[] {
  const rules: Rule[] = []

  /* PARMAK MODU: telefon ve tabletlerde işaretleyici kaba, hover yok.
     `prefers-*` ile aynı mekanizma — koşul her zaman/hiçbir zaman eşleşen
     bir ifadeyle değiştirilir. CDP bunu alt çerçevelerde yapamıyordu
     (bkz. YOL-HARITASI §2.4); stylesheet yeniden yazımı yapabiliyor. */
  if (touch) {
    rules.push({ re: /\(\s*(any-)?pointer\s*:\s*(coarse|fine|none)\s*\)/gi,
      on: (m) => m[2].toLowerCase() === 'coarse' })
    rules.push({ re: /\(\s*(any-)?hover\s*:\s*(hover|none)\s*\)/gi,
      on: (m) => m[2].toLowerCase() === 'none' })
  }

  if (o.colorScheme !== 'auto') {
    rules.push({
      re: /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi,
      on: (m) => m[1].toLowerCase() === o.colorScheme,
    })
  }
  if (o.reducedMotion !== 'auto') {
    rules.push({
      re: /\(\s*prefers-reduced-motion\s*:\s*(reduce|no-preference)\s*\)/gi,
      on: (m) => m[1].toLowerCase() === o.reducedMotion,
    })
  }
  if (o.contrast !== 'auto') {
    rules.push({
      re: /\(\s*prefers-contrast\s*:\s*(more|less|custom|no-preference)\s*\)/gi,
      on: (m) => m[1].toLowerCase() === o.contrast,
    })
  }
  if (o.forcedColors !== 'auto') {
    rules.push({
      re: /\(\s*forced-colors\s*:\s*(active|none)\s*\)/gi,
      on: (m) => (m[1].toLowerCase() === 'active') === (o.forcedColors === 'active'),
    })
  }
  return rules
}

/** Bir media koşulunu yeniden yazar; değişiklik yoksa null döner. */
function rewriteCondition(cond: string, rules: Rule[]): string | null {
  let out = cond
  let changed = false
  for (const r of rules) {
    out = out.replace(r.re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpMatchArray
      const verdict = r.on(m)
      if (verdict === null) return args[0] as string
      changed = true
      return verdict ? ALWAYS : NEVER
    })
  }
  return changed ? out : null
}

/* ═══ Aynı-origin kurallar ═══════════════════════════════════════════ */

function walkRules(rules: CSSRuleList, apply: (r: CSSMediaRule) => void) {
  for (const r of Array.from(rules)) {
    if (r instanceof CSSMediaRule) {
      apply(r)
      walkRules(r.cssRules, apply)
    } else if ('cssRules' in r) {
      try { walkRules((r as CSSGroupingRule).cssRules, apply) } catch { /* erişilemez */ }
    }
  }
}

function patchSheet(sheet: CSSStyleSheet, rules: Rule[]) {
  walkRules(sheet.cssRules, (mr) => {
    const cur = mr.media.mediaText
    const next = rewriteCondition(cur, rules)
    if (next === null) return
    if (!originalConditions.has(mr)) originalConditions.set(mr, cur)
    try { mr.media.mediaText = next } catch { /* bazı kurallar salt okunur */ }
  })
}

function restoreSheet(sheet: CSSStyleSheet) {
  walkRules(sheet.cssRules, (mr) => {
    const orig = originalConditions.get(mr)
    if (orig !== undefined) {
      try { mr.media.mediaText = orig } catch { /* yoksay */ }
      originalConditions.delete(mr)
    }
  })
}

/* ═══ Cross-origin stylesheet'ler ════════════════════════════════════ */

/** CSS içindeki göreli adresleri mutlaklaştırır (görseller, fontlar). */
function absolutizeUrls(css: string, base: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (whole, q, u) => {
    const url = String(u).trim()
    if (/^(data:|blob:|https?:|\/\/|#)/i.test(url)) return whole
    try { return `url(${q}${new URL(url, base).href}${q})` } catch { return whole }
  })
}

/** `@import` zincirini yerinde açar ki yeniden yazım onlara da uygulansın. */
async function inlineImports(css: string, base: string, depth = 0): Promise<string> {
  if (depth > 2) return css
  const re = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)([^;]*);/gi
  const jobs: { whole: string; url: string; media: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const raw = (m[2] ?? m[4] ?? '').trim()
    if (!raw) continue
    try { jobs.push({ whole: m[0], url: new URL(raw, base).href, media: (m[5] ?? '').trim() }) } catch { /* geçersiz */ }
  }
  for (const j of jobs) {
    const text = await swFetch(j.url)
    if (text === null) continue
    const inner = await inlineImports(absolutizeUrls(text, j.url), j.url, depth + 1)
    css = css.replace(j.whole, j.media ? `@media ${j.media}{${inner}}` : inner)
  }
  return css
}

/** Okunamayan bir <link> stylesheet'ini indirip yeniden yazılmış kopyayla değiştirir. */
async function replaceExternal(link: HTMLLinkElement, rules: Rule[]): Promise<HTMLStyleElement | null> {
  const href = link.href
  if (!href || link.dataset.rsDone === '1') return null
  /* Kilit await'ten ÖNCE konur: aksi hâlde eşzamanlı taramalar aynı
     stylesheet'i iki kez indirip iki kez değiştiriyor. */
  link.dataset.rsDone = '1'
  const text = await swFetch(href)
  if (text === null) { delete link.dataset.rsDone; return null }

  let css = absolutizeUrls(text, href)
  css = await inlineImports(css, href)

  /* Yalnızca ilgilendiğimiz özellik geçiyorsa değiştir — gereksiz müdahale yok */
  if (!/prefers-color-scheme|prefers-reduced-motion|prefers-contrast|forced-colors|pointer\s*:|hover\s*:|:hover/i.test(css)) {
    link.dataset.rsSkip = '1'
    delete link.dataset.rsDone
    return null
  }
  css = css.replace(/@media([^{]+)\{/gi, (whole, cond) => {
    const next = rewriteCondition(String(cond), rules)
    return next === null ? whole : `@media ${next}{`
  })

  const style = document.createElement('style')
  style.setAttribute(MARK, href)
  if (link.media) style.media = link.media
  style.textContent = css
  link.after(style)
  link.disabled = true
  disabledLinks.push(link)
  injected.push(style)
  return style
}

/* ═══ Stylesheet kaynakları ══════════════════════════════════════════
   `document.styleSheets` modern uygulamalarda yetmiyor:
   • `adoptedStyleSheets` — CSS-in-JS, Lit ve benzeri kütüphanelerin kullandığı
     yapılandırılmış (constructed) stylesheet'ler bu listede DEĞİL.
   • Shadow DOM — web bileşenlerinin kendi kökündeki stiller de görünmüyor.
   Parmak modu gerçek bir SPA'da bu yüzden çalışmıyordu. */

export interface SheetSayim {
  toplam: number
  okunabilir: number
  adopted: number
  shadow: number
  okunamayan: number
}

function shadowKokleri(): ShadowRoot[] {
  const out: ShadowRoot[] = []
  const gez = (kok: ParentNode, derinlik: number) => {
    if (derinlik > 8) return
    let liste: Element[]
    try { liste = Array.from(kok.querySelectorAll('*')) } catch { return }
    for (const el of liste) {
      const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot
      if (sr) { out.push(sr); gez(sr, derinlik + 1) }
    }
  }
  gez(document, 0)
  return out
}

/** Sayfadaki erişilebilir tüm stylesheet'leri toplar. */
function tumSheetler(sayim?: SheetSayim): CSSStyleSheet[] {
  const out: CSSStyleSheet[] = []
  const ekle = (sh: CSSStyleSheet) => { if (sh && !out.includes(sh)) out.push(sh) }

  for (const sh of Array.from(document.styleSheets)) ekle(sh as CSSStyleSheet)
  if (sayim) sayim.toplam = out.length

  const adopted = (document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets
  if (adopted?.length) {
    for (const sh of adopted) ekle(sh)
    if (sayim) sayim.adopted = adopted.length
  }

  const kokler = shadowKokleri()
  if (sayim) sayim.shadow = kokler.length
  for (const kok of kokler) {
    try { for (const sh of Array.from(kok.styleSheets ?? [])) ekle(sh as CSSStyleSheet) } catch { /* yoksay */ }
    const a = (kok as ShadowRoot & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets
    if (a?.length) for (const sh of a) ekle(sh)
  }
  return out
}

/* ═══ Tarama ═════════════════════════════════════════════════════════ */

/** Tüm stylesheet'leri gezip kuralları uygular. Tekrar çağrılabilir. */
export const sonSayim: SheetSayim = { toplam: 0, okunabilir: 0, adopted: 0, shadow: 0, okunamayan: 0 }

async function scanSheets(rules: Rule[], touch: boolean, benimNeslim = nesil) {
  const sayim: SheetSayim = { toplam: 0, okunabilir: 0, adopted: 0, shadow: 0, okunamayan: 0 }
  for (const sheet of tumSheetler(sayim)) {
    if (benimNeslim !== nesil) return   // daha yeni bir uygulama devraldı
    try {
      void sheet.cssRules            // erişim testi
      sayim.okunabilir++
      patchSheet(sheet as CSSStyleSheet, rules)
      if (touch) neutralizeHover(sheet as CSSStyleSheet)
    } catch {
      sayim.okunamayan++
      const owner = sheet.ownerNode
      if (owner instanceof HTMLLinkElement && !owner.dataset.rsSkip) {
        const yeniStil = await replaceExternal(owner, rules)
        if (benimNeslim !== nesil) return
        if (touch && yeniStil?.sheet) {
          try { neutralizeHover(yeniStil.sheet); sayim.okunamayan-- ; sayim.okunabilir++ } catch { /* yoksay */ }
        }
      }
    }
  }
  Object.assign(sonSayim, sayim)
}

let rescanKuruldu = false
function scheduleRescans() {
  if (rescanKuruldu) return
  rescanKuruldu = true
  const tekrar = () => {
    if (!current) return
    void scanSheets(buildRules(current, currentTouch), currentTouch)
  }
  document.addEventListener('DOMContentLoaded', tekrar)
  window.addEventListener('load', tekrar)
  /* Geç yüklenen CSS ve SPA hidratasyonu için birkaç ek deneme */
  for (const ms of [150, 500, 1200, 2500, 5000]) setTimeout(tekrar, ms)
}

/* ═══ Dış API ════════════════════════════════════════════════════════ */

function colorSchemeStyle(scheme: 'auto' | 'light' | 'dark') {
  const id = '__rs_color_scheme__'
  const old = document.getElementById(id)
  if (scheme === 'auto') { old?.remove(); return }
  const el = (old as HTMLStyleElement) ?? document.createElement('style')
  el.id = id
  /* Form kontrolleri, kaydırma çubukları ve varsayılan arka plan da uysun */
  el.textContent = `:root { color-scheme: ${scheme} !important }`
  if (!old) document.documentElement.appendChild(el)
}

export function applyMedia(o: MediaOverrides, touch = false): Promise<void> {
  kuyruk = kuyruk.then(() => applyMediaIci(o, touch)).catch(() => {})
  return kuyruk
}

async function applyMediaIci(o: MediaOverrides, touch = false) {
  const active = touch || o.colorScheme !== 'auto' || o.reducedMotion !== 'auto'
    || o.contrast !== 'auto' || o.forcedColors !== 'auto'

  const benimNeslim = ++nesil
  /* Önce her şeyi eski haline getir — override'lar üst üste binmesin */
  restoreAll()
  nesil = benimNeslim   // restoreAll sıfırlamasın
  current = active ? o : null
  currentTouch = touch
  colorSchemeStyle(o.colorScheme)
  if (touch) { installMouseSuppression(); installTouchScroll() }
  setTouchCursor(touch)
  if (!active) return

  const rules = buildRules(o, touch)
  await scanSheets(rules, touch, benimNeslim)
  if (benimNeslim !== nesil) return

  /* TEKRARLI TARAMA — kritik.
     `document_start`'ta hiçbir stylesheet henüz ayrıştırılmamış olur; yalnızca
     MutationObserver'a güvenmek yetmiyor çünkü bir `<link>`, gözlemci geri
     çağrısı çalışmadan önce yüklenmiş olabiliyor (özellikle tarayıcı önbelleği
     sıcakken) ve 'load' dinleyicisi geç bağlanıyor. Bu yüzden belirli anlarda
     tarama tekrarlanıyor. Tarama fikirsel olarak etkisiz-tekrarlı (idempotent):
     zaten dönüştürülmüş kurallar ikinci kez eşleşmiyor. */
  scheduleRescans()

  /* Sonradan eklenen stylesheet'leri de yakala (SPA'lar, lazy CSS) */
  observer?.disconnect()
  observer = new MutationObserver((records) => {
    if (!current) return
    for (const rec of records) {
      for (const node of Array.from(rec.addedNodes)) {
        if (node instanceof HTMLStyleElement && !node.hasAttribute(MARK)) {
          try { if (node.sheet) { patchSheet(node.sheet, buildRules(current, currentTouch)); if (currentTouch) neutralizeHover(node.sheet) } } catch { /* yoksay */ }
        } else if (node instanceof HTMLLinkElement) {
          /* 'load' beklemek yetmiyor: stylesheet bu geri çağrıdan önce yüklenmiş
             olabilir. Hem hemen hem de yüklenince dene. */
          const dene = () => {
            if (!current) return
            void scanSheets(buildRules(current, currentTouch), currentTouch)
          }
          dene()
          node.addEventListener('load', dene, { once: true })
        }
      }
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

/* ─── :hover kurallarını nötrleme ────────────────────────────────────
   Gerçek bir telefonda `:hover` stilleri hiç uygulanmaz. Media sorgusunu
   değiştirmek yetmez: `:hover` bir sözde-sınıf, media özelliği değil.
   Bu yüzden `:hover` içeren seçici parçaları kuraldan çıkarıyoruz.
   `a:hover, a:focus` gibi birleşik kurallarda yalnızca hover parçası düşer. */
const originalSelectors = new WeakMap<CSSStyleRule, string>()
const NEVER_SELECTOR = '.__rs_hic_eslesmez__'

function neutralizeHover(sheet: CSSStyleSheet) {
  const gez = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule) {
        const sel = r.selectorText
        if (!sel || sel.indexOf(':hover') < 0) continue
        /* Üst düzey virgülleri ayır — parantez içindekilere dokunma */
        const parcalar: string[] = []
        let derinlik = 0, son = 0
        for (let i = 0; i < sel.length; i++) {
          const c = sel[i]
          if (c === '(' || c === '[') derinlik++
          else if (c === ')' || c === ']') derinlik--
          else if (c === ',' && derinlik === 0) { parcalar.push(sel.slice(son, i)); son = i + 1 }
        }
        parcalar.push(sel.slice(son))
        const kalan = parcalar.filter((x) => x.indexOf(':hover') < 0).map((x) => x.trim()).filter(Boolean)
        const yeni = kalan.length ? kalan.join(', ') : NEVER_SELECTOR
        if (yeni === sel) continue
        try {
          if (!originalSelectors.has(r)) originalSelectors.set(r, sel)
          r.selectorText = yeni
        } catch { /* bazı seçiciler yazılamaz */ }
      } else if ('cssRules' in r) {
        try { gez((r as CSSGroupingRule).cssRules) } catch { /* erişilemez */ }
      }
    }
  }
  gez(sheet.cssRules)
}

function restoreHover(sheet: CSSStyleSheet) {
  const gez = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule) {
        const orig = originalSelectors.get(r)
        if (orig !== undefined) {
          try { r.selectorText = orig } catch { /* yoksay */ }
          originalSelectors.delete(r)
        }
      } else if ('cssRules' in r) {
        try { gez((r as CSSGroupingRule).cssRules) } catch { /* erişilemez */ }
      }
    }
  }
  gez(sheet.cssRules)
}

export function restoreAll() {
  observer?.disconnect()
  observer = null
  for (const sheet of tumSheetler()) {
    try { restoreSheet(sheet) } catch { /* erişilemez */ }
    try { restoreHover(sheet) } catch { /* erişilemez */ }
  }
  for (const s of injected) s.remove()
  injected = []
  for (const l of disabledLinks) {
    l.disabled = false
    delete l.dataset.rsDone
  }
  disabledLinks = []
  current = null
  currentTouch = false
  removeMouseSuppression()
  removeTouchScroll()
  setTouchCursor(false)
}

/* ═══ Parmak imleci ══════════════════════════════════════════════════
   Parmak modunun açık olduğunu görsel olarak belli eder. Gerçek bir
   dokunmatik cihazda imleç yoktur; buradaki amaç emülasyonu taklit etmek
   değil, hangi ekranların dokunmatik davrandığını anında göstermek. */

const PARMAK_IMLEC =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='36' viewBox='0 0 32 36'>"
  + "<g fill='none' stroke='%23111' stroke-width='1.6' stroke-linejoin='round'>"
  + "<path d='M11 17V6.5a2.6 2.6 0 0 1 5.2 0V15' fill='%23fff'/>"
  + "<path d='M16.2 15.4v-1.6a2.4 2.4 0 0 1 4.8 0v1.8' fill='%23fff'/>"
  + "<path d='M21 15.8v-.7a2.4 2.4 0 0 1 4.8 0v6.6c0 4.4-3 7.8-7.3 7.8h-2.1c-2 0-3.9-.8-5.3-2.2l-4.4-4.5a2.5 2.5 0 0 1 3.6-3.6l2.7 2.6V17' fill='%23fff'/>"
  + "</g></svg>\") 10 4, pointer"

export function setTouchCursor(enabled: boolean) {
  const id = '__rs_touch_cursor__'
  document.getElementById(id)?.remove()
  if (!enabled) return
  const st = document.createElement('style')
  st.id = id
  st.textContent = `html, html * { cursor: ${PARMAK_IMLEC} !important }`
  document.documentElement.appendChild(st)
}

/* ═══ Fare hover olaylarının bastırılması ════════════════════════════
   CSS `:hover` kurallarını nötrlemek yetmiyor: birçok uygulama hover'ı
   JavaScript ile yapıyor (`onmouseenter` ile sınıf/stil değiştirme).
   Gerçek bir telefonda fare gezdirme olayları HİÇ tetiklenmez; yalnızca
   dokunma dizisinin parçası olarak bir kez gelirler (mobildeki "yapışkan
   hover" hatasının sebebi budur). Burada da aynısı yapılıyor. */

let tapaKadar = 0
let bastirmaTemizle: (() => void) | null = null

const HOVER_OLAYLARI = ['mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'mousemove']

function installMouseSuppression() {
  if (bastirmaTemizle) return
  const down = () => { tapaKadar = Number.POSITIVE_INFINITY }
  const up = () => { tapaKadar = performance.now() + 400 }
  const engelle = (e: Event) => {
    /* Senkron için üretilen yapay olaylar (isTrusted=false) geçsin */
    if (!e.isTrusted) return
    if (performance.now() < tapaKadar) return
    e.stopImmediatePropagation()
  }
  window.addEventListener('pointerdown', down, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('pointercancel', up, true)
  for (const t of HOVER_OLAYLARI) window.addEventListener(t, engelle, true)

  bastirmaTemizle = () => {
    window.removeEventListener('pointerdown', down, true)
    window.removeEventListener('pointerup', up, true)
    window.removeEventListener('pointercancel', up, true)
    for (const t of HOVER_OLAYLARI) window.removeEventListener(t, engelle, true)
  }
}

function removeMouseSuppression() {
  bastirmaTemizle?.()
  bastirmaTemizle = null
  tapaKadar = 0
}

/* ═══ Görme simülasyonu ══════════════════════════════════════════════ */

/**
 * Renk körlüğü matrisleri (Machado, Oliveira & Fernandes 2009 yaklaşımı).
 * feColorMatrix ile uygulanır — GPU'da çalışır, sayfayı yavaşlatmaz.
 */
const VISION_MATRIX: Record<string, string> = {
  protanopia: '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
  protanomaly: '0.817 0.183 0 0 0  0.333 0.667 0 0 0  0 0.125 0.875 0 0  0 0 0 1 0',
  deuteranopia: '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0',
  deuteranomaly: '0.8 0.2 0 0 0  0.258 0.742 0 0 0  0 0.142 0.858 0 0  0 0 0 1 0',
  tritanopia: '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0',
  achromatopsia: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0',
}

export function setVision(sim: string) {
  const styleId = '__rs_vision__'
  const svgId = '__rs_vision_svg__'
  document.getElementById(styleId)?.remove()
  document.getElementById(svgId)?.remove()
  if (!sim || sim === 'none') return

  const simple: Record<string, string> = {
    blur: 'blur(4px)',
    grayscale: 'grayscale(1)',
    contrast: 'contrast(1.8)',
    invert: 'invert(1)',
  }

  let filter: string
  if (simple[sim]) {
    filter = simple[sim]
  } else {
    const matrix = VISION_MATRIX[sim]
    if (!matrix) return
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.id = svgId
    svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none')
    svg.innerHTML =
      `<filter id="rs-vision" color-interpolation-filters="linearRGB">` +
      `<feColorMatrix type="matrix" values="${matrix}"/></filter>`
    document.documentElement.appendChild(svg)
    filter = 'url(#rs-vision)'
  }

  const st = document.createElement('style')
  st.id = styleId
  st.textContent = `html { filter: ${filter} !important }`
  document.documentElement.appendChild(st)
}

/* ═══ Metin ölçekleme testi ══════════════════════════════════════════ */

/**
 * Tarayıcı metin boyutu ayarını taklit eder. WCAG 1.4.4, metnin %200'e kadar
 * büyütülebilmesini ve içeriğin kaybolmamasını şart koşar.
 */
export function setTextScale(percent: number) {
  const id = '__rs_textscale__'
  document.getElementById(id)?.remove()
  if (!percent || percent === 100) return
  const st = document.createElement('style')
  st.id = id
  st.textContent = `html { font-size: ${percent}% !important }`
  document.documentElement.appendChild(st)
}
