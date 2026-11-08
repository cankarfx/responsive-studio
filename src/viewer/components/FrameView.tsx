/** Tek bir cihaz ekranı: ölçeklenmiş iframe + başlık + boyutlandırma tutamakları. */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { DeviceSpec, Frame, FramePayload } from '@/lib/types'
import { buildUaData, buildUserAgent } from '@/lib/ua'
import { withPayload } from '@/lib/payload'
import { actions, frameSize, getState, tools, useApp } from '../store'
import { registerFrame, sendTo, TOKEN } from '../bus'
import {
  IcCamera, IcClose, IcExternal, IcEyeOff, IcMinus, IcPlus, IcReload, IcRotate, IcTarget, IcWarn,
} from './Icons'
import { canvasToBlob, captureFrame, download, slug, stamp } from '../capture'

const IFRAME_ALLOW = [
  'accelerometer', 'autoplay', 'clipboard-read', 'clipboard-write', 'encrypted-media',
  'fullscreen', 'gyroscope', 'magnetometer', 'picture-in-picture', 'web-share',
].join('; ')

/* Üst pencereyi ele geçirmeye (frame-busting) izin vermeyen izin listesi.
   allow-top-navigation* bilerek DIŞARIDA bırakıldı. */
const SANDBOX = [
  'allow-same-origin', 'allow-scripts', 'allow-forms', 'allow-popups',
  'allow-popups-to-escape-sandbox', 'allow-modals', 'allow-downloads',
  'allow-presentation', 'allow-pointer-lock', 'allow-orientation-lock',
  'allow-storage-access-by-user-activation', 'allow-same-site-none-cookies',
].join(' ')

interface Props {
  frame: Frame
  device: DeviceSpec
  scale: number
  index: number
}

