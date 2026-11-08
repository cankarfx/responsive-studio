/** Üst çubuk (gezinme + yerleşim) ve alt çubuk (senkron seçenekleri). */
import { useEffect, useRef } from 'preact/hooks'
import { ConfirmButton } from './ConfirmButton'
import { actions, useApp } from '../store'
import {
  IcBack, IcClick, IcColumns, IcDevices, IcEye, IcFocus, IcForward, IcGrid, IcHover,
  IcKeyboard, IcLink, IcLogo, IcMinus, IcMoon, IcPlus, IcReload, IcRotate, IcRows,
  IcScroll, IcSun, IcTrash,
} from './Icons'

export function Toolbar() {
  const app = useApp()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); inputRef.current?.select() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const canBack = app.historyIndex > 0
  const canFwd = app.historyIndex < app.history.length - 1
  const zoomLabel = app.zoom === 'fit' ? 'Sığdır' : `${Math.round(app.zoom * 100)}%`

  return (
    <header class="topbar">
      <div class="brand" title="Responsive Studio — çoklu ekran test stüdyosu"><IcLogo /><span>Responsive Studio</span></div>

      <button class={`btn icon${app.panel ? ' on' : ''}`} title="Yan panel (Ctrl+B)"
              onClick={() => actions.togglePanel()}><IcDevices /></button>

      <div class="sep" />

      <button class="btn icon" title="Geri" disabled={!canBack} onClick={() => actions.back()}><IcBack /></button>
      <button class="btn icon" title="İleri" disabled={!canFwd} onClick={() => actions.forward()}><IcForward /></button>
      <button class="btn icon" title="Tümünü yenile (Ctrl+R)" onClick={() => actions.reloadAll()}><IcReload /></button>

      <div class="urlbar">
        <input
          ref={inputRef}
          value={app.draftUrl}
          placeholder="Adres girin — örn. localhost:3000 veya site.com"
          spellcheck={false}
          onInput={(e) => actions.setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') actions.navigate((e.target as HTMLInputElement).value)
            if (e.key === 'Escape') (e.target as HTMLInputElement).blur()
          }}
        />
        <button class="btn sm" title="Adrese git (Enter)" onClick={() => actions.navigate(app.draftUrl)}>Git</button>
      </div>

      <div class="sep" />

      <div class="seg" title="Yerleşim">
        <button class={`btn icon${app.layout === 'grid' ? ' on' : ''}`} title="Izgara"
                onClick={() => actions.setLayout('grid')}><IcGrid /></button>
        <button class={`btn icon${app.layout === 'row' ? ' on' : ''}`} title="Tek sıra (yatay kaydır)"
                onClick={() => actions.setLayout('row')}><IcRows /></button>
        <button class={`btn icon${app.layout === 'column' ? ' on' : ''}`} title="Tek sütun"
                onClick={() => actions.setLayout('column')}><IcColumns /></button>
        <button class={`btn icon${app.layout === 'focus' ? ' on' : ''}`} title="Ortalanmış"
                onClick={() => actions.setLayout('focus')}><IcFocus /></button>
      </div>

      <div class="seg" title="Ölçek">
        <button class="btn icon" title="Uzaklaştır (Ctrl+-)" onClick={() => actions.zoomStep(-1)}><IcMinus /></button>
        <button class={`btn${app.zoom === 'fit' ? ' on' : ''}`} style={{ minWidth: 54 }}
                title="Sığdır (Ctrl+0)"
                onClick={() => actions.setZoom(app.zoom === 'fit' ? 1 : 'fit')}>{zoomLabel}</button>
        <button class="btn icon" title="Yakınlaştır (Ctrl++)" onClick={() => actions.zoomStep(1)}><IcPlus /></button>
      </div>

      <button class="btn icon" title="Tüm ekranları çevir (R)" onClick={() => actions.rotateAll()}><IcRotate /></button>

      <button class="btn icon" title="Temayı değiştir"
              onClick={() => actions.setSettings({ theme: app.settings.theme === 'dark' ? 'light' : 'dark' })}>
        {app.settings.theme === 'dark' ? <IcSun /> : <IcMoon />}
      </button>
    </header>
  )
}

export function SyncBar() {
  const app = useApp()
  const s = app.sync
  const hidden = app.frames.filter((f) => f.hidden).length

  return (
    <div class="subbar">
      <span class="lbl" title="Bir ekranda yaptığınız işlemin diğerlerinde de tekrarlanması">Senkron</span>
      <button class={`chip${s.scroll ? ' on' : ''}`} title="Kaydırmayı tüm ekranlarda eşle"
              onClick={() => actions.setSync({ scroll: !s.scroll })}><IcScroll /> Kaydırma</button>
      {s.scroll && (
        <select class="sel sm" title="Oransal: farklı uzunluktaki sayfalarda hizalı kalır. Birebir px: aynı piksel konumuna kaydırır."
                value={s.scrollMode}
                onChange={(e) => actions.setSync({ scrollMode: (e.target as HTMLSelectElement).value as 'ratio' | 'absolute' })}>
          <option value="ratio">Oransal</option>
          <option value="absolute">Birebir px</option>
        </select>
      )}
      <button class={`chip${s.click ? ' on' : ''}`} title="Tıklamaları tüm ekranlarda tekrarla"
              onClick={() => actions.setSync({ click: !s.click })}><IcClick /> Tıklama</button>
      <button class={`chip${s.input ? ' on' : ''}`} title="Form girişlerini ve tuş vuruşlarını eşle"
              onClick={() => actions.setSync({ input: !s.input })}><IcKeyboard /> Giriş</button>
      <button class={`chip${s.hover ? ' on' : ''}`} title="Fare üzerindeyken durumu eşle"
              onClick={() => actions.setSync({ hover: !s.hover })}><IcHover /> Hover</button>
      <button class={`chip${s.navigation ? ' on' : ''}`} title="Bir ekranda bağlantıya tıklayınca hepsi gitsin"
              onClick={() => actions.setSync({ navigation: !s.navigation })}><IcLink /> Gezinme</button>

      {s.soloFid && (
        <button class="chip on" title="Tek-ekran modundan çık (Esc)" onClick={() => actions.setSync({ soloFid: null })}>
          Tek-ekran modu açık — çık (Esc)
        </button>
      )}

      <div class="sep" />
      <span class="lbl" title="Görünür ekran sayısı">{app.frames.length - hidden} ekran</span>
      {hidden > 0 && (
        <button class="chip" title="Gizlenen ekranları yeniden göster" onClick={() => actions.showAllFrames()}><IcEye /> {hidden} gizli — göster</button>
      )}
      <ConfirmButton class="chip" title="Tüm ekranları kaldır" onConfirm={() => actions.clearFrames()}
                     armedLabel={<><IcTrash /> Emin misiniz?</>}>
        <IcTrash /> Temizle
      </ConfirmButton>
    </div>
  )
}
