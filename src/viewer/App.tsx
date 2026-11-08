/** Uygulama kabuğu: kısayollar, tema, HTTP UA senkronu ve düzen. */
import { useEffect } from 'preact/hooks'
import { actions, useApp } from './store'
import { bg } from './bus'
import { broadcast, sendTo } from './bus'
import { deviceById, tools } from './store'
import { Canvas } from './components/Canvas'
import { Drawer } from './components/Drawer'
import { Sidebar } from './components/Sidebar'
import { SyncBar, Toolbar } from './components/Toolbar'
import { ToolsBar } from './components/ToolsBar'
import { Tooltip } from './components/Tooltip'

export function App() {
  const app = useApp()

  /* Tema */
  useEffect(() => {
    document.documentElement.dataset.theme = app.settings.theme === 'light' ? 'light' : 'dark'
  }, [app.settings.theme])

  /* Sekme başlığı */
  useEffect(() => {
    const host = (() => { try { return new URL(app.url).host } catch { return '' } })()
    document.title = host ? `${host} — Responsive Studio` : 'Responsive Studio'
  }, [app.url])

  /* Sekme geneli HTTP User-Agent kuralı */
  useEffect(() => {
    void bg({ t: 'setHttpUserAgent', ua: app.settings.httpUserAgent, ch: null })
  }, [app.settings.httpUserAgent])

  /* Özel HTTP başlıkları — panel açılmasa da her oturumda ve adres değişince
     yeniden kurulur; kural yalnızca önizlenen sitenin alan adıyla sınırlı. */
  const headerHost = (() => { try { return new URL(app.url).hostname } catch { return '' } })()
  useEffect(() => {
    const t = setTimeout(() => {
      void bg({
        t: 'setCustomHeaders',
        host: headerHost,
        headers: app.settings.customHeaders.filter((h) => h.enabled),
      })
    }, 300)
    return () => clearTimeout(t)
  }, [app.settings.customHeaders, headerHost])

  /* Seçili bindirme aracını / ızgara ayarlarını tüm ekranlara ilet */
  useEffect(() => {
    broadcast({ t: 'tool', tool: app.tool, grid: app.grid })
  }, [app.tool, app.grid])

  /* Kullanıcı tercihi emülasyonu — stylesheet'ler her ekranda yeniden yazılır.
     Parmak modu cihaza bağlı olduğu için her ekrana ayrı gönderilir. */
  useEffect(() => {
    for (const f of app.frames) {
      if (f.hidden) continue
      const dev = deviceById(app.settings, f.deviceId)
      sendTo(f.fid, {
        t: 'media',
        overrides: app.media,
        touch: !!dev?.touch && app.settings.touchMode,
      })
    }
  }, [app.media, app.settings.touchMode, app.frames])

  /* Görme simülasyonu ve metin ölçeği */
  useEffect(() => {
    broadcast({ t: 'vision', sim: app.vision })
  }, [app.vision])

  useEffect(() => {
    broadcast({ t: 'textScale', percent: app.textScale })
  }, [app.textScale])

  /* Klavye kısayolları */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
        || el.isContentEditable)
      /* Açık bir pencere (modal) varken tek harfli kısayollar çalışmasın */
      const modalOpen = !!document.querySelector('.modal-bg')
      const mod = e.ctrlKey || e.metaKey

      if (e.key === 'Escape' && app.sync.soloFid) {
        actions.setSync({ soloFid: null }); return
      }
      if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); actions.reloadAll(); return }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); actions.togglePanel(); return }
      if (mod && e.key === '0') { e.preventDefault(); actions.setZoom('fit'); return }
      if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); actions.zoomStep(1); return }
      if (mod && e.key === '-') { e.preventDefault(); actions.zoomStep(-1); return }
      if (typing || mod || modalOpen) return

      /* Tasarım bindirmesini ok tuşlarıyla piksel piksel hizala (Shift = 10px) */
      if (e.key.startsWith('Arrow')) {
        const targets = app.sync.soloFid
          ? app.frames.filter((f) => f.fid === app.sync.soloFid && f.overlay)
          : app.frames.filter((f) => f.overlay && !f.hidden)
        if (targets.length) {
          e.preventDefault()
          const d = e.shiftKey ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0
          const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0
          for (const f of targets) {
            tools.patchOverlay(f.fid, { x: f.overlay!.x + dx, y: f.overlay!.y + dy })
          }
          return
        }
      }

      if (e.key.toLowerCase() === 'r') { actions.rotateAll() }
      if (e.key.toLowerCase() === 'o') { tools.setTool('outline') }
      if (e.key.toLowerCase() === 'g') { tools.setTool('grid') }
      if (e.key.toLowerCase() === 'i') { tools.setTool('inspect') }
      if (e.key.toLowerCase() === 't') { tools.setTool('overflow') }
      if (e.key.toLowerCase() === 'm') { tools.setTool('measure') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [app.sync.soloFid, app.frames])

  return (
    <div class="app">
      <Toolbar />
      <SyncBar />
      <ToolsBar />
      <div class="body">
        <Sidebar />
        <div class="main">
          <Canvas />
          <Drawer />
        </div>
      </div>
      {app.toast && <div class={`toast ${app.toast.kind}`}>{app.toast.text}</div>}
      <Tooltip />
    </div>
  )
}
