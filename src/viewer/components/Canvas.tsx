/** Ekranların yerleştiği tuval. Ölçeği hesaplar ve frame'leri dizer. */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { actions, deviceById, frameSize, useApp } from '../store'
import { FrameView } from './FrameView'
import { IcDevices } from './Icons'
import { BUILTIN_SETS } from '@/devices/catalog'

export function Canvas() {
  const app = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(1200)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setAvail(el.clientWidth - 40))
    ro.observe(el)
    setAvail(el.clientWidth - 40)
    return () => ro.disconnect()
  }, [])

  const visible = app.frames.filter((f) => !f.hidden)

  /* "Sığdır": en geniş ekran tuvale sığacak şekilde ölçekle.
     Tek sıra yerleşiminde hepsinin toplam genişliği esas alınır. */
  let fit = 1
  if (visible.length) {
    const widths = visible.map((f) => frameSize(f).w)
    if (app.layout === 'row') {
      const total = widths.reduce((a, b) => a + b, 0) + app.gap * (widths.length - 1)
      fit = Math.min(1, avail / Math.max(1, total))
    } else {
      fit = Math.min(1, avail / Math.max(1, Math.max(...widths)))
    }
    fit = Math.max(0.08, fit)
  }
  window.__rsFitScale = fit
  const scale = app.zoom === 'fit' ? fit : app.zoom

  /* Otomatik yenileme */
  useEffect(() => {
    const sec = app.settings.autoReload
    if (!sec) return
    const id = setInterval(() => actions.reloadAll(), sec * 1000)
    return () => clearInterval(id)
  }, [app.settings.autoReload])

  return (
    <div ref={ref} class={`canvas${app.chromeOpts.canvasGrid ? ' grid-bg' : ''}`}>
      {visible.length === 0 ? (
        <div class="empty">
          <IcDevices style={{ width: 34, height: 34, opacity: .45 }} />
          <h2>Hiç ekran seçilmedi</h2>
          <p>Soldaki panelden cihaz seçin ya da aşağıdaki hazır setlerden birini uygulayın.</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {BUILTIN_SETS.slice(0, 5).map((set) => (
              <button key={set.id} class="btn primary" title={`${set.name} setini uygula`} onClick={() => actions.applySet(set.deviceIds)}>
                {set.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div class={`stage ${app.layout}`}>
          {visible.map((f, i) => {
            const dev = deviceById(app.settings, f.deviceId)
            if (!dev) return null
            const s = f.zoom != null ? f.zoom : scale
            return <FrameView key={f.fid} frame={f} device={dev} scale={s} index={i} />
          })}
        </div>
      )}
    </div>
  )
}
