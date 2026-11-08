/**
 * Frame yapılandırmasının taşınma biçimi.
 *
 * NEDEN FRAGMENT: iframe'in `name` niteliği ilk bakışta doğru yol gibi görünse de
 * Chrome, bir çerçeve cross-origin gezindiğinde browsing-context adını sıfırlıyor
 * (testle doğrulandı). URL fragment'ı ise gezinmeyi atlatmadan taşınır ve
 * **sunucuya hiç gönderilmez**, dolayısıyla isteğin kendisini değiştirmez.
 *
 * Emülasyon script'i document_start'ta fragment'i okur, uygular ve derhal
 * `history.replaceState` ile adresi temizler — sayfanın kendi JS'i çalışmadan önce.
 */
import type { FramePayload } from './types'

export const PREFIX = '__RSTUDIO__'
export const HASH_KEY = '__rs'

/** Adrese yapılandırmayı ekler. */
export function withPayload(url: string, payload: FramePayload): string {
  const base = url.split('#')[0]
  const original = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  const data = encodeURIComponent(JSON.stringify({ ...payload, h: original }))
  return `${base}#${HASH_KEY}=${data}`
}

/**
 * Bu belge DOĞRUDAN stüdyo sayfasının içindeki bir çerçeve mi?
 *
 * Güvenlik: yük (hash / window.name) sayfa tarafından taklit edilebilir. Stüdyo
 * açıkken content script'ler her sekmeye kayıtlı olduğundan, sıradan bir site
 * kendi iframe'ine sahte yük koyup köprüyü çalıştırabiliyor ve service worker
 * üzerinden başka adreslerin içeriğini (çerezleriyle) okuyabiliyordu.
 * `location.ancestorOrigins` sayfa tarafından değiştirilemez: tek ata ve o da
 * eklenti kökeni olmalı.
 */
export function insideViewer(extOrigin?: string): boolean {
  try {
    if (window.top === window.self) return false
    const a = location.ancestorOrigins
    if (!a || a.length !== 1) return false
    return extOrigin ? a[0] === extOrigin : /^chrome-extension:\/\/[a-p]{32}$/.test(a[0])
  } catch { return false }
}

/** Fragment veya window.name içinden yapılandırmayı okur. */
export function readPayload(): (FramePayload & { h?: string }) | null {
  try {
    const h = location.hash
    const i = h.indexOf(`${HASH_KEY}=`)
    if (i >= 0) {
      const raw = h.slice(i + HASH_KEY.length + 1)
      return JSON.parse(decodeURIComponent(raw))
    }
  } catch { /* bozuk yük — window.name'e düş */ }
  try {
    const n = window.name
    if (n && n.lastIndexOf(PREFIX, 0) === 0) return JSON.parse(n.slice(PREFIX.length))
  } catch { /* yoksay */ }
  return null
}

/** Adresten yapılandırmayı siler, sayfanın kendi fragment'ını geri koyar. */
export function stripPayload(originalHash: string | undefined) {
  try {
    const clean = location.pathname + location.search + (originalHash ? `#${originalHash}` : '')
    history.replaceState(history.state, '', clean)
  } catch { /* yoksay */ }
}
