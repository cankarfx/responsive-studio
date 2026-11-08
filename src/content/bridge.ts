/**
 * ETKİLEŞİM KÖPRÜSÜ — ISOLATED world, document_start, her frame'de.
 *
 * Viewer ile doğrudan postMessage üzerinden konuşur (service worker turunu
 * atlayarak kaydırma senkronunu gecikmesiz tutar). Görevleri:
 *   • kaydırma konumunu bildir / uygula
 *   • tıklama, yazma, hover olaylarını yansıt
 *   • bağlantı tıklamalarını yakalayıp viewer'a bildir (senkron gezinme)
 *   • sayfa ölçülerini ve yatay taşmayı raporla
 */
import type { FramePayload } from '@/lib/types'
import type { FromFrameMessage, ToFrameMessage } from '@/lib/types'
import { insideViewer, readPayload } from '@/lib/payload'
import {
  forceHeight, highlightPath, initInspect, observeVitals, runScan, setFilter, setTool, storageOp,
} from './inspect'
import { applyMedia, setTextScale, setVision } from './media'

const EXT_ORIGIN = chrome.runtime.getURL('').replace(/\/$/, '')

const cfg: FramePayload | null = readPayload()
/* Yalnızca stüdyonun doğrudan çocuğu olan çerçevede çalış (bkz. insideViewer) */
if (cfg && insideViewer(EXT_ORIGIN)) start(cfg)

