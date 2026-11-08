/**
 * İNCELEME ARAÇLARI — çerçeve içinde çalışır (ISOLATED world).
 *
 * Tüm görsel bindirmeler kapalı bir Shadow DOM içinde tutulur; sayfanın kendi
 * DOM'u ve stilleri hiçbir şekilde kirletilmez, sayfa da bindirmelerimizi
 * göremez/etkileyemez.
 */
import type { ElementInfo, GridOptions, InspectTool, ScanKind, ScanResult } from '@/lib/types'
import {
  scanAxe, scanContrast, scanHeadings, scanImages, scanLandmarks, scanPwa, scanTabOrder, scanTargets,
} from './a11y'
import { setTouchScrollEnabled } from './touch'

/**
 * Cross-origin ağ isteği — service worker üzerinden.
 *
 * MV3'te content script'lerin cross-origin fetch ayrıcalığı kaldırıldı; istekler
 * sayfanın CORS kurallarına tabi. Host izinlerine sahip olan service worker ise
 * her adrese erişebilir, bu yüzden bağlantı denetimi ve dış stylesheet indirme
 * oradan yapılıyor.
 */
function swFetch(url: string, text = false): Promise<{ ok: boolean; status: number; text?: string }> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ t: 'fetch', url, kind: text ? 'css' : undefined }, (r) => {
        void chrome.runtime.lastError
        resolve(r ?? { ok: false, status: 0 })
      })
    } catch {
      resolve({ ok: false, status: 0 })
    }
  })
}

const HOST_ID = '__rs_overlay__'
let root: ShadowRoot | null = null
let layer: HTMLDivElement | null = null
let styleEl: HTMLStyleElement | null = null

function ensureRoot(): { root: ShadowRoot; layer: HTMLDivElement } {
  if (root && layer && document.documentElement.contains(root.host)) return { root, layer }
  const host = document.createElement('div')
  host.id = HOST_ID
  host.setAttribute('style', 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647')
  document.documentElement.appendChild(host)
  root = host.attachShadow({ mode: 'closed' })
  styleEl = document.createElement('style')
  styleEl.textContent = `
    :host { all: initial }
    .l { position: fixed; inset: 0; pointer-events: none; overflow: hidden }
    .box { position: absolute; box-sizing: border-box; pointer-events: none }
    .hl { background: rgba(99,102,241,.22); outline: 1px solid #6366f1 }
    .hl-pad { background: rgba(52,211,153,.20) }
    .hl-mar { background: rgba(251,191,36,.16) }
    .of { outline: 2px solid #f87171; background: rgba(248,113,113,.14) }
    .tip {
      position: absolute; pointer-events: none; max-width: 300px;
      background: #0b0e14; color: #e6eaf2; border: 1px solid #2f3949;
      border-radius: 6px; padding: 5px 8px; font: 11px/1.45 ui-monospace, Menlo, monospace;
      box-shadow: 0 6px 20px rgba(0,0,0,.5); white-space: nowrap;
    }
    .tip b { color: #818cf8 }
    .tip i { color: #34d399; font-style: normal }
    .grid { position: fixed; inset: 0; pointer-events: none }
  `
  root.appendChild(styleEl)
  layer = document.createElement('div')
  layer.className = 'l'
  root.appendChild(layer)
  return { root, layer }
}

function clearLayer() {
  if (layer) layer.textContent = ''
}

/* ═══ Sayfa içi yardımcı stil (kontur, filtre) ═══════════════════════ */

/** Araç imleci. Parmak modu `html * { cursor: … !important }` uyguladığı için
    satır içi stil yetmiyor; eşit özgüllükte sonradan eklenen kural kazanır. */
function toolCursor(cursor: string | null) {
  const id = '__rs_tool_cursor__'
  document.getElementById(id)?.remove()
  if (!cursor) return
  const el = document.createElement('style')
  el.id = id
  el.textContent = `html, html * { cursor: ${cursor} !important }`
  document.documentElement.appendChild(el)
}

function pageStyle(id: string, css: string | null) {
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (css === null) { el?.remove(); return }
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.documentElement.appendChild(el)
  }
  el.textContent = css
}

/* ═══ Araç yönetimi ══════════════════════════════════════════════════ */

let active: InspectTool = 'none'
let gridOpts: GridOptions = { columns: 12, gutter: 24, maxWidth: 1200, baseline: 0, square: 0 }
let onInspect: ((info: ElementInfo) => void) | null = null
let onOverflow: ((items: { path: string; tag: string; right: number }[]) => void) | null = null
let pathOf: (el: Element) => string = () => ''