export function FrameView({ frame, device, scale, index }: Props) {
  const app = useApp()
  const host = useRef<HTMLDivElement>(null)
  const { w, h } = frameSize(frame)
  const info = app.frameInfo[frame.fid] ?? {}
  const solo = app.sync.soloFid
  const dimmed = solo != null && solo !== frame.fid

  /* Yeniden yükleme anahtarı: bu değerler değiştiğinde iframe SIFIRDAN kurulur.
     (Yalnızca fragment değişirse tarayıcı aynı-belge gezinmesi yapar ve sayfa
     yeniden yüklenmez — bu yüzden elemanı tamamen değiştiriyoruz.) */
  const key = [app.url, app.reloadKey, frame.deviceId, frame.browser, frame.dpr,
    frame.colorScheme, app.chromeOpts.scrollbars, app.settings.frameBusting,
    app.settings.touchMode].join('|')

  /* Yüklenemeyen ekran: 'ready' hiç gelmezse kullanıcıya nedenini söyle
     (DNS hatası, kapalı localhost, site çerçeveyi reddediyor, file:// izni…) */
  const [slow, setSlow] = useState(false)
  const [warnClosed, setWarnClosed] = useState(false)
  useEffect(() => {
    setSlow(false); setWarnClosed(false)
    if (!app.url) return
    const t = setTimeout(() => setSlow(true), 15000 + index * (app.settings.loadStagger ?? 0))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const loadWarn = !warnClosed && !!app.url && (info.error || (slow && !info.ready))

  useLayoutEffect(() => {
    const parent = host.current
    if (!parent) return
    parent.replaceChildren()
    registerFrame(frame.fid, null)
    if (!app.url) return

    const payload: FramePayload = {
      token: TOKEN,
      fid: frame.fid,
      ua: buildUserAgent(device, frame.browser),
      uaData: buildUaData(device, frame.browser),
      width: w,
      height: h,
      /* Masaüstü presetlerinde viewport ile ekran farklıdır; `screen.*`
         fiziksel ekranı döndürmeli. Yön çevrildiyse ekran da çevrilir. */
      screenW: frame.landscape ? (device.screenH ?? h) : (device.screenW ?? w),
      screenH: frame.landscape ? (device.screenW ?? w) : (device.screenH ?? h),
      dpr: frame.dpr,
      touch: device.touch,
      touchMode: device.touch && app.settings.touchMode,
      colorScheme: frame.colorScheme,
      safeArea: device.safeArea ?? null,
      showScrollbars: app.chromeOpts.scrollbars,
      os: device.os,
      platform: device.os === 'ios' ? 'iPhone'
        : device.os === 'android' ? 'Linux armv81'
        : device.os === 'macos' || device.os === 'ipados' ? 'MacIntel'
        : device.os === 'linux' ? 'Linux x86_64' : 'Win32',
    }

    const el = document.createElement('iframe')
    el.setAttribute('allow', IFRAME_ALLOW)
    if (app.settings.frameBusting) el.setAttribute('sandbox', SANDBOX)
    el.setAttribute('referrerpolicy', 'no-referrer-when-downgrade')
    el.setAttribute('title', device.name)
    el.width = String(w)
    el.height = String(h)
    /* name yedek kanal; asıl yapılandırma fragment'ta (bkz. lib/payload.ts) */
    el.name = '__RSTUDIO__' + JSON.stringify(payload)

    /* SIRALAMA ÖNEMLİ: önce DOM'a ekle ve yerleşimi zorla, SONRA src ata.
       src, eleman yerleşmeden atanırsa gezinme sıfır boyutlu bir çerçevede
       başlıyor ve sayfanın erken çalışan satır içi script'leri
       `window.innerWidth` değerini 0 okuyor (ölçüldü). Bu, innerWidth'e göre
       yerleşim kuran siteleri yanlış render ettiriyordu. */
    parent.appendChild(el)
    void el.offsetWidth

    /* KADEMELİ YÜKLEME: sekiz ekranın aynı anda istek atması, hız sınırı olan
       sunucularda 429 (Too Many Requests) üretiyor ve sayfa hatalı yükleniyor.
       Küçük bir gecikme bunu önler; ilk ekran beklemeden başlar. */
    const src = withPayload(app.url, payload)
    const gecikme = index * (app.settings.loadStagger ?? 0)
    let zaman = 0
    if (gecikme > 0) zaman = setTimeout(() => { el.src = src }, gecikme) as unknown as number
    else el.src = src
    registerFrame(frame.fid, el)

    return () => { clearTimeout(zaman); registerFrame(frame.fid, null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  /* Yön/boyut değişiminde yeniden yüklemeden ölçüleri güncelle */
  useLayoutEffect(() => {
    const el = host.current?.firstElementChild as HTMLIFrameElement | null
    if (!el) return
    el.width = String(w)
    el.height = String(h)
  }, [w, h])

  useEffect(() => () => registerFrame(frame.fid, null), [frame.fid])

  /* Boyutlandırma tutamakları */
  const [resizing, setResizing] = useState<string | null>(null)
  function startResize(dir: 'e' | 's' | 'se', ev: PointerEvent) {
    ev.preventDefault(); ev.stopPropagation()
    setResizing(dir)
    const sx = ev.clientX, sy = ev.clientY, sw = w, sh = h
    const move = (e: PointerEvent) => {
      const nw = dir === 's' ? sw : Math.max(180, sw + Math.round((e.clientX - sx) / scale))
      const nh = dir === 'e' ? sh : Math.max(220, sh + Math.round((e.clientY - sy) / scale))
      actions.updateFrame(frame.fid, frame.landscape ? { height: nw, width: nh } : { width: nw, height: nh })
    }
    document.body.classList.add('dragging')
    const up = () => {
      document.body.classList.remove('dragging')
      setResizing(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', up)
  }

  async function shot() {
    try {
      const c = await captureFrame(frame.fid, { fullPage: true, withLabel: true })
      download(await canvasToBlob(c), `${slug(device.name)}-${stamp()}.png`)
      actions.toast(`${device.name} görüntüsü indirildi`, 'ok')
    } catch (e) {
      actions.toast((e as Error).message, 'error')
    }
  }

  /* Tasarım bindirmesi: PNG/JPG sürükle-bırak */
  function onDrop(e: DragEvent) {
    const file = e.dataTransfer?.files?.[0]
    if (!file || !/^image\//.test(file.type)) return
    e.preventDefault()
    const fr = new FileReader()
    fr.onload = () => {
      tools.setOverlay(frame.fid, {
        src: String(fr.result), opacity: 0.5, x: 0, y: 0, scale: 1,
        blend: 'normal', hidden: false,
      })
      actions.toast('Tasarım bindirildi — ok tuşlarıyla hizalayın', 'ok')
    }
    fr.readAsDataURL(file)
  }

  /* Bindirmeyi fareyle kaydır */
  function dragOverlay(ev: PointerEvent) {
    const ov = frame.overlay
    if (!ov) return
    ev.preventDefault()
    const sx = ev.clientX, sy = ev.clientY, ox = ov.x, oy = ov.y
    const move = (e: PointerEvent) => tools.patchOverlay(frame.fid, {
      x: ox + Math.round((e.clientX - sx) / scale),
      y: oy + Math.round((e.clientY - sy) / scale),
    })
    document.body.classList.add('dragging')
    const up = () => {
      document.body.classList.remove('dragging')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', up)
  }

  /**
   * Başlıktan tutup sürükleyerek ekranı yeniden sırala.
   *
   * HTML5 drag-and-drop yerine pointer olayları: sürükleme yolu iframe'lerin
   * üstünden geçiyor ve HTML5 DnD orada olayları yutuyor. Hedefi de
   * `elementFromPoint` ile değil, kare dikdörtgenlerini gezerek buluyoruz —
   * böylece iframe'lerin `pointer-events` durumu hiç önemli olmuyor.
   */
  function startReorder(ev: PointerEvent) {
    /* Başlıktaki butonlara basılmışsa karışma */
    if ((ev.target as HTMLElement)?.closest?.('.tools')) return
    if (ev.button !== 0) return
    const sx = ev.clientX, sy = ev.clientY
    let basladi = false

    const move = (e: PointerEvent) => {
      if (!basladi) {
        /* Eşik: küçük titremeler tıklamayı sürüklemeye çevirmesin */
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 6) return
        basladi = true
        document.body.classList.add('reordering')
      }
      e.preventDefault()

      /* Dikey yerleşimde üst/alt, diğerlerinde sol/sağ yarıya bakılır */
      const dikey = app.layout === 'column'
      let hedefFid: string | null = null
      let sonrasina = false
      let enYakin = Infinity
      for (const el of document.querySelectorAll<HTMLElement>('.stage .frame')) {
        const fid = el.dataset.fid
        if (!fid || fid === frame.fid) continue
        const r = el.getBoundingClientRect()
        const mx = r.left + r.width / 2, my = r.top + r.height / 2
        const d = Math.abs(e.clientX - mx) + Math.abs(e.clientY - my)
        if (d < enYakin) {
          enYakin = d
          hedefFid = fid
          sonrasina = dikey ? e.clientY > my : e.clientX > mx
        }
      }
      actions.setReorder({ fid: frame.fid, hedefFid, sonrasina })
    }

    const up = () => {
      /* Kapanışta yakalanan `app` bayat olabilir — durumu depodan oku */
      const son = getState().reorder
      if (son?.hedefFid) actions.moveFrameTo(son.fid, son.hedefFid, son.sonrasina)
      actions.setReorder(null)
      document.body.classList.remove('reordering')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const sa = app.chromeOpts.safeArea ? device.safeArea : null
  const island = sa && sa.top >= 55           // Dynamic Island (yüzen hap)
  const notch = sa && sa.top >= 40 && !island // klasik çentik
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)

  /* Yeniden sıralama görsel durumu */
  const ro = app.reorder
  const sur = ro?.fid === frame.fid
  const hedef = ro?.hedefFid === frame.fid
  const dropOnce = hedef && !ro!.sonrasina
  const dropSonra = hedef && ro!.sonrasina

  return (
    <div class={`frame${dimmed ? ' solo-dim' : ''}${sur ? ' dragging' : ''}`
           + (dropOnce ? ' drop-before' : '') + (dropSonra ? ' drop-after' : '')}
         data-fid={frame.fid}
         /* data-ready: kare içeriği 'ready' mesajını gönderdi mi — testler buna bakar */
         data-ready={info.ready ? '1' : '0'}
         style={{ width: `${cw}px`, marginRight: `${app.gap}px`, marginBottom: `${app.gap}px` }}>
      {app.chromeOpts.labels && (
        <div class="frame-head" onPointerDown={(e) => startReorder(e as unknown as PointerEvent)}>
          <span class="nm" title={`${device.name} — ${device.brand}\nSürükleyerek sırasını değiştirebilirsiniz`}>
            {device.name}</span>
          <span class="dim">{w}×{h}</span>
          {frame.dpr !== 1 && <span class="badge">@{frame.dpr}x</span>}
          {info.overflow && (
            <span class="badge warn" title="Sayfa yatay kaydırma taşması yapıyor">
              <IcWarn style={{ width: 10, height: 10 }} />
            </span>
          )}
          {solo === frame.fid && <span class="badge solo">tek</span>}
          <span class="tools">
            <button class={`btn icon${solo === frame.fid ? ' on' : ''}`}
                    title="Yalnızca bu ekranda çalış (senkronu geçici kapat)"
                    onClick={() => actions.setSync({ soloFid: solo === frame.fid ? null : frame.fid })}>
              <IcTarget /></button>
            <button class="btn icon" title="Çevir (dikey ↔ yatay)"
                    onClick={() => actions.rotateFrame(frame.fid)}><IcRotate /></button>
            <button class="btn icon" title="Bu ekranı yenile"
                    onClick={() => sendTo(frame.fid, { t: 'reload', hard: false })}><IcReload /></button>
            <button class="btn icon" title="Bu ekranın tam sayfa görüntüsünü indir"
                    onClick={() => void shot()}><IcCamera /></button>
            <button class="btn icon" title="Yeni sekmede aç"
                    onClick={() => window.open(app.url, '_blank')}><IcExternal /></button>
            <button class="btn icon" title="Gizle"
                    onClick={() => actions.updateFrame(frame.fid, { hidden: true })}><IcEyeOff /></button>
            <button class="btn icon danger" title="Kaldır"
                    onClick={() => actions.removeFrame(frame.fid)}><IcClose /></button>
          </span>
        </div>
      )}

      {frame.overlay && (
        <div class="ov-bar">
          <span class="lbl">Bindirme</span>
          <input type="range" min="0" max="100" value={Math.round(frame.overlay.opacity * 100)}
                 title="Opaklık"
                 onInput={(e) => tools.patchOverlay(frame.fid, { opacity: +(e.target as HTMLInputElement).value / 100 })} />
          <button class={`btn sm${frame.overlay.blend === 'difference' ? ' on' : ''}`} title="Fark (difference) modu — birebir hizalamada siyah verir"
                  onClick={() => tools.patchOverlay(frame.fid, { blend: frame.overlay!.blend === 'difference' ? 'normal' : 'difference' })}>fark</button>
          <button class="btn sm icon" title="Küçült"
                  onClick={() => tools.patchOverlay(frame.fid, { scale: Math.max(0.2, +(frame.overlay!.scale - 0.01).toFixed(3)) })}><IcMinus /></button>
          <span class="lbl mono">{Math.round(frame.overlay.scale * 100)}%</span>
          <button class="btn sm icon" title="Büyüt"
                  onClick={() => tools.patchOverlay(frame.fid, { scale: Math.min(4, +(frame.overlay!.scale + 0.01).toFixed(3)) })}><IcPlus /></button>
          <button class={`btn sm${frame.overlay.hidden ? ' on' : ''}`} title="Geçici gizle (karşılaştırma için)"
                  onClick={() => tools.patchOverlay(frame.fid, { hidden: !frame.overlay!.hidden })}>
            {frame.overlay.hidden ? 'göster' : 'gizle'}
          </button>
          <button class="btn sm icon danger" title="Bindirmeyi kaldır"
                  onClick={() => tools.setOverlay(frame.fid, null)}><IcClose /></button>
        </div>
      )}

      <div class={`frame-box${app.chromeOpts.bezel ? ' bezel' : ''}`}
           style={{ width: `${cw}px`, height: `${ch}px` }}
           onDragOver={(e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault() }}
           onDrop={(e) => onDrop(e as unknown as DragEvent)}>
        <div ref={host} class="frame-scaler"
             style={{ transform: `scale(${scale})`, width: `${w}px`, height: `${h}px` }} />

        {island && !frame.landscape && (
          <div class="island" style={{
            width: `${Math.round(125 * scale)}px`,
            height: `${Math.round(37 * scale)}px`,
            top: `${Math.round(11 * scale)}px`,
          }} />
        )}
        {notch && !frame.landscape && (
          <div class="notch" style={{
            width: `${Math.round(Math.min(210, w * 0.55) * scale)}px`,
            height: `${Math.round(30 * scale)}px`,
          }} />
        )}
        {sa && !frame.landscape && sa.bottom >= 30 && (
          <div class="home-ind" style={{ width: `${Math.round(w * 0.36 * scale)}px` }} />
        )}

        {frame.overlay && !frame.overlay.hidden && (
          <img
            class="overlay-img"
            src={frame.overlay.src}
            alt=""
            draggable={false}
            onPointerDown={(e) => dragOverlay(e as unknown as PointerEvent)}
            style={{
              opacity: frame.overlay.opacity,
              mixBlendMode: frame.overlay.blend,
              transform: `translate(${frame.overlay.x * scale}px, ${frame.overlay.y * scale}px) scale(${scale * frame.overlay.scale})`,
              width: `${w}px`,
            }}
          />
        )}

        {!app.url && <div class="frame-status">Yukarıdan bir adres girin</div>}
        {loadWarn && (
          <div class="frame-warn" role="status">
            <b>Bu ekran yüklenemedi ya da stüdyoya bağlanamadı.</b>
            <span>
              {info.error ? `${info.error} — ` : ''}
              {app.url.startsWith('file:')
                ? 'Yerel dosyalar için chrome://extensions → Responsive Studio → "Dosya URL\'lerine erişime izin ver" seçeneğini açın.'
                : 'Adres hatalı, sunucu kapalı ya da site çerçeve içinde açılmayı reddediyor olabilir.'}
            </span>
            <div class="frame-warn-actions">
              <button class="btn sm" title="Tüm ekranları yeniden yükle" onClick={() => actions.reloadAll()}>Yenile</button>
              <button class="btn sm" title="Bu uyarıyı gizle" onClick={() => setWarnClosed(true)}>Kapat</button>
            </div>
          </div>
        )}

        <div class={`rsz e${resizing === 'e' ? ' active' : ''}`}
             onPointerDown={(e) => startResize('e', e as unknown as PointerEvent)} />
        <div class={`rsz s${resizing === 's' ? ' active' : ''}`}
             onPointerDown={(e) => startResize('s', e as unknown as PointerEvent)} />
        <div class={`rsz se${resizing === 'se' ? ' active' : ''}`}
             onPointerDown={(e) => startResize('se', e as unknown as PointerEvent)} />
      </div>
    </div>
  )
}
