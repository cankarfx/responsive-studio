/**
 * GLOBAL İPUCU (tooltip)
 *
 * Tarayıcının yerleşik `title` ipucu yavaş (≈1 sn gecikme), biçimlendirilemez ve
 * uzun metinlerde okunaksız. Bunun yerine tek bir yüzen katman kullanıyoruz:
 * belge düzeyinde olay delegasyonuyla `title` taşıyan her elemanı yakalıyor,
 * değeri `data-tip`'e taşıyıp `title`'ı kaldırıyor (çift ipucu çıkmasın diye) ve
 * erişilebilirlik kaybolmasın diye `aria-label` olarak geri yazıyoruz.
 *
 * Böylece her bileşene ayrı ipucu kodu eklemeye gerek kalmıyor — mevcut
 * `title` nitelikleri olduğu gibi çalışıyor.
 */
import { useEffect, useRef, useState } from 'preact/hooks'

interface TipState { text: string; x: number; y: number; above: boolean }

const DELAY = 350

export function Tooltip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef(0)

  useEffect(() => {
    let hedef: Element | null = null

    const metniAl = (el: Element): string | null => {
      const t = el.getAttribute('title')
      if (t) {
        /* İlk karşılaşmada title'ı devral: yerleşik ipucu devre dışı kalsın,
           erişilebilir ad korunsun. */
        el.setAttribute('data-tip', t)
        /* Metinsiz (ikon) düğmenin erişilebilir adı ipucudur. Düğmenin ipucu
           sonradan değişirse (ör. "Ekran kaydı" → "Kaydı durdur") ad da güncellensin. */
        if ((!el.getAttribute('aria-label') || el.hasAttribute('data-tip-aria')) && !el.textContent?.trim()) {
          el.setAttribute('aria-label', t)
          el.setAttribute('data-tip-aria', '')
        }
        el.removeAttribute('title')
        return t
      }
      return el.getAttribute('data-tip')
    }

    const goster = (el: Element, text: string) => {
      const r = el.getBoundingClientRect()
      const altta = r.bottom + 10
      const above = altta + 60 > window.innerHeight
      setTip({
        text,
        x: Math.round(r.left + r.width / 2),
        y: above ? Math.round(r.top - 8) : Math.round(r.bottom + 8),
        above,
      })
    }

    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[title],[data-tip]')
      if (!el || el === hedef) return
      hedef = el
      const text = metniAl(el)
      clearTimeout(timer.current)
      if (!text) { setTip(null); return }
      timer.current = setTimeout(() => goster(el, text), DELAY) as unknown as number
    }

    const onOut = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[title],[data-tip]')
      if (!el || el !== hedef) return
      const gidilen = (e as MouseEvent & { relatedTarget: Element | null }).relatedTarget
      if (gidilen && el.contains(gidilen)) return
      hedef = null
      clearTimeout(timer.current)
      setTip(null)
    }

    /* Tıklama, kaydırma veya tuş basımında ipucu yolunu kapatmasın */
    const kapat = () => { clearTimeout(timer.current); hedef = null; setTip(null) }

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    document.addEventListener('mousedown', kapat, true)
    document.addEventListener('keydown', kapat, true)
    window.addEventListener('scroll', kapat, true)
    return () => {
      clearTimeout(timer.current)
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      document.removeEventListener('mousedown', kapat, true)
      document.removeEventListener('keydown', kapat, true)
      window.removeEventListener('scroll', kapat, true)
    }
  }, [])

  /* Ekran dışına taşmasın — yatayda kenarlara yaslanır */
  useEffect(() => {
    const el = ref.current
    if (!el || !tip) return
    const r = el.getBoundingClientRect()
    const pad = 8
    let dx = 0
    if (r.left < pad) dx = pad - r.left
    else if (r.right > window.innerWidth - pad) dx = window.innerWidth - pad - r.right
    if (dx) el.style.transform += ` translateX(${dx}px)`
  }, [tip])

  if (!tip) return null
  return (
    <div
      ref={ref}
      class={`tooltip${tip.above ? ' above' : ''}`}
      style={{ left: `${tip.x}px`, top: `${tip.y}px` }}
      role="tooltip"
    >
      {tip.text}
    </div>
  )
}