export function initInspect(opts: {
  pathOf: (el: Element) => string
  onInspect: (info: ElementInfo) => void
  onOverflow: (items: { path: string; tag: string; right: number }[]) => void
}) {
  pathOf = opts.pathOf
  onInspect = opts.onInspect
  onOverflow = opts.onOverflow
}

export function setTool(tool: InspectTool, grid?: GridOptions) {
  if (grid) gridOpts = grid
  if (active === tool && tool !== 'grid') tool = 'none'
  teardown(active)
  active = tool
  /* Denetçi ve cetvel sürüklemeyi kendileri kullanıyor — parmak kaydırması sussun */
  setTouchScrollEnabled(tool !== 'inspect' && tool !== 'measure')
  switch (tool) {
    case 'outline': applyOutline(); break
    case 'overflow': applyOverflow(); break
    case 'grid': applyGrid(); break
    case 'inspect': startInspect(); break
    case 'measure': startMeasure(); break
    default: break
  }
}

export function currentTool() { return active }

function teardown(tool: InspectTool) {
  clearLayer()
  pageStyle('__rs_outline__', null)
  window.removeEventListener('scroll', onScrollRedraw, true)
  window.removeEventListener('resize', onScrollRedraw)
  document.removeEventListener('pointermove', onInspectMove, true)
  document.removeEventListener('click', onInspectClick, true)
  document.removeEventListener('pointermove', onMeasureMove, true)
  document.removeEventListener('pointerdown', onMeasureDown, true)
  document.removeEventListener('pointerup', onMeasureUp, true)
  document.removeEventListener('keydown', onMeasureKey, true)
  document.removeEventListener('pointerleave', onMeasureLeave, true)
  measureStart = null
  if (tool === 'inspect' || tool === 'measure') {
    document.documentElement.style.cursor = ''
    toolCursor(null)
  }
}

const onScrollRedraw = () => {
  if (active === 'overflow') applyOverflow()
  else if (active === 'grid') applyGrid()
}

/* ─── 1. Kontur (tüm elemanların sınırlarını göster) ───────────────── */

function applyOutline() {
  pageStyle('__rs_outline__', `
    * { outline: 1px solid rgba(99,102,241,.35) !important }
    div,section,article,main,aside,nav,header,footer { outline-color: rgba(99,102,241,.5) !important }
    img,video,picture,svg,canvas { outline: 1px solid rgba(52,211,153,.75) !important }
    a,button,input,select,textarea,label { outline: 1px solid rgba(251,191,36,.8) !important }
    h1,h2,h3,h4,h5,h6,p,li,span { outline: 1px dashed rgba(248,113,113,.35) !important }
  `)
}

/* ─── 2. Yatay taşma dedektörü ─────────────────────────────────────── */

function applyOverflow() {
  const { layer } = ensureRoot()
  layer.textContent = ''
  const limit = document.documentElement.clientWidth
  const found: { el: Element; right: number; left: number }[] = []

  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const over = r.right - limit
    if (over > 1 || r.left < -1) found.push({ el, right: r.right, left: r.left })
  }

  /* İç içe suçlulardan yalnızca en dıştakileri göster — liste okunur kalsın */
  const outer = found.filter((f) => !found.some((g) => g !== f && g.el.contains(f.el)))

  for (const f of outer.slice(0, 40)) {
    const r = f.el.getBoundingClientRect()
    const b = document.createElement('div')
    b.className = 'box of'
    b.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`
    layer.appendChild(b)
  }
  /* Sayfa genişlik sınırını gösteren kırmızı dikey çizgi */
  const line = document.createElement('div')
  line.className = 'box'
  line.style.cssText = `left:${limit - 1}px;top:0;width:2px;height:100%;background:#f87171;opacity:.7`
  layer.appendChild(line)

  window.addEventListener('scroll', onScrollRedraw, true)
  window.addEventListener('resize', onScrollRedraw)

  onOverflow?.(outer.slice(0, 40).map((f) => ({
    path: pathOf(f.el),
    tag: describe(f.el),
    right: Math.round(f.right - limit),
  })))
}

function describe(el: Element): string {
  const id = el.id ? `#${el.id}` : ''
  const cls = typeof el.className === 'string' && el.className
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : ''
  return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 60)
}

/* ─── 3. Izgara bindirmesi ─────────────────────────────────────────── */

