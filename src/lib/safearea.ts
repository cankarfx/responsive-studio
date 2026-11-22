import type { SafeArea } from './types'

/**
 * Cihazın güvenli alanını yöne göre sayfaya bildirilecek `env(safe-area-inset-*)`
 * değerlerine çevirir. Ayar kapalıysa ya da cihazda güvenli alan yoksa null.
 *
 * Dikey: üstte durum çubuğu/ada, altta ana ekran çizgisi.
 * Yatay: ada/çentik yana geçer (sol ve sağ), alt çizgi incelir (iOS'ta 21 px).
 */
export function insetsFor(sa: SafeArea | null | undefined, landscape: boolean, on: boolean): SafeArea | null {
  if (!on || !sa || (sa.top <= 0 && sa.bottom <= 0)) return null
  if (!landscape) return { top: sa.top, right: sa.right, bottom: sa.bottom, left: sa.left }
  const yan = sa.top >= 40 ? sa.top : 0
  return { top: 0, right: yan, bottom: sa.bottom >= 30 ? 21 : sa.bottom, left: yan }
}
