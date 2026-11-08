/**
 * ERİŞİLEBİLİRLİK DENETİMLERİ — çerçeve içinde çalışır.
 *
 * Kendi odaklı denetimlerimiz (kontrast, başlık yapısı, landmark, alt metin,
 * tab sırası, dokunma hedefi) + isteğe bağlı axe-core taraması.
 * axe-core yalnızca kullanıcı denetimi başlattığında dinamik olarak yüklenir;
 * her sayfaya sürekli 500 KB enjekte edilmez.
 */
import type {
  AxeIssue, ContrastIssue, HeadingNode, ImageIssue, LandmarkNode, PwaReport, TabStop, TargetIssue,
} from '@/lib/types'

/* ═══ Renk yardımcıları ══════════════════════════════════════════════ */

type RGBA = [number, number, number, number]

function parseColor(v: string): RGBA | null {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)/i.exec(v)
  if (!m) return null
  let a = 1
  if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return [+m[1], +m[2], +m[3], a]
}

/** İki rengi alfa karışımıyla birleştirir (üst → alt). */
function blend(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3] + bottom[3] * (1 - top[3])
  if (a === 0) return [0, 0, 0, 0]
  return [
    (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / a,
    (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / a,
    (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / a,
    a,
  ]
}

function luminance([r, g, b]: RGBA): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrastRatio(a: RGBA, b: RGBA): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

function hex(c: RGBA): string {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`
}

/**
 * Bir elemanın gerçek arka planını bulur: saydam olmayan ilk ataya kadar
 * katmanları karıştırır. Arka planda görsel/gradyan varsa "belirsiz" işaretler.
 */
function effectiveBackground(el: Element): { color: RGBA; uncertain: boolean } {
  let acc: RGBA = [0, 0, 0, 0]
  let node: Element | null = el
  let uncertain = false
  let depth = 0

  while (node && depth++ < 30) {
    const cs = getComputedStyle(node)
    if (cs.backgroundImage && cs.backgroundImage !== 'none') uncertain = true
    const c = parseColor(cs.backgroundColor)
    if (c && c[3] > 0) {
      acc = blend(acc, c)
      if (acc[3] >= 0.99) return { color: acc, uncertain }
    }
    node = node.parentElement
  }
  /* Hiç opak arka plan yoksa beyaz kabul et (tarayıcı varsayılanı) */
  return { color: blend(acc, [255, 255, 255, 1]), uncertain }
}

/* ═══ 1. Kontrast denetimi ═══════════════════════════════════════════ */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'IFRAME'])

export function scanContrast(pathOf: (el: Element) => string): ContrastIssue[] {
  const out: ContrastIssue[] = []
  const seen = new Set<string>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n = 0

  while (walker.nextNode() && n < 4000) {
    const node = walker.currentNode as Text
    const text = (node.nodeValue ?? '').trim()
    if (text.length < 2) continue
    const el = node.parentElement
    if (!el || SKIP_TAGS.has(el.tagName)) continue
    n++

    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue

    const fgRaw = parseColor(cs.color)
    if (!fgRaw) continue
    const { color: bg, uncertain } = effectiveBackground(el)
    const fg = fgRaw[3] < 1 ? blend(fgRaw, bg) : fgRaw

    const size = parseFloat(cs.fontSize)
    const weight = parseInt(cs.fontWeight) || 400
    const bold = weight >= 700
    /* WCAG "büyük metin": 18pt (24px) veya kalınsa 14pt (18.66px) */
    const large = size >= 24 || (bold && size >= 18.66)
    const ratio = contrastRatio(fg, bg)

    const needAA = large ? 3 : 4.5
    const needAAA = large ? 4.5 : 7
    const level: ContrastIssue['level'] = ratio >= needAAA ? 'AAA' : ratio >= needAA ? 'AA' : 'fail'
    if (level !== 'fail') continue // yalnızca sorunları raporla

    const key = `${hex(fg)}|${hex(bg)}|${Math.round(size)}|${bold}`
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      path: pathOf(el),
      text: text.slice(0, 70),
      fg: hex(fg),
      bg: hex(bg),
      ratio: Math.round(ratio * 100) / 100,
      size: Math.round(size * 10) / 10,
      bold,
      large,
      level,
      uncertain,
    })
    if (out.length >= 80) break
  }
  return out.sort((a, b) => a.ratio - b.ratio)
}

/* ═══ 2. Başlık yapısı ═══════════════════════════════════════════════ */

export function scanHeadings(pathOf: (el: Element) => string): HeadingNode[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(
    'h1,h2,h3,h4,h5,h6,[role=heading][aria-level]'))
  const out: HeadingNode[] = []
  let prev = 0
  for (const el of nodes) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const lvl = el.tagName.startsWith('H')
      ? +el.tagName[1]
      : +(el.getAttribute('aria-level') ?? '2')
    const skipped = prev > 0 && lvl > prev + 1
    out.push({
      level: lvl,
      text: (el.textContent ?? '').trim().slice(0, 90) || '(boş başlık)',
      path: pathOf(el),
      skipped,
    })
    prev = lvl
  }
  return out
}

/* ═══ 3. Landmark / ARIA ═════════════════════════════════════════════ */

const IMPLICIT_ROLE: Record<string, string> = {
  HEADER: 'banner', NAV: 'navigation', MAIN: 'main', ASIDE: 'complementary',
  FOOTER: 'contentinfo', FORM: 'form', SECTION: 'region', SEARCH: 'search',
}

export function scanLandmarks(pathOf: (el: Element) => string): LandmarkNode[] {
  const sel = 'header,nav,main,aside,footer,form,section,search,[role]'
  const out: LandmarkNode[] = []
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
    const explicit = el.getAttribute('role')
    let role = explicit ?? IMPLICIT_ROLE[el.tagName] ?? ''
    /* header/footer yalnızca en üst düzeyde landmark sayılır */
    if (!explicit && (el.tagName === 'HEADER' || el.tagName === 'FOOTER')) {
      if (el.closest('article,section,main,aside,nav')) role = ''
    }
    if (!explicit && (el.tagName === 'SECTION' || el.tagName === 'FORM')) {
      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) role = ''
    }
    if (!role) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none') continue
    out.push({
      role,
      label: el.getAttribute('aria-label')
        ?? document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent?.trim().slice(0, 60)
        ?? '',
      tag: el.tagName.toLowerCase(),
      path: pathOf(el),
    })
  }
  return out
}

/* ═══ 4. Alt metin denetimi ══════════════════════════════════════════ */

export function scanImages(pathOf: (el: Element) => string): ImageIssue[] {
  const out: ImageIssue[] = []
  for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('img'))) {
    const cs = getComputedStyle(img)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const alt = img.getAttribute('alt')
    const aria = img.getAttribute('aria-label') || img.getAttribute('aria-labelledby')
    const hidden = img.getAttribute('aria-hidden') === 'true' || img.getAttribute('role') === 'presentation'
    const decorative = alt === '' || hidden

    let issue: string | null = null
    if (alt === null && !aria && !hidden) issue = 'alt niteliği yok'
    else if (alt && /^(image|görsel|resim|photo|picture|img|logo)?[\s_-]*\.?(jpe?g|png|gif|webp|svg)?$/i.test(alt.trim()))
      issue = 'alt metni anlamsız'
    else if (alt && alt.trim().length > 160) issue = 'alt metni çok uzun'
    else if (!decorative && img.closest('a') && !(alt ?? '').trim() && !aria)
      issue = 'bağlantı içindeki görselin erişilebilir adı yok'

    out.push({
      src: (img.currentSrc || img.src || '').split('/').pop()?.slice(0, 50) ?? '',
      alt,
      decorative,
      issue,
      path: pathOf(img),
    })
  }
  /* Sorunlular önce */
  return out.sort((a, b) => Number(!!b.issue) - Number(!!a.issue)).slice(0, 120)
}

/* ═══ 5. Tab sırası ══════════════════════════════════════════════════ */

const FOCUSABLE =
  'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable=""],[contenteditable=true]'

export function scanTabOrder(pathOf: (el: Element) => string): TabStop[] {
  const els = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => {
      if (el.hasAttribute('disabled')) return false
      const ti = el.getAttribute('tabindex')
      if (ti !== null && +ti < 0) return false
      if (el.getAttribute('aria-hidden') === 'true') return false
      const cs = getComputedStyle(el)
      return cs.display !== 'none' && cs.visibility !== 'hidden'
    })

  /* Pozitif tabindex önce gelir — bu zaten bir anti-pattern, raporda görünsün */
  const positive = els.filter((e) => +(e.getAttribute('tabindex') ?? '0') > 0)
    .sort((a, b) => +(a.getAttribute('tabindex') ?? 0) - +(b.getAttribute('tabindex') ?? 0))
  const natural = els.filter((e) => +(e.getAttribute('tabindex') ?? '0') === 0)

  return [...positive, ...natural].slice(0, 150).map((el, i) => {
    const r = el.getBoundingClientRect()
    return {
      index: i + 1,
      tag: el.tagName.toLowerCase(),
      label: accessibleName(el).slice(0, 60) || '(ad yok)',
      path: pathOf(el),
      tabindex: el.getAttribute('tabindex') ?? '—',
      visible: r.width > 0 && r.height > 0,
    }
  })
}

function accessibleName(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return aria.trim()
  const by = el.getAttribute('aria-labelledby')
  if (by) {
    const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    if (t) return t
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const lbl = el.labels?.[0]?.textContent?.trim()
    if (lbl) return lbl
    if (el.getAttribute('placeholder')) return `(placeholder) ${el.getAttribute('placeholder')}`
    if (el instanceof HTMLInputElement && el.value && el.type === 'submit') return el.value
  }
  if (el instanceof HTMLImageElement) return el.alt
  const title = el.getAttribute('title')
  const text = (el.textContent ?? '').trim()
  return text || title || ''
}

/* ═══ 6. Dokunma hedefi boyutu ═══════════════════════════════════════ */

/** WCAG 2.2 (2.5.8) asgari 24×24 CSS px; Apple ve Google 44×44 önerir. */
export function scanTargets(pathOf: (el: Element) => string): TargetIssue[] {
  const out: TargetIssue[] = []
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(
    'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab]'))) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    /* Satır içi metin bağlantıları bu kuralın dışında tutulur */
    if (el.tagName === 'A' && cs.display.includes('inline') && r.height < 24 && (el.textContent ?? '').trim()) {
      const parentText = el.parentElement?.textContent ?? ''
      if (parentText.trim().length > (el.textContent ?? '').trim().length + 10) continue
    }
    if (r.width < 44 || r.height < 44) {
      out.push({
        path: pathOf(el),
        tag: el.tagName.toLowerCase(),
        label: accessibleName(el).slice(0, 50) || '(ad yok)',
        w: Math.round(r.width),
        h: Math.round(r.height),
      })
    }
  }
  return out.sort((a, b) => a.w * a.h - b.w * b.h).slice(0, 80)
}

/* ═══ 7. axe-core taraması (isteğe bağlı, dinamik yüklenir) ══════════ */

interface AxeGlobal {
  run(ctx: unknown, opts: unknown): Promise<{
    violations: {
      id: string; impact: string | null; help: string; description: string; helpUrl: string
      nodes: { target: string[]; failureSummary?: string }[]
    }[]
    passes: unknown[]
  }>
}

let axePromise: Promise<AxeGlobal | null> | null = null

function loadAxe(): Promise<AxeGlobal | null> {
  if (axePromise) return axePromise
  axePromise = (async () => {
    try {
      /* axe-core UMD dosyası web_accessible_resources içinde; yalnızca burada,
         kullanıcı denetimi başlattığında yüklenir. */
      await import(/* @vite-ignore */ chrome.runtime.getURL('axe.min.js'))
      return (globalThis as unknown as { axe?: AxeGlobal }).axe ?? null
    } catch {
      return null
    }
  })()
  return axePromise
}

export async function scanAxe(): Promise<{ issues: AxeIssue[]; passes: number; error?: string }> {
  const axe = await loadAxe()
  if (!axe) return { issues: [], passes: 0, error: 'axe-core yüklenemedi' }
  try {
    const res = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    })
    return {
      passes: res.passes.length,
      issues: res.violations.slice(0, 60).map((v) => ({
        id: v.id,
        impact: v.impact ?? 'minor',
        help: v.help,
        description: v.description,
        helpUrl: v.helpUrl,
        nodes: v.nodes.slice(0, 8).map((n) => ({
          path: n.target.join(' '),
          summary: (n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 180),
        })),
      })),
    }
  } catch (e) {
    return { issues: [], passes: 0, error: String((e as Error).message).slice(0, 140) }
  }
}

/* ═══ 8. PWA / favicon denetimi ══════════════════════════════════════ */

function swFetchJson(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ t: 'fetch', url, kind: 'manifest' }, (r) => {
        void chrome.runtime.lastError
        resolve(r?.ok && r.text ? (r.text as string) : null)
      })
    } catch { resolve(null) }
  })
}

export async function scanPwa(): Promise<PwaReport> {
  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel=manifest]')
  const report: PwaReport = {
    manifest: { url: manifestLink?.href ?? null, ok: false },
    icons: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~=icon],link[rel=apple-touch-icon]'))
      .map((l) => ({ rel: l.rel, href: l.href, sizes: l.getAttribute('sizes') ?? '—' })),
    themeColor: document.querySelector<HTMLMetaElement>('meta[name=theme-color]')?.content ?? null,
    appleTouchIcon: !!document.querySelector('link[rel=apple-touch-icon]'),
    serviceWorker: false,
    httpsOk: location.protocol === 'https:' || location.hostname === 'localhost',
  }

  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.()
    report.serviceWorker = !!regs?.length
  } catch { /* erişilemedi */ }

  if (manifestLink?.href) {
    const text = await swFetchJson(manifestLink.href)
    if (text === null) {
      report.manifest.error = 'manifest indirilemedi'
    } else {
      try {
        const m = JSON.parse(text)
        report.manifest.ok = true
        report.manifest.name = m.name ?? m.short_name ?? ''
        report.manifest.icons = Array.isArray(m.icons) ? m.icons.length : 0
        report.manifest.display = m.display ?? ''
        report.manifest.themeColor = m.theme_color ?? ''
        report.manifest.startUrl = m.start_url ?? ''
      } catch {
        report.manifest.error = 'manifest geçerli JSON değil'
      }
    }
  }
  return report
}