function applyGrid() {
  const { layer } = ensureRoot()
  layer.textContent = ''
  const g = gridOpts
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight

  if (g.columns > 0) {
    const width = Math.min(g.maxWidth || vw, vw)
    const left = (vw - width) / 2
    const colW = (width - g.gutter * (g.columns - 1)) / g.columns
    for (let i = 0; i < g.columns; i++) {
      const c = document.createElement('div')
      c.className = 'box'
      c.style.cssText = `left:${left + i * (colW + g.gutter)}px;top:0;width:${colW}px;height:${vh}px;`
        + 'background:rgba(99,102,241,.13);outline:1px solid rgba(99,102,241,.2)'
      layer.appendChild(c)
    }
  }
  if (g.baseline > 0) {
    const off = -(window.scrollY % g.baseline)
    const b = document.createElement('div')
    b.className = 'grid'
    b.style.cssText = `background:repeating-linear-gradient(to bottom,rgba(248,113,113,.28) 0 1px,transparent 1px ${g.baseline}px);`
      + `background-position:0 ${off}px`
    layer.appendChild(b)
  }
  if (g.square > 0) {
    const ox = -(window.scrollX % g.square)
    const oy = -(window.scrollY % g.square)
    const sq = document.createElement('div')
    sq.className = 'grid'
    sq.style.cssText =
      `background-image:linear-gradient(to right,rgba(52,211,153,.22) 0 1px,transparent 1px),` +
      `linear-gradient(to bottom,rgba(52,211,153,.22) 0 1px,transparent 1px);` +
      `background-size:${g.square}px ${g.square}px;background-position:${ox}px ${oy}px`
    layer.appendChild(sq)
  }
  window.addEventListener('scroll', onScrollRedraw, true)
  window.addEventListener('resize', onScrollRedraw)
}

/* ─── 4. Eleman denetçisi ──────────────────────────────────────────── */

function startInspect() {
  ensureRoot()
  toolCursor('crosshair')
  /* pointer* kullanılıyor: parmak modunda mouse* olayları bastırıldığı için
     (bkz. media.ts) denetçi ve cetvel aksi hâlde çalışmazdı. */
  document.addEventListener('pointermove', onInspectMove, true)
  document.addEventListener('click', onInspectClick, true)
}

function onInspectMove(e: PointerEvent) {
  const el = e.target as Element | null
  if (!el || el.nodeType !== 1) return
  drawBoxModel(el)
}

function onInspectClick(e: MouseEvent) {
  const el = e.target as Element | null
  if (!el || el.nodeType !== 1) return
  e.preventDefault()
  e.stopPropagation()
  onInspect?.(elementInfo(el))
}

function px(v: string) { return Math.round(parseFloat(v) || 0) }

