/**
 * Telefonun durum çubuğu (saat, sinyal, Wi-Fi, pil) — yalnızca görsel.
 * Yüksekliği cihazın üst güvenli alanıdır. Sayfa `viewport-fit=cover` değilse
 * site bu çubuğun ALTINDAN başlar (gerçek Safari gibi) ve çubuk sitenin
 * `theme-color`'ı / üst arka planıyla boyanır; cover ise çubuk saydamdır ve
 * içerik altına uzanır.
 */
import type { DeviceOS } from '@/lib/types'

interface Props {
  /** Ekran genişliği ve çubuk yüksekliği (CSS px, ölçeklenmemiş) */
  w: number
  yuk: number
  scale: number
  os: DeviceOS
  /** Ortadaki kamera bölgesi: Dynamic Island, klasik çentik ya da yok */
  kamera: 'island' | 'notch' | 'none'
  tema?: string
  cover: boolean
}

/** #rrggbb ya da rgba(r, g, b, a) → 0..1 algılanan parlaklık */
export function parlaklik(renk: string): number {
  let r = 255, g = 255, b = 255
  const hex = /^#([0-9a-f]{6})$/i.exec(renk)
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(renk)
  if (hex) { const n = parseInt(hex[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255 }
  else if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3] }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

const Sinyal = () => (
  <svg viewBox="0 0 17 11" width="17" height="11" fill="currentColor">
    <rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" />
    <rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" />
  </svg>
)
const Wifi = () => (
  <svg viewBox="0 0 16 12" width="16" height="12" fill="currentColor">
    <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 .6 10.2 10.2 0 0 0 .9 3.4L2 4.6a8.6 8.6 0 0 1 6-2.4zm0 3.4c1.4 0 2.6.5 3.6 1.4l1.1-1.2A6.9 6.9 0 0 0 8 4a6.9 6.9 0 0 0-4.7 1.8L4.4 7c1-.9 2.2-1.4 3.6-1.4zm0 3.3c.6 0 1.1.2 1.5.6L8 11.4 6.5 9.5c.4-.4.9-.6 1.5-.6z" />
  </svg>
)
const Pil = () => (
  <svg viewBox="0 0 27 13" width="27" height="13" fill="currentColor">
    <rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4" />
    <rect x="2" y="2" width="20" height="9" rx="2" />
    <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" opacity=".4" />
  </svg>
)

export function StatusBar({ w, yuk, scale, os, kamera, tema, cover }: Props) {
  const zemin = tema ?? '#ffffff'
  /* Saydam çubukta yazı rengi yine sayfanın üst rengine göre seçilir */
  const renk = parlaklik(zemin) < 0.6 ? '#ffffff' : '#000000'
  const ios = os === 'ios' || os === 'ipados'
  const orta = kamera === 'island' ? 149 : kamera === 'notch' ? Math.min(210, w * 0.55) : 0
  const tur = !ios ? 'and' : kamera === 'none' ? 'ipad' : 'ios'
  return (
    <div class="statusbar" aria-hidden="true" data-rs-statusbar={cover ? 'cover' : 'ust'}
         style={{
           width: `${Math.round(w * scale)}px`, height: `${Math.round(yuk * scale)}px`,
           background: cover ? 'transparent' : zemin, color: renk,
         }}>
      <div class={`sb-ic ${tur}`} style={{ width: `${w}px`, height: `${yuk}px`, transform: `scale(${scale})` }}>
        <span class="sb-sol">9:41</span>
        <span class="sb-orta" style={{ width: `${orta}px` }} />
        <span class="sb-sag"><Sinyal /><Wifi /><Pil /></span>
      </div>
    </div>
  )
}
