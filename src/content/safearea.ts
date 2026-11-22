/**
 * GÜVENLİ ALAN EMÜLASYONU — `env(safe-area-inset-*)`.
 *
 * Gerçek iPhone'da bir sayfa `<meta name="viewport" content="…, viewport-fit=cover">`
 * derse içerik durum çubuğunun ve ana ekran çizgisinin altına uzanır; sayfa da
 * `env(safe-area-inset-top)` gibi değerlerle kendini içeri çeker. Masaüstü
 * Chrome'da bu değerler hep 0'dır ve JavaScript ile değiştirilemez (env()
 * değişkenlerinin bir API'si yok; CDP de alt çerçevelerde çalışmıyor — bkz.
 * YOL-HARITASI §2.4). Bu yüzden media.ts'teki gibi **kuralları yeniden yazıyoruz**:
 * `env(safe-area-inset-top[, yedek])` → `59px`.
 *
 * Yalnızca sayfa `viewport-fit=cover` kullanıyorsa uygulanır; aksi hâlde gerçek
 * iOS'ta da değerler 0'dır ve stüdyo sayfayı durum çubuğunun altından başlatır.
 */
import type { SafeArea } from '@/lib/types'
import { absolutizeUrls, inlineImports, swFetch, tumSheetler } from './media'

const ENV_RE = /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(?:,(?:[^()]|\([^()]*\))*)?\)/gi
const ANAHTAR = 'safe-area-inset'
const MARK = 'data-rs-safe'

let insets: SafeArea | null = null
/** Kuralın özgün metni — değerler değişince ya da kapanınca geri dönmek için */
const ozgun = new WeakMap<CSSStyleRule, string>()
const suruyor = new Set<string>()
const satirIci = new Map<HTMLElement, string>()
let gozlemci: MutationObserver | null = null
let planli = false

/** Sayfa içeriği durum çubuğunun altına uzatmak istiyor mu? */
export function sayfaCover(): boolean {
  const m = document.querySelector<HTMLMetaElement>('meta[name="viewport" i]')
  return !!m && /viewport-fit\s*=\s*cover/i.test(m.content)
}

const aktif = () => !!insets && sayfaCover()

function degistir(metin: string, i: SafeArea): string {
  return metin.replace(ENV_RE, (_t, k: keyof SafeArea) => `${i[k]}px`)
}

function gez(rules: CSSRuleList, fn: (r: CSSStyleRule) => void) {
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule) fn(r)
    if ('cssRules' in r) {
      try { gez((r as CSSGroupingRule).cssRules, fn) } catch { /* erişilemez */ }
    }
  }
}

function kural(r: CSSStyleRule, i: SafeArea | null) {
  const asil = ozgun.get(r) ?? r.style.cssText
  if (asil.indexOf(ANAHTAR) < 0) return
  if (!ozgun.has(r)) ozgun.set(r, asil)
  const yeni = i ? degistir(asil, i) : asil
  if (r.style.cssText !== yeni) {
    try { r.style.cssText = yeni } catch { /* salt okunur */ }
  }
}

/** Okunamayan (cross-origin) stylesheet'i indirip okunabilir bir kopyayla değiştirir. */
async function kopyala(link: HTMLLinkElement) {
  const href = link.href
  if (!href || link.dataset.rsDone === '1' || link.dataset.rsSafe === 'yok' || suruyor.has(href)) return
  suruyor.add(href)
  try {
    const text = await swFetch(href)
    if (text === null) return
    if (text.indexOf(ANAHTAR) < 0) { link.dataset.rsSafe = 'yok'; return }
    let css = absolutizeUrls(text, href)
    css = await inlineImports(css, href)
    if (link.dataset.rsDone === '1' || !link.isConnected) return
    kopyaEkle(link, href, css)
  } finally { suruyor.delete(href) }
}