/** Kutu modelini (margin / border / padding / content) katman katman çizer. */
function drawBoxModel(el: Element) {
  const { layer } = ensureRoot()
  layer.textContent = ''
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const m = { t: px(cs.marginTop), r: px(cs.marginRight), b: px(cs.marginBottom), l: px(cs.marginLeft) }
  const p = { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) }

  const mar = document.createElement('div')
  mar.className = 'box hl-mar'
  mar.style.cssText = `left:${r.left - m.l}px;top:${r.top - m.t}px;width:${r.width + m.l + m.r}px;height:${r.height + m.t + m.b}px`
  layer.appendChild(mar)

  const box = document.createElement('div')
  box.className = 'box hl'
  box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`
  layer.appendChild(box)

  const pad = document.createElement('div')
  pad.className = 'box hl-pad'
  pad.style.cssText = `left:${r.left + p.l}px;top:${r.top + p.t}px;`
    + `width:${Math.max(0, r.width - p.l - p.r)}px;height:${Math.max(0, r.height - p.t - p.b)}px`
  layer.appendChild(pad)

  const tip = document.createElement('div')
  tip.className = 'tip'
  tip.innerHTML = `<b>${escapeHtml(describe(el))}</b><br>`
    + `${Math.round(r.width)} × ${Math.round(r.height)}`
    + (m.t || m.r || m.b || m.l ? ` &nbsp;<i>m</i> ${m.t} ${m.r} ${m.b} ${m.l}` : '')
    + (p.t || p.r || p.b || p.l ? ` &nbsp;<i>p</i> ${p.t} ${p.r} ${p.b} ${p.l}` : '')
  const top = r.top > 46 ? r.top - 42 : r.bottom + 8
  tip.style.cssText = `left:${Math.max(4, Math.min(r.left, document.documentElement.clientWidth - 260))}px;top:${top}px`
  layer.appendChild(tip)
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

function elementInfo(el: Element): ElementInfo {
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const pick = [
    'display', 'position', 'width', 'height', 'flex-direction', 'justify-content', 'align-items',
    'grid-template-columns', 'gap', 'font-family', 'font-size', 'font-weight', 'line-height',
    'color', 'background-color', 'border-radius', 'z-index', 'overflow', 'opacity', 'transform',
  ]
  const styles: Record<string, string> = {}
  for (const k of pick) {
    const v = cs.getPropertyValue(k)
    if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px') styles[k] = v
  }
  return {
    path: pathOf(el),
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    classes: typeof el.className === 'string' ? el.className.trim() : '',
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    margin: `${px(cs.marginTop)} ${px(cs.marginRight)} ${px(cs.marginBottom)} ${px(cs.marginLeft)}`,
    padding: `${px(cs.paddingTop)} ${px(cs.paddingRight)} ${px(cs.paddingBottom)} ${px(cs.paddingLeft)}`,
    border: cs.borderWidth === '0px' ? '' : `${cs.borderWidth} ${cs.borderStyle} ${cs.borderColor}`,
    styles,
    text: (el.textContent ?? '').trim().slice(0, 120),
  }
}

/** Geçici vurgu kalkınca, açık olan bindirme aracını geri çizer. */
function restoreActive() {
  clearLayer()
  if (active === 'grid') applyGrid()
  else if (active === 'overflow') applyOverflow()
}

/** Başka bir çerçevede seçilen elemanın eşleniğini bu çerçevede vurgular. */
export function highlightPath(path: string | null, resolve: (p: string) => Element | null) {
  if (!path) { restoreActive(); return }
  const el = resolve(path)
  if (!el) { restoreActive(); return }
  el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  drawBoxModel(el)
}

/* ─── 5. Cetvel ve ölçüm aracı ─────────────────────────────────────── */

let measureStart: { x: number; y: number } | null = null
let measureLast = { x: 0, y: 0 }

function startMeasure() {
  ensureRoot()
  toolCursor('crosshair')
  document.addEventListener('pointermove', onMeasureMove, true)
  document.addEventListener('pointerdown', onMeasureDown, true)
  document.addEventListener('pointerup', onMeasureUp, true)
  document.addEventListener('keydown', onMeasureKey, true)
  document.addEventListener('pointerleave', onMeasureLeave, true)
  /* Fare bu çerçeveye girene kadar hiçbir şey çizme — araç tüm ekranlara
     yayınlandığı için aksi hâlde hepsinde boş kılavuz belirir. */
}

function onMeasureLeave(e: PointerEvent) {
  if (e.target !== document && e.target !== document.documentElement) return
  if (measureStart) return  // ölçüm sürüyorsa koru
  clearLayer()
}

function onMeasureDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault(); e.stopPropagation()
  measureStart = { x: e.clientX, y: e.clientY }
  measureLast = { x: e.clientX, y: e.clientY }
  drawMeasure()
}

function onMeasureMove(e: PointerEvent) {
  measureLast = { x: e.clientX, y: e.clientY }
  drawMeasure(e.target as Element | null)
}

function onMeasureUp(e: PointerEvent) {
  /* Bırakınca ölçüm kalıcı olsun — kullanıcı okuyabilsin */
  e.preventDefault(); e.stopPropagation()
}

function onMeasureKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { measureStart = null; drawMeasure() }
}

/** Artı kılavuzlar + sürükleyerek mesafe ölçümü + üzerindeki elemanın ölçüsü. */
function drawMeasure(hovered?: Element | null) {
  const { layer } = ensureRoot()
  layer.textContent = ''
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const { x, y } = measureLast

  const line = (css: string) => {
    const d = document.createElement('div')
    d.className = 'box'
    d.style.cssText = css
    layer.appendChild(d)
    return d
  }

  /* Artı kılavuzlar */
  line(`left:0;top:${y}px;width:${vw}px;height:1px;background:rgba(99,102,241,.55)`)
  line(`left:${x}px;top:0;width:1px;height:${vh}px;background:rgba(99,102,241,.55)`)

  /* Üzerinde durulan elemanın ölçüsü ve kenarlara uzaklığı */
  if (hovered && hovered.nodeType === 1 && !measureStart) {
    const r = hovered.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      line(`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`
        + 'outline:1px dashed rgba(52,211,153,.9);background:rgba(52,211,153,.10)')
      tip(`${Math.round(r.width)} × ${Math.round(r.height)}`, r.left, r.top > 30 ? r.top - 26 : r.bottom + 6)
    }
  }

  /* Sürükleyerek ölçüm */
  if (measureStart) {
    const dx = x - measureStart.x
    const dy = y - measureStart.y
    const dist = Math.round(Math.hypot(dx, dy))
    const x0 = Math.min(measureStart.x, x)
    const y0 = Math.min(measureStart.y, y)
    line(`left:${x0}px;top:${y0}px;width:${Math.abs(dx)}px;height:${Math.abs(dy)}px;`
      + 'outline:1px solid #fbbf24;background:rgba(251,191,36,.14)')
    /* Yatay ve dikey bileşen çizgileri */
    line(`left:${x0}px;top:${measureStart.y}px;width:${Math.abs(dx)}px;height:2px;background:#fbbf24`)
    line(`left:${x}px;top:${y0}px;width:2px;height:${Math.abs(dy)}px;background:#fbbf24`)
    tip(`${Math.abs(Math.round(dx))} × ${Math.abs(Math.round(dy))} px  ·  ${dist} px köşegen`,
      Math.min(x + 12, vw - 220), y + 12)
  } else {
    tip(`${Math.round(x)}, ${Math.round(y)}  ·  sürükleyerek ölç`, Math.min(x + 12, vw - 200), y + 12)
  }

  function tip(text: string, left: number, top: number) {
    const t = document.createElement('div')
    t.className = 'tip'
    t.textContent = text
    t.style.cssText = `left:${Math.max(2, left)}px;top:${Math.max(2, top)}px`
    layer.appendChild(t)
  }
}