function start(c: FramePayload) {
  const { token, fid } = c

  /* Aynı-origin gezinmede yapılandırma kaybolmasın diye window.name'de tut.
     (Cross-origin gezinmede Chrome bunu sıfırlar; o durumda viewer yeniden yükler.) */
  const nameValue = '__RSTUDIO__' + JSON.stringify(c)
  try { window.name = nameValue } catch { /* yoksay */ }
  window.addEventListener('beforeunload', () => {
    try { window.name = nameValue } catch { /* yoksay */ }
  }, true)

  /* Kaydırma çubuklarını gizle — gerçek mobil cihazlarda bindirmeli (overlay)
     çubuklar vardır ve yer kaplamaz; görünür çubuk viewport'u daraltıp
     yerleşimi yanıltır. */
  if (!c.showScrollbars) {
    const hide = document.createElement('style')
    hide.textContent =
      'html{scrollbar-width:none!important}' +
      'html::-webkit-scrollbar,body::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}'
    const put = () => document.documentElement.appendChild(hide)
    if (document.documentElement) put()
    else document.addEventListener('readystatechange', put, { once: true })
  }

  const send = (m: FromFrameMessage) => {
    try { window.parent.postMessage({ __rs: token, m }, EXT_ORIGIN) } catch { /* yoksay */ }
  }

  /* ─── Gelen komutlar ─────────────────────────────────────────── */
  let muteUntil = 0
  const mute = () => { muteUntil = performance.now() + 120 }
  const muted = () => performance.now() < muteUntil

  window.addEventListener('message', (e) => {
    if (e.origin !== EXT_ORIGIN) return
    const d = e.data as { __rs?: string; m?: ToFrameMessage }
    if (!d || d.__rs !== token || !d.m) return
    handle(d.m)
  })

  function handle(m: ToFrameMessage) {
    switch (m.t) {
      case 'scroll': {
        mute()
        const maxY = Math.max(0, docH() - window.innerHeight)
        const maxX = Math.max(0, docW() - window.innerWidth)
        const y = m.mode === 'ratio' ? m.ratioY * maxY : m.y
        const x = m.mode === 'ratio' ? m.ratioX * maxX : m.x
        window.scrollTo({ left: x, top: y, behavior: 'instant' as ScrollBehavior })
        break
      }
      case 'click': {
        const el = resolve(m.path)
        if (!el) break
        mute()
        simulateClick(el as HTMLElement)
        break
      }
      case 'input': {
        const el = resolve(m.path) as HTMLInputElement | null
        if (!el) break
        mute()
        if (m.kind === 'checked') el.checked = m.value === 'true'
        else setNativeValue(el, m.value)
        el.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
        el.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
        break
      }
      case 'hover': {
        applyHover(m.path ? resolve(m.path) : null)
        break
      }
      case 'key': {
        const el = resolve(m.path) ?? document.activeElement
        if (!el) break
        const init: KeyboardEventInit = {
          key: m.key, code: m.code, bubbles: true, cancelable: true, composed: true,
          ctrlKey: m.ctrl, shiftKey: m.shift, altKey: m.alt, metaKey: m.meta,
        }
        el.dispatchEvent(new KeyboardEvent('keydown', init))
        el.dispatchEvent(new KeyboardEvent('keyup', init))
        break
      }
      case 'css': {
        let s = document.getElementById('__rs_css__') as HTMLStyleElement | null
        if (!s) {
          s = document.createElement('style')
          s.id = '__rs_css__'
          document.documentElement.appendChild(s)
        }
        s.textContent = m.code
        break
      }
      case 'js':
        /* ISOLATED world'den eklenen satır içi <script> MV3'te ÇALIŞMIYOR
           (ölçüldü). Kod, aynı pencereyi paylaşan MAIN world script'ine
           devredilip orada çalıştırılıyor. */
        window.postMessage({ __rsExec: token, code: m.code }, '*')
        break
      case 'measure': reportMetrics(); break

      /* ── Faz 2: inceleme araçları ── */
      case 'tool':
        setTool(m.tool, m.grid)
        break
      case 'highlight':
        highlightPath(m.path, resolve)
        break
      case 'filter':
        setFilter(m.value)
        break
      case 'setHeight':
        forceHeight(m.height)
        setTimeout(reportMetrics, 60)
        break
      case 'scrollTo':
        mute()
        window.scrollTo({ left: 0, top: m.y, behavior: 'instant' as ScrollBehavior })
        break
      case 'scan':
        void runScan(m.what).then((data) => send({ t: 'scan', fid, what: m.what, data }))
        break

      /* ── Faz 3 ── */
      case 'media':
        void applyMedia(m.overrides, m.touch)
        /* MAIN world'deki matchMedia yaması da güncellensin */
        window.postMessage({ __rsMedia: token, overrides: m.overrides }, '*')
        break
      case 'vision':
        setVision(m.sim)
        break
      case 'textScale':
        setTextScale(m.percent)
        break
      case 'storageOp':
        storageOp(m.op, m.area, m.key)
        void runScan('storage').then((data) => send({ t: 'scan', fid, what: 'storage', data }))
        break
      case 'reload': location.reload(); break
      case 'ping': send({ t: 'ready', fid, url: location.href, title: document.title }); break
    }
  }

  /* ─── Kaydırma raporu ────────────────────────────────────────── */
  const docH = () => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)
  const docW = () => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0)

  let queued = false
  window.addEventListener('scroll', () => {
    if (muted() || queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      if (muted()) return
      const maxY = Math.max(1, docH() - window.innerHeight)
      const maxX = Math.max(1, docW() - window.innerWidth)
      send({
        t: 'scroll', fid,
        x: window.scrollX, y: window.scrollY,
        ratioX: window.scrollX / maxX, ratioY: window.scrollY / maxY,
      })
    })
  }, { passive: true, capture: true })

  /* ─── Tıklama & gezinme ──────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return
    const target = e.target as Element | null
    if (!target) return

    /* Bağlantı ise: viewer'a bildir, tüm frame'ler birlikte gitsin */
    const a = target.closest?.('a[href]') as HTMLAnchorElement | null
    if (a && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && e.button === 0) {
      const href = a.href
      const sameDoc = href.split('#')[0] === location.href.split('#')[0]
      const dl = a.hasAttribute('download')
      const newTab = a.target && a.target !== '_self'
      if (!dl && !newTab && !sameDoc && /^https?:/i.test(href)) {
        e.preventDefault()
        e.stopPropagation()
        send({ t: 'navigate', fid, url: href })
        return
      }
    }
    if (muted()) return
    send({ t: 'click', fid, path: pathOf(target), x: e.clientX, y: e.clientY })
  }, true)

  /* ─── Form girişleri ─────────────────────────────────────────── */
  document.addEventListener('input', (e) => {
    if (!e.isTrusted || muted()) return
    const el = e.target as HTMLInputElement
    if (!el?.tagName) return
    if (el.type === 'checkbox' || el.type === 'radio') {
      send({ t: 'input', fid, path: pathOf(el), value: String(el.checked), kind: 'checked' })
    } else {
      send({ t: 'input', fid, path: pathOf(el), value: el.value ?? '', kind: 'value' })
    }
  }, true)

  document.addEventListener('change', (e) => {
    if (!e.isTrusted || muted()) return
    const el = e.target as HTMLInputElement
    if (el?.tagName === 'SELECT') {
      send({ t: 'input', fid, path: pathOf(el), value: el.value ?? '', kind: 'value' })
    }
  }, true)

  /* ─── Hover ──────────────────────────────────────────────────── */
  let hoverTimer = 0
  document.addEventListener('mouseover', (e) => {
    if (!e.isTrusted || muted()) return
    clearTimeout(hoverTimer)
    hoverTimer = setTimeout(() => {
      const el = e.target as Element | null
      send({ t: 'hover', fid, path: el ? pathOf(el) : null })
    }, 30) as unknown as number
  }, true)

  /* ─── Klavye ─────────────────────────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted || muted()) return
    if (e.key.length > 1 && !['Enter', 'Backspace', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    const el = e.target as Element | null
    send({
      t: 'key', fid, key: e.key, code: e.code,
      ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey,
      path: el ? pathOf(el) : 'body',
    })
  }, true)

  /* ─── SPA gezinmesi tespiti ──────────────────────────────────── */
  let lastUrl = location.href
  const checkUrl = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      send({ t: 'ready', fid, url: location.href, title: document.title })
    }
  }
  window.addEventListener('popstate', checkUrl)
  window.addEventListener('hashchange', checkUrl)
  setInterval(checkUrl, 700)

  /* ─── Ölçüm raporu ───────────────────────────────────────────── */
  function reportMetrics() {
    send({
      t: 'metrics', fid,
      scrollHeight: docH(), scrollWidth: docW(),
      overflow: docW() > window.innerWidth + 1,
    })
  }

  /* Parmak modu sayfa yüklenir yüklenmez uygulanmalı — hover stilleri hiç
     görünmeden nötrlensin. Viewer ayrıca değişimlerde `media` mesajı yollar. */
  if (c.touchMode) {
    void applyMedia(
      { colorScheme: c.colorScheme, reducedMotion: 'auto', contrast: 'auto', forcedColors: 'auto' },
      true,
    )
  }

  initInspect({
    pathOf,
    onInspect: (info) => send({ t: 'inspect', fid, info }),
    onOverflow: (items) => send({ t: 'overflowList', fid, items }),
  })
  observeVitals()

  const ro = new ResizeObserver(() => reportMetrics())
  const onReady = () => {
    send({ t: 'ready', fid, url: location.href, title: document.title })
    reportMetrics()
    if (document.body) ro.observe(document.body)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true })
  } else {
    onReady()
  }
  window.addEventListener('load', () => { onReady() }, { once: true })
  window.addEventListener('error', (e) => {
    send({ t: 'error', fid, message: String(e.message || 'Bilinmeyen hata') })
  })
}