function kopyaEkle(link: HTMLLinkElement, href: string, css: string) {
  const style = document.createElement('style')
  style.setAttribute(MARK, href)
  if (link.media) style.media = link.media
  style.textContent = css
  link.after(style)
  /* media.ts aynı bağlantıyı bir daha indirmesin — kopya okunabilir, o da yamalar */
  link.dataset.rsDone = '1'
  link.disabled = true
  if (style.sheet) gez(style.sheet.cssRules, (r) => kural(r, aktif() ? insets : null))
}

function uygula() {
  planli = false
  const i = aktif() ? insets : null
  for (const sheet of tumSheetler()) {
    let kurallar: CSSRuleList
    try { kurallar = sheet.cssRules } catch {
      const owner = sheet.ownerNode
      if (i && owner instanceof HTMLLinkElement) void kopyala(owner)
      continue
    }
    gez(kurallar, (r) => kural(r, i))
  }
  /* style="padding-top: env(safe-area-inset-top)" */
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[style*="${ANAHTAR}"]`))) {
    if (!satirIci.has(el)) satirIci.set(el, el.getAttribute('style') ?? '')
  }
  for (const [el, asil] of satirIci) {
    if (!el.isConnected) { satirIci.delete(el); continue }
    const yeni = i ? degistir(asil, i) : asil
    if (el.getAttribute('style') !== yeni) el.setAttribute('style', yeni)
  }
}

function planla() {
  if (planli) return
  planli = true
  requestAnimationFrame(uygula)
}

/** Viewer'dan gelen değerler (null: ayar kapalı ya da cihazda güvenli alan yok). */
export function setSafeArea(i: SafeArea | null) {
  insets = i
  planla()
  if (!i) return
  if (!gozlemci) {
    /* Geç yüklenen CSS, SPA'ların eklediği stiller ve viewport meta değişimi */
    gozlemci = new MutationObserver((kayitlar) => {
      for (const k of kayitlar) {
        if (k.type === 'attributes') { if ((k.target as Element).tagName === 'META') { planla(); return } continue }
        for (const n of Array.from(k.addedNodes)) {
          const ad = (n as Element).tagName
          if (ad === 'STYLE' || ad === 'LINK' || ad === 'META') {
            planla()
            if (ad === 'LINK') n.addEventListener('load', planla, { once: true })
            return
          }
        }
      }
    })
    gozlemci.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['content'],
    })
    document.addEventListener('DOMContentLoaded', planla)
    window.addEventListener('load', planla)
    for (const ms of [150, 500, 1200, 2500, 5000]) setTimeout(planla, ms)
  }
}

/* ─── Durum çubuğu rengi ─────────────────────────────────────────────
   Safari durum çubuğunu sayfanın `theme-color`'ı ya da en üstteki arka planla
   boyar. Viewer çubuğu bu renkle çizer, yazı rengini parlaklığa göre seçer. */
let tuval: CanvasRenderingContext2D | null = null
function normal(renk: string): string | null {
  tuval ??= document.createElement('canvas').getContext('2d')
  if (!tuval) return null
  tuval.fillStyle = '#010203'
  tuval.fillStyle = renk
  const v = String(tuval.fillStyle)
  if (v === '#010203' && !/^#?010203$/i.test(renk.trim())) return null   // geçersiz renk
  /* Saydam arka plan sayılmaz */
  if (/^rgba\(.*,\s*0(\.0+)?\)$/.test(v)) return null
  return v
}

function arkaPlan(el: Element | null): string | null {
  for (let e = el; e; e = e.parentElement) {
    const r = normal(getComputedStyle(e).backgroundColor)
    if (r) return r
  }
  return null
}

export function durumRengi(): string {
  for (const m of Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color" i]'))) {
    if (m.media) { try { if (!matchMedia(m.media).matches) continue } catch { continue } }
    const r = m.content && normal(m.content)
    if (r) return r
  }
  const ust = document.elementFromPoint(Math.max(0, innerWidth / 2), 1)
  return arkaPlan(ust) ?? arkaPlan(document.body) ?? '#ffffff'
}