/* ─── 6. Görsel filtre (bulanıklık / gri ton testi) ────────────────── */

export function setFilter(value: string | null) {
  pageStyle('__rs_filter__', value ? `html { filter: ${value} !important }` : null)
}

/* ─── 6. Yükseklik zorlama (tam sayfa ekran görüntüsü için) ────────── */

let savedHtmlHeight: string | null = null
export function forceHeight(h: number | null) {
  const de = document.documentElement
  if (h === null) {
    if (savedHtmlHeight !== null) de.style.height = savedHtmlHeight
    savedHtmlHeight = null
    return
  }
  if (savedHtmlHeight === null) savedHtmlHeight = de.style.height
  de.style.height = `${h}px`
}

/* ═══ Tarama işlemleri ═══════════════════════════════════════════════ */

export async function runScan(what: ScanKind): Promise<ScanResult> {
  switch (what) {
    case 'breakpoints': return { breakpoints: await scanBreakpoints() }
    case 'links': return { links: await scanLinks() }
    case 'assets': return { assets: scanAssets() }
    case 'fonts': return { fonts: scanFonts() }
    case 'vitals': return { vitals: readVitals() }
    case 'meta': return { meta: scanMeta() }
    /* ── Faz 3 ── */
    case 'contrast': return { contrast: scanContrast(pathOf) }
    case 'headings': return { headings: scanHeadings(pathOf) }
    case 'landmarks': return { landmarks: scanLandmarks(pathOf) }
    case 'images': return { images: scanImages(pathOf) }
    case 'tabOrder': return { tabOrder: scanTabOrder(pathOf) }
    case 'targets': return { targets: scanTargets(pathOf) }
    case 'axe': return { axe: await scanAxe() }
    case 'pwa': return { pwa: await scanPwa() }
    /* ── Faz 4 ── */
    case 'cssvars': return { cssvars: await scanCssVars() }
    case 'storage': return { storage: scanStorage() }
    case 'touchDiag': return { touchDiag: touchTanisi() }
  }
}

/* ─── Parmak modu tanısı ───────────────────────────────────────────── */

/**
 * Parmak modunun bu çerçevede tam olarak ne yapabildiğini raporlar.
 * Bir sitede beklendiği gibi çalışmıyorsa nerede takıldığını gösterir:
 * okunamayan stylesheet mi kaldı, hover kuralı mı duruyor, imleç var mı.
 */
