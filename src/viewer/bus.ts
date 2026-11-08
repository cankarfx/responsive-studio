/**
 * Frame haberleşme veri yolu.
 * Viewer ↔ iframe arasında doğrudan postMessage kullanır (service worker turu yok),
 * böylece kaydırma senkronu gecikmesiz kalır.
 */
import type { FramePayload, FromFrameMessage, ToFrameMessage } from '@/lib/types'
import { actions, deviceById, getState, normalizeUrl, tools } from './store'
import { HASH_KEY, withPayload } from '@/lib/payload'

/** Oturuma özel güvenlik jetonu — sahte mesajları eler. */
export const TOKEN = crypto.randomUUID()

const frames = new Map<string, HTMLIFrameElement>()

export function registerFrame(fid: string, el: HTMLIFrameElement | null) {
  if (el) frames.set(fid, el)
  else frames.delete(fid)
}

export function sendTo(fid: string, m: ToFrameMessage) {
  const el = frames.get(fid)
  const win = el?.contentWindow
  if (!win) return
  try { win.postMessage({ __rs: TOKEN, m }, '*') } catch { /* yoksay */ }
}

export function broadcast(m: ToFrameMessage, exceptFid?: string) {
  for (const fid of frames.keys()) {
    if (fid !== exceptFid) sendTo(fid, m)
  }
}

/** Etkileşim yansıtması açık mı. Tek-ekran modu ("yalnızca bu ekranda çalış")
 *  senkronu TAMAMEN askıya alır — seçilen ekran dahil hiçbir ekran diğerlerini
 *  sürüklemez. */
function shouldMirror(_sourceFid: string, kind: 'scroll' | 'click' | 'input' | 'hover'): boolean {
  const { sync } = getState()
  if (sync.soloFid) return false
  return sync[kind]
}

window.addEventListener('message', (e: MessageEvent) => {
  const d = e.data as { __rs?: string; m?: FromFrameMessage }
  if (!d || d.__rs !== TOKEN || !d.m) return
  const m = d.m
  /* Jeton önizlenen sitenin okuyabileceği window.name içinde taşınıyor;
     tek başına yeterli değil. Mesaj, iddia ettiği çerçevenin KENDİ
     penceresinden gelmeli — sitenin içine gömülü reklam/iframe'ler ya da
     başka bir çerçeve adına konuşan sayfa elenir. */
  if (typeof m.fid !== 'string' || !e.source || frames.get(m.fid)?.contentWindow !== e.source) return

  switch (m.t) {
    case 'ready': {
      actions.setFrameInfo(m.fid, { url: m.url, title: m.title, ready: true, error: undefined })
      /* Yeniden yüklenen çerçeve, açık olan bindirme ve filtreleri kaybeder —
         geçerli durumu ona tekrar uygula. */
      const st = getState()
      if (st.tool !== 'none') sendTo(m.fid, { t: 'tool', tool: st.tool, grid: st.grid })
      if (st.vision !== 'none') sendTo(m.fid, { t: 'vision', sim: st.vision })
      if (st.textScale !== 100) sendTo(m.fid, { t: 'textScale', percent: st.textScale })
      const frame = st.frames.find((f) => f.fid === m.fid)
      const dev = frame ? deviceById(st.settings, frame.deviceId) : undefined
      const touch = !!dev?.touch && st.settings.touchMode
      if (touch || st.media.colorScheme !== 'auto' || st.media.reducedMotion !== 'auto'
        || st.media.contrast !== 'auto' || st.media.forcedColors !== 'auto') {
        sendTo(m.fid, { t: 'media', overrides: st.media, touch })
      }
      /* Canlı kod enjeksiyonu yeniden yüklemede kaybolur — tekrar uygula */
      if (st.settings.injectCss) sendTo(m.fid, { t: 'css', code: st.settings.injectCss })
      if (st.settings.injectJs) sendTo(m.fid, { t: 'js', code: st.settings.injectJs })
      break
    }

    case 'metrics':
      actions.setFrameInfo(m.fid, {
        scrollHeight: m.scrollHeight, scrollWidth: m.scrollWidth, overflow: m.overflow,
      })
      break

    case 'error':
      actions.setFrameInfo(m.fid, { error: m.message })
      break

    case 'scroll': {
      if (!shouldMirror(m.fid, 'scroll')) break
      const { sync } = getState()
      broadcast(
        { t: 'scroll', x: m.x, y: m.y, ratioX: m.ratioX, ratioY: m.ratioY, mode: sync.scrollMode },
        m.fid,
      )
      break
    }

    case 'click':
      if (!shouldMirror(m.fid, 'click')) break
      broadcast({ t: 'click', path: m.path, x: m.x, y: m.y }, m.fid)
      break

    case 'input':
      if (!shouldMirror(m.fid, 'input')) break
      broadcast({ t: 'input', path: m.path, value: m.value, kind: m.kind }, m.fid)
      break

    case 'hover':
      if (!shouldMirror(m.fid, 'hover')) break
      broadcast({ t: 'hover', path: m.path }, m.fid)
      break

    case 'key':
      /* Odak sitenin içindeyken Esc stüdyoya ulaşmaz — tek-ekran modundan
         çıkış çerçeveden gelen tuşla da çalışsın. */
      if (m.key === 'Escape' && getState().sync.soloFid) { actions.setSync({ soloFid: null }); break }
      if (!shouldMirror(m.fid, 'input')) break
      broadcast(
        { t: 'key', path: m.path, key: m.key, code: m.code, ctrl: m.ctrl, shift: m.shift, alt: m.alt, meta: m.meta },
        m.fid,
      )
      break

    /* ── Faz 2 ── */
    case 'console':
      tools.addConsole({ fid: m.fid, level: m.level, text: m.text, source: m.source })
      break

    case 'scan':
      tools.setScan(m.fid, m.what, m.data)
      break

    case 'inspect':
      tools.setInspected(m.fid, m.info)
      /* Aynı elemanı diğer tüm ekranlarda da vurgula */
      broadcast({ t: 'highlight', path: m.info.path }, m.fid)
      break

    case 'overflowList':
      tools.setOverflowItems(m.fid, m.items)
      break

    case 'color':
      /* Panoya yalnızca renk kodu yazılabilir — site keyfi metin koyamaz */
      if (typeof m.hex !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(m.hex)) break
      void navigator.clipboard?.writeText(m.hex).catch(() => {})
      actions.toast(`${m.hex} panoya kopyalandı`, 'ok')
      break

    case 'navigate': {
      const { sync } = getState()
      if (sync.navigation && !sync.soloFid) { actions.navigate(m.url); break }
      /* Yalnızca bu ekran gitsin. `location.href` ile gitmek yapılandırma
         yükünü taşımıyordu: başka siteye geçişte Chrome window.name'i
         sıfırladığı için ekran cihaz emülasyonunu ve senkronu kaybediyordu.
         Ekranın mevcut yükü yeni adrese eklenir. */
      const url = normalizeUrl(m.url)
      const el = frames.get(m.fid)
      const cur = el?.src ?? ''
      const at = cur.indexOf(`#${HASH_KEY}=`)
      if (!url || !el || at < 0) break
      try {
        const payload = JSON.parse(decodeURIComponent(cur.slice(at + HASH_KEY.length + 2))) as FramePayload
        el.src = withPayload(url, payload)
      } catch { /* bozuk yük — yoksay */ }
      break
    }
  }
})

/** Service worker'a mesaj gönderir. */
export function bg<T = unknown>(msg: object): Promise<T> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => {
        void chrome.runtime.lastError
        resolve(r as T)
      })
    } catch {
      resolve(undefined as T)
    }
  })
}
