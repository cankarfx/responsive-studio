/**
 * İKİ ADIMLI ONAY DÜĞMESİ
 *
 * Geri alınamayan işlemler (tümünü temizle, sil) tek tıkla gerçekleşmesin.
 * İlk tık düğmeyi "Emin misiniz?" durumuna getirir; 3 sn içinde ikinci tık
 * işlemi yapar. `confirm()` kullanılmıyor: tarayıcı diyaloğu sayfayı kilitler.
 */
import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'

interface Props {
  class: string
  title: string
  onConfirm: () => void
  children: ComponentChildren
  /** Onay bekleyen durumdaki etiket */
  armedLabel?: ComponentChildren
}

export function ConfirmButton({ class: cls, title, onConfirm, children, armedLabel }: Props) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      class={`${cls}${armed ? ' armed' : ''}`}
      title={armed ? 'Onaylamak için tekrar tıklayın' : title}
      onClick={(e) => {
        e.stopPropagation()
        if (armed) { setArmed(false); onConfirm() } else setArmed(true)
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? (armedLabel ?? 'Emin misiniz?') : children}
    </button>
  )
}