function touchTanisi() {
  let hoverKurali = 0
  let hoverMediaKurali = 0
  let yenidenYazilan = 0
  let okunamayan = 0
  let okunabilir = 0
  const ornekler: string[] = []

  /* media.ts bu iki işaretleyiciyi kullanıyor: her zaman / hiçbir zaman eşleşen
     koşullar. Sayfada görülmeleri yeniden yazımın gerçekten uygulandığını kanıtlar. */
  const HER_ZAMAN = '(min-width: 0px)'
  const ASLA = '(min-width: 999999px)'

  const sayKurallar = (rules: CSSRuleList, derinlik = 0) => {
    if (derinlik > 6) return
    for (const r of Array.from(rules)) {
      const sr = r as CSSStyleRule
      if (sr.selectorText && sr.selectorText.includes(':hover')) {
        hoverKurali++
        if (ornekler.length < 8) ornekler.push(sr.selectorText.slice(0, 70))
      }
      if (r instanceof CSSMediaRule) {
        const c = r.conditionText
        if (c.includes(HER_ZAMAN) || c.includes(ASLA)) yenidenYazilan++
        else if (/\(\s*(any-)?(hover|pointer)\s*:/i.test(c)) {
          hoverMediaKurali++
          if (ornekler.length < 8) ornekler.push('@media ' + c.slice(0, 60))
        }
      }
      if ('cssRules' in r) {
        try { sayKurallar((r as CSSGroupingRule).cssRules, derinlik + 1) } catch { /* yoksay */ }
      }
    }
  }

  const sheetler: CSSStyleSheet[] = []
  for (const sh of Array.from(document.styleSheets)) sheetler.push(sh as CSSStyleSheet)
  const adopted = (document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? []
  for (const sh of adopted) sheetler.push(sh)
  let shadowSayisi = 0
  const gezShadow = (kok: ParentNode, d: number) => {
    if (d > 8) return
    let liste: Element[]
    try { liste = Array.from(kok.querySelectorAll('*')) } catch { return }
    for (const el of liste) {
      const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot
      if (!sr) continue
      shadowSayisi++
      try { for (const sh of Array.from(sr.styleSheets ?? [])) sheetler.push(sh as CSSStyleSheet) } catch { /* yoksay */ }
      const a = (sr as ShadowRoot & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? []
      for (const sh of a) sheetler.push(sh)
      gezShadow(sr, d + 1)
    }
  }
  gezShadow(document, 0)

  for (const sh of sheetler) {
    try { sayKurallar(sh.cssRules); okunabilir++ } catch { okunamayan++ }
  }

  return {
    parmakModu: !!document.getElementById('__rs_touch_cursor__'),
    yenidenYazilan,
    toplamSheet: sheetler.length,
    okunabilir,
    okunamayan,
    adopted: adopted.length,
    shadowKok: shadowSayisi,
    kalanHoverKurali: hoverKurali,
    kalanHoverMedia: hoverMediaKurali,
    ornekler,
  }
}


/* ─── CSS özel değişkenleri (tasarım jetonları) ────────────────────── */

const COLORISH = /^(#|rgb|hsl|oklch|lab|lch|color\()/i

async function scanCssVars() {
  const map = new Map<string, { value: string; scope: string }>()

  const fromText = (text: string, scope: string) => {
    const re = /(--[\w-]+)\s*:\s*([^;}]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const name = m[1]
      if (!map.has(name)) map.set(name, { value: m[2].trim().slice(0, 90), scope })
    }
  }

  const walk = (rules: CSSRuleList, scope: string) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule) {
        const st = r.style
        for (let i = 0; i < st.length; i++) {
          const prop = st[i]
          if (prop.startsWith('--') && !map.has(prop)) {
            map.set(prop, { value: st.getPropertyValue(prop).trim().slice(0, 90), scope: r.selectorText.slice(0, 40) })
          }
        }
      } else if ('cssRules' in r) {
        try { walk((r as CSSGroupingRule).cssRules, scope) } catch { /* erişilemez */ }
      }
    }
  }

  for (const sheet of Array.from(document.styleSheets)) {
    const src = sheet.href ? shortUrl(sheet.href) : 'satır içi'
    try { walk(sheet.cssRules, src) } catch {
      if (!sheet.href) continue
      const res = await swFetch(sheet.href, true)
      if (res.ok && res.text) fromText(res.text, src)
    }
  }

  /* Gerçekte hesaplanan değeri tercih et — var() zincirleri çözülmüş olur */
  const root = getComputedStyle(document.documentElement)
  return [...map.entries()]
    .map(([name, v]) => {
      const computed = root.getPropertyValue(name).trim()
      const value = computed || v.value
      return { name, value: value.slice(0, 90), scope: v.scope, isColor: COLORISH.test(value) }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 300)
}

/* ─── Depolama dökümü ──────────────────────────────────────────────── */

function scanStorage() {
  const read = (s: Storage) => {
    const out: { key: string; value: string; size: number }[] = []
    try {
      for (let i = 0; i < s.length; i++) {
        const key = s.key(i)!
        const value = s.getItem(key) ?? ''
        out.push({ key, value: value.slice(0, 400), size: key.length + value.length })
      }
    } catch { /* erişim engellendi */ }
    return out.sort((a, b) => b.size - a.size)
  }
  const local = read(localStorage)
  const session = read(sessionStorage)
  return {
    local,
    session,
    cookieCount: document.cookie ? document.cookie.split(';').length : 0,
    totalBytes: [...local, ...session].reduce((a, b) => a + b.size, 0),
  }
}

/** Depolama üzerinde işlem yapar (viewer'dan gelen komut). */
export function storageOp(op: 'clear' | 'remove', area: 'local' | 'session', key?: string) {
  const s = area === 'local' ? localStorage : sessionStorage
  try {
    if (op === 'clear') s.clear()
    else if (key) s.removeItem(key)
  } catch { /* erişim engellendi */ }
}

/* ─── CSS kırılım noktaları ────────────────────────────────────────── */

const MQ_RE = /\(\s*(min|max)-(width|device-width)\s*:\s*([\d.]+)\s*(px|em|rem)\s*\)/gi

async function scanBreakpoints() {
  const out = new Map<string, { value: number; unit: string; feature: string; source: string }>()
  const add = (feature: string, value: number, unit: string, source: string) => {
    const pxVal = unit === 'px' ? value : value * 16
    const key = `${feature}:${Math.round(pxVal)}`
    if (!out.has(key)) out.set(key, { value: Math.round(pxVal), unit, feature, source })
  }

  const collect = (text: string, source: string) => {
    MQ_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = MQ_RE.exec(text))) add(`${m[1]}-${m[2]}`, parseFloat(m[3]), m[4], source)
  }

  for (const sheet of Array.from(document.styleSheets)) {
    const src = sheet.href ? shortUrl(sheet.href) : 'satır içi'
    try {
      /* Aynı-origin ve satır içi stiller doğrudan okunabilir */
      collect(rulesToText(sheet.cssRules), src)
    } catch {
      /* Cross-origin: host izni sayesinde content script'ten yeniden indirilebilir */
      if (!sheet.href) continue
      const res = await swFetch(sheet.href, true)
      if (res.ok && res.text) collect(res.text, src)
    }
  }
  /* Satır içi <style> ve element style attribute'larındaki media sorguları */
  for (const st of Array.from(document.querySelectorAll('style'))) {
    collect(st.textContent ?? '', 'satır içi')
  }

  return [...out.values()].sort((a, b) => a.value - b.value)
}