/* ─── Yardımcılar ──────────────────────────────────────────────── */

/** Elemana, farklı viewport'lardaki eşleniğini bulmaya yarayan seçici üretir. */
function pathOf(el: Element): string {
  if (!el || el === document.documentElement) return 'html'
  const id = el.getAttribute?.('id')
  if (id && /^[A-Za-z][\w-]*$/.test(id) && document.querySelectorAll(`#${CSS.escape(id)}`).length === 1) {
    return `#${id}`
  }
  for (const attr of ['data-testid', 'data-test', 'data-cy', 'name']) {
    const v = el.getAttribute?.(attr)
    if (v) {
      const sel = `[${attr}="${CSS.escape(v)}"]`
      try { if (document.querySelectorAll(sel).length === 1) return sel } catch { /* yoksay */ }
    }
  }
  const parts: string[] = []
  let node: Element | null = el
  let depth = 0
  while (node && node.nodeType === 1 && node !== document.documentElement && depth < 12) {
    const tag = node.tagName.toLowerCase()
    const parent: Element | null = node.parentElement
    if (!parent) { parts.unshift(tag); break }
    const sameTag = Array.prototype.filter.call(parent.children, (c: Element) => c.tagName === node!.tagName)
    const idx = sameTag.indexOf(node) + 1
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${idx})` : tag)
    node = parent
    depth++
  }
  return parts.join('>')
}

function resolve(path: string): Element | null {
  if (!path) return null
  try {
    const el = document.querySelector(path)
    if (el) return el
  } catch { /* geçersiz seçici */ }
  /* Yedek: son parçadaki etikete göre ilk eşleşme */
  const last = path.split('>').pop()?.split(':')[0]
  if (last) {
    try { return document.querySelector(last) } catch { return null }
  }
  return null
}

/** React/Vue gibi kütüphanelerin dinlediği yerel setter'ı kullanarak değer yazar. */
function setNativeValue(el: HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  if (desc?.set) desc.set.call(el, value)
  else el.value = value
}

function simulateClick(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const opts: MouseEventInit = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0 }
  el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true }))
  el.dispatchEvent(new MouseEvent('mousedown', opts))
  el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse', isPrimary: true }))
  el.dispatchEvent(new MouseEvent('mouseup', opts))
  el.click()
}

let hovered: Element | null = null
function applyHover(el: Element | null) {
  if (hovered === el) return
  if (hovered) {
    hovered.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, composed: true }))
    hovered.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, composed: true }))
  }
  hovered = el
  if (el) {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true }))
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, composed: true }))
  }
}