function rulesToText(rules: CSSRuleList): string {
  let text = ''
  for (const r of Array.from(rules)) {
    if (r instanceof CSSMediaRule) {
      text += r.conditionText + '\n'
      text += rulesToText(r.cssRules)
    } else if ('cssRules' in r) {
      text += rulesToText((r as CSSGroupingRule).cssRules)
    }
  }
  return text
}

function shortUrl(u: string) {
  try { const x = new URL(u); return x.pathname.split('/').pop() || x.host } catch { return u.slice(-40) }
}

/* ─── Bağlantı denetimi ────────────────────────────────────────────── */

async function scanLinks() {
  const seen = new Map<string, { href: string; text: string; external: boolean; status?: number }>()
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const href = a.href
    if (!/^https?:/i.test(href)) continue
    if (seen.has(href)) continue
    seen.set(href, {
      href,
      text: (a.textContent ?? '').trim().slice(0, 60) || a.getAttribute('aria-label') || '(metin yok)',
      external: new URL(href).host !== location.host,
    })
  }
  const list = [...seen.values()].slice(0, 60)

  /* 6'lı eşzamanlılıkla durum kontrolü (service worker üzerinden — §swFetch) */
  let i = 0
  const workers = Array.from({ length: 6 }, async () => {
    while (i < list.length) {
      const item = list[i++]
      const r = await swFetch(item.href)
      item.status = r.status
    }
  })
  await Promise.all(workers)
  return list
}

/* ─── Görsel / medya denetimi ──────────────────────────────────────── */

function scanAssets() {
  const out: { url: string; kind: string; broken: boolean; natural?: string; shown?: string }[] = []
  for (const img of Array.from(document.images)) {
    const r = img.getBoundingClientRect()
    const broken = img.complete && img.naturalWidth === 0
    const src = img.currentSrc || img.src
    /* SVG çözünürlükten bağımsızdır — "gereğinden büyük" ölçütü onlara uygulanmaz */
    const vector = /\.svgx?($|\?)/i.test(src) || /^data:image\/svg/i.test(src)
    out.push({
      url: shortUrl(src),
      kind: vector ? 'vektör' : 'görsel',
      broken,
      natural: img.naturalWidth ? `${img.naturalWidth}×${img.naturalHeight}` : '—',
      shown: r.width ? `${Math.round(r.width)}×${Math.round(r.height)}` : '—',
    })
  }
  for (const v of Array.from(document.querySelectorAll('video,audio,iframe'))) {
    const src = (v as HTMLMediaElement).currentSrc || v.getAttribute('src') || ''
    if (src) out.push({ url: shortUrl(src), kind: v.tagName.toLowerCase(), broken: false })
  }
  return out
}

/* ─── Font envanteri ───────────────────────────────────────────────── */

function scanFonts() {
  const map = new Map<string, { count: number; weights: Set<string> }>()
  const all = document.querySelectorAll<HTMLElement>('body *')
  const step = Math.max(1, Math.floor(all.length / 3000)) // çok büyük sayfalarda örnekle
  for (let i = 0; i < all.length; i += step) {
    const el = all[i]
    if (!el.textContent?.trim()) continue
    const cs = getComputedStyle(el)
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()
    if (!fam) continue
    if (!map.has(fam)) map.set(fam, { count: 0, weights: new Set() })
    const e = map.get(fam)!
    e.count++
    e.weights.add(cs.fontWeight)
  }
  return [...map.entries()]
    .map(([family, v]) => ({ family, count: v.count, weights: [...v.weights].sort() }))
    .sort((a, b) => b.count - a.count)
}

/* ─── Web Vitals ───────────────────────────────────────────────────── */

const vitals: { lcp?: number; cls?: number; inp?: number; fcp?: number; ttfb?: number } = {}

export function observeVitals() {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav) vitals.ttfb = Math.round(nav.responseStart)
  } catch { /* yoksay */ }

  const obs = (type: string, cb: (e: PerformanceEntry) => void, extra?: PerformanceObserverInit) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra })
    } catch { /* tarayıcı desteklemiyor */ }
  }
  obs('largest-contentful-paint', (e) => { vitals.lcp = Math.round(e.startTime) })
  obs('paint', (e) => { if (e.name === 'first-contentful-paint') vitals.fcp = Math.round(e.startTime) })
  obs('layout-shift', (e) => {
    const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean }
    if (!ls.hadRecentInput) vitals.cls = Math.round(((vitals.cls ?? 0) + ls.value) * 1000) / 1000
  })
  obs('event', (e) => {
    const d = Math.round(e.duration)
    if (d > (vitals.inp ?? 0)) vitals.inp = d
  }, { durationThreshold: 16 } as PerformanceObserverInit)
}

function readVitals() { return { ...vitals } }

/* ─── Meta / SEO özeti ─────────────────────────────────────────────── */

/** Adres içeren meta değerlerini mutlaklaştırır — viewer farklı bir origin'de
    çalıştığı için göreli adresler orada çözülemez (sosyal önizleme kartları). */
const URLISH = /^(og:image|og:url|og:video|og:audio|twitter:image|twitter:player|msapplication-TileImage)/i

function scanMeta() {
  const out: Record<string, string> = {}
  const put = (k: string, v: string | null | undefined) => {
    if (!v) return
    let val = v
    if (URLISH.test(k) && !/^(https?:|data:)/i.test(val)) {
      try { val = new URL(val, location.href).href } catch { /* geçersiz — olduğu gibi bırak */ }
    }
    out[k] = val.slice(0, 500)
  }
  put('title', document.title)
  put('lang', document.documentElement.lang)
  put('charset', document.characterSet)
  for (const m of Array.from(document.querySelectorAll('meta'))) {
    const name = m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv')
    if (!name) continue
    const keep = /^(description|keywords|robots|viewport|theme-color|author|og:|twitter:)/i.test(name)
    if (keep) put(name.toLowerCase(), m.getAttribute('content'))
  }
  put('canonical', document.querySelector<HTMLLinkElement>('link[rel=canonical]')?.href)
  const alts = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel=alternate][hreflang]'))
  if (alts.length) put('hreflang', alts.map((a) => a.hreflang).join(', '))
  put('favicon', document.querySelector<HTMLLinkElement>('link[rel~=icon]')?.href)
  put('manifest', document.querySelector<HTMLLinkElement>('link[rel=manifest]')?.href)
  const h = Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 12)
    .map((x) => `${x.tagName.toLowerCase()}: ${(x.textContent ?? '').trim().slice(0, 50)}`)
  if (h.length) put('başlık yapısı', h.join(' | '))
  return out
}
