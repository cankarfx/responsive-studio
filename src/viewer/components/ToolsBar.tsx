/** İnceleme araçları çubuğu: bindirmeler, tarayıcılar, ekran görüntüsü. */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { ScanKind, VisionSim } from '@/lib/types'
import type { DrawerTab } from '../store'
import { actions, getState, tools, useApp } from '../store'
import { sendTo } from '../bus'
import {
  canvasToBlob, captureAll, captureFrame, contactSheet, copyToClipboard, download,
  makeZip, pickColor, slug, stamp,
} from '../capture'
import { startRecording, stopRecording } from '../record'
import {
  IcA11y, IcCamera, IcCode, IcCopy, IcDropper, IcEye, IcGrid, IcRecord, IcReport,
  IcStop, IcTarget, IcTerminal, IcTouch, IcWarn, IcZoom,
} from './Icons'

export function ToolsBar() {
  const app = useApp()
  const t = app.tool

  /** Bir taramayı ilk hazır ekranda çalıştırır (sayfa hepsinde aynı olduğu için yeterli). */
  function scan(what: ScanKind, tab: DrawerTab) {
    const first = app.frames.find((f) => !f.hidden && app.frameInfo[f.fid]?.ready)
    if (!first) { actions.toast('Önce bir sayfa yükleyin', 'error'); return }
    sendTo(first.fid, { t: 'scan', what })
    tools.openDrawer(tab)
  }

  /** Vitals ve taşma her ekranda ayrı anlamlı — hepsinde çalıştır. */
  function scanAll(what: ScanKind, tab: DrawerTab) {
    const list = app.frames.filter((f) => !f.hidden && app.frameInfo[f.fid]?.ready)
    if (!list.length) { actions.toast('Önce bir sayfa yükleyin', 'error'); return }
    for (const f of list) sendTo(f.fid, { t: 'scan', what })
    tools.openDrawer(tab)
  }

  return (
    <div class="subbar tools">
      <span class="lbl" title="Ekranların üzerine çizilen görsel yardımcılar">Bindirme</span>
      <button class={`chip${t === 'outline' ? ' on' : ''}`} title="Tüm elemanların sınırlarını göster"
              onClick={() => tools.setTool('outline')}><IcGrid /> Kontur</button>
      <button class={`chip${t === 'overflow' ? ' on' : ''}`} title="Yatay taşmaya sebep olan elemanları işaretle"
              onClick={() => { tools.setTool('overflow'); if (getState().tool === 'overflow') tools.openDrawer('overflow') }}>
        <IcWarn /> Taşma</button>
      <button class={`chip${t === 'grid' ? ' on' : ''}`} title="Kolon / taban çizgisi ızgarası"
              onClick={() => tools.setTool('grid')}><IcGrid /> Izgara</button>
      {t === 'grid' && <GridControls />}
      <button class={`chip${t === 'inspect' ? ' on' : ''}`} title="Elemana tıkla — tüm ekranlarda eşleniği vurgulanır"
              onClick={() => tools.setTool('inspect')}><IcTarget /> Denetçi</button>
      <button class={`chip${app.settings.touchMode ? ' on' : ''}`}
              title={app.settings.touchMode
                ? 'Parmak modu AÇIK — mobil ekranlar dokunmatik gibi davranıyor: hover stilleri uygulanmıyor, CSS pointer/hover sorguları dokunmatik. Kapatmak için tıklayın.'
                : 'Parmak modu KAPALI — mobil ekranlar fareyle kullanılıyormuş gibi davranıyor. Hover durumlarını incelemek için uygundur.'}
              onClick={() => actions.setSettings({ touchMode: !app.settings.touchMode })}>
        <IcTouch /> Parmak
      </button>
      <button class={`chip${t === 'measure' ? ' on' : ''}`} title="Artı kılavuz + sürükleyerek piksel ölçümü (Esc ile sıfırla)"
              onClick={() => tools.setTool('measure')}><IcZoom /> Cetvel</button>

      <div class="sep" />
      <ReportMenu run={(w, tab, all) => (all ? scanAll(w, tab) : scan(w, tab))} />
      <A11yMenu run={(w, tab, all) => (all ? scanAll(w, tab) : scan(w, tab))} />
      <DevMenu run={(w, tab, all) => (all ? scanAll(w, tab) : scan(w, tab))} />

      <div class="sep" />
      <VisionMenu />
      <MediaMenu />
      <TextScaleMenu />
      <CaptureMenu />
      <button class="chip icon-chip" title="Damlalık — ekrandan renk seç, panoya kopyalanır"
              onClick={() => void pickColor()}><IcDropper /></button>
      <button class={`chip icon-chip${app.recording ? ' on rec' : ''}`}
              title={app.recording ? 'Kaydı durdur ve WebM olarak indir' : 'Ekran kaydı — etkileşimleri WebM video olarak kaydet'}
              onClick={() => {
                if (app.recording) stopRecording()
                else void startRecording((() => { try { return new URL(app.url).hostname } catch { return 'kayit' } })())
              }}>
        {app.recording ? <IcStop /> : <IcRecord />}
      </button>

      <div class="sep" />
      <button class={`chip icon-chip${app.drawer.open && app.drawer.tab === 'console' ? ' on' : ''}`}
              title={app.consoleLogs.length
                ? `Konsol — tüm ekranlardan ${app.consoleLogs.length} kayıt toplandı`
                : 'Konsol — tüm ekranlardan toplanan hata ve uyarılar'}
              onClick={() => tools.openDrawer('console')}>
        <IcTerminal />
        {app.consoleLogs.length > 0 && (
          <span class="cnt" style={{
            background: app.consoleLogs.some((l) => l.level === 'error') ? 'var(--err)' : 'var(--warn)',
          }}>{app.consoleLogs.length}</span>
        )}
      </button>
    </div>
  )
}

/* ─── Izgara ayarları ──────────────────────────────────────────────── */

function GridControls() {
  const app = useApp()
  const g = app.grid
  return (
    <>
      <span class="lbl">kolon</span>
      <input class="num" type="number" min="0" max="24" value={g.columns}
             onInput={(e) => tools.setGrid({ columns: +(e.target as HTMLInputElement).value })} />
      <span class="lbl">boşluk</span>
      <input class="num" type="number" min="0" max="120" value={g.gutter}
             onInput={(e) => tools.setGrid({ gutter: +(e.target as HTMLInputElement).value })} />
      <span class="lbl">maks</span>
      <input class="num w4" type="number" min="0" max="3000" step="20" value={g.maxWidth}
             onInput={(e) => tools.setGrid({ maxWidth: +(e.target as HTMLInputElement).value })} />
      <span class="lbl">taban</span>
      <input class="num" type="number" min="0" max="64" value={g.baseline}
             onInput={(e) => tools.setGrid({ baseline: +(e.target as HTMLInputElement).value })} />
      <span class="lbl">kare</span>
      <input class="num" type="number" min="0" max="200" step="4" value={g.square}
             onInput={(e) => tools.setGrid({ square: +(e.target as HTMLInputElement).value })} />
    </>
  )
}

/* ─── Sayfa raporları ──────────────────────────────────────────────── */

const RAPORLAR: { what: ScanKind; tab: DrawerTab; label: string; hint: string; all?: boolean }[] = [
  { what: 'breakpoints', tab: 'breakpoints', label: 'CSS kırılım noktaları', hint: 'Media query’leri çıkar, her biri için ekran ekle' },
  { what: 'links', tab: 'links', label: 'Bağlantı denetimi', hint: 'Tüm bağlantıların HTTP durumu, 404 kontrolü' },
  { what: 'assets', tab: 'assets', label: 'Görsel ve medya', hint: 'Kırık görseller, gereğinden büyük dosyalar' },
  { what: 'fonts', tab: 'fonts', label: 'Font envanteri', hint: 'Kullanılan aileler, ağırlıklar, önizleme' },
  { what: 'vitals', tab: 'vitals', label: 'Web Vitals', hint: 'LCP / CLS / INP — her ekran için ayrı', all: true },
  { what: 'meta', tab: 'meta', label: 'Meta ve SEO', hint: 'title, description, canonical, og:*, başlık yapısı' },
]

function ReportMenu({ run }: { run: (what: ScanKind, tab: DrawerTab, all?: boolean) => void }) {
  const app = useApp()
  const acik = RAPORLAR.some((r) => app.drawer.open && app.drawer.tab === r.tab)
  return (
    <Menu label="Rapor" on={acik} icon={<IcReport />}
          tip="Sayfa raporları — kırılım noktaları, bağlantılar, görseller, fontlar, Web Vitals, meta">
      {(close) => RAPORLAR.map((r) => (
        <button key={r.tab} class="menu-item" onClick={() => { close(); run(r.what, r.tab, r.all) }}>
          <span>{r.label}</span><small>{r.hint}</small>
        </button>
      ))}
    </Menu>
  )
}

/* ─── Erişilebilirlik denetimleri ──────────────────────────────────── */

const A11Y: { what: ScanKind; tab: DrawerTab; label: string; hint: string; all?: boolean }[] = [
  { what: 'axe', tab: 'axe', label: 'Tam denetim (axe-core)', hint: 'WCAG 2.0/2.1/2.2 AA — ilk çalıştırmada birkaç saniye sürer' },
  { what: 'contrast', tab: 'contrast', label: 'Renk kontrastı', hint: 'AA eşiğinin altında kalan metinler', all: true },
  { what: 'headings', tab: 'headings', label: 'Başlık yapısı', hint: 'Hiyerarşi ve atlanan seviyeler' },
  { what: 'landmarks', tab: 'landmarks', label: 'Landmark / ARIA', hint: 'Ekran okuyucu gezinme bölgeleri' },
  { what: 'images', tab: 'images', label: 'Alt metin denetimi', hint: 'Eksik ve anlamsız alt nitelikleri' },
  { what: 'tabOrder', tab: 'tabOrder', label: 'Tab sırası', hint: 'Klavye odak sırası ve pozitif tabindex' },
  { what: 'targets', tab: 'targets', label: 'Dokunma hedefleri', hint: '44×44 altındaki hedefler — ekrana göre değişir', all: true },
  { what: 'meta', tab: 'social', label: 'Sosyal önizleme', hint: '9 platformda paylaşım görünümü' },
  { what: 'pwa', tab: 'pwa', label: 'PWA & favicon', hint: 'Manifest, ikonlar, service worker, HTTPS' },
]

function A11yMenu({ run }: { run: (what: ScanKind, tab: DrawerTab, all?: boolean) => void }) {
  const app = useApp()
  const acik = A11Y.some((a) => app.drawer.open && app.drawer.tab === a.tab)
  return (
    <Menu label="Erişilebilirlik" on={acik} icon={<IcA11y />}
          tip="Erişilebilirlik denetimleri — axe-core, kontrast, başlık yapısı, tab sırası ve daha fazlası">
      {(close) => A11Y.map((a) => (
        <button key={a.tab} class="menu-item" onClick={() => { close(); run(a.what, a.tab, a.all) }}>
          <span>{a.label}</span><small>{a.hint}</small>
        </button>
      ))}
    </Menu>
  )
}

/* ─── Geliştirici araçları ─────────────────────────────────────────── */

function DevMenu({ run }: { run: (what: ScanKind, tab: DrawerTab, all?: boolean) => void }) {
  const app = useApp()
  const acik = ['code', 'cssvars', 'storage', 'headers'].includes(app.drawer.tab) && app.drawer.open
  return (
    <Menu label="Geliştirici" on={acik} icon={<IcCode />}
          tip="Geliştirici araçları — canlı CSS/JS, CSS değişkenleri, depolama, özel HTTP başlıkları">
      {(close) => [
        <button key="code" class="menu-item" onClick={() => { close(); tools.openDrawer('code') }}>
          <span>Canlı CSS / JS</span><small>Tüm ekranlara anında uygulanan not defteri</small>
        </button>,
        <button key="vars" class="menu-item" onClick={() => { close(); run('cssvars', 'cssvars') }}>
          <span>CSS değişkenleri</span><small>Tasarım jetonları, renk önizlemeleriyle</small>
        </button>,
        <button key="st" class="menu-item" onClick={() => { close(); run('storage', 'storage') }}>
          <span>Depolama ve çerezler</span><small>localStorage, sessionStorage, çerez yönetimi</small>
        </button>,
        <button key="hd" class="menu-item" onClick={() => { close(); tools.openDrawer('headers') }}>
          <span>Özel HTTP başlıkları</span><small>Basic auth, feature flag, API anahtarı</small>
        </button>,
        <button key="td" class="menu-item" onClick={() => { close(); run('touchDiag', 'touchDiag', true) }}>
          <span>Parmak modu tanısı</span><small>Hangi ekranda ne uygulanabildi — sorun giderme</small>
        </button>,
      ]}
    </Menu>
  )
}

/* ─── Görme simülasyonu ────────────────────────────────────────────── */

const VISIONS: { value: VisionSim; label: string; hint: string }[] = [
  { value: 'none', label: 'Normal görme', hint: 'Simülasyon yok' },
  { value: 'protanopia', label: 'Protanopi', hint: 'Kırmızı körlüğü — erkeklerin ~%1’i' },
  { value: 'deuteranopia', label: 'Döteranopi', hint: 'Yeşil körlüğü — en yaygın tip, ~%6' },
  { value: 'tritanopia', label: 'Tritanopi', hint: 'Mavi–sarı körlüğü — nadir' },
  { value: 'protanomaly', label: 'Protanomali', hint: 'Kırmızı zayıflığı (kısmi)' },
  { value: 'deuteranomaly', label: 'Döteranomali', hint: 'Yeşil zayıflığı (kısmi)' },
  { value: 'achromatopsia', label: 'Akromatopsi', hint: 'Tam renk körlüğü' },
  { value: 'grayscale', label: 'Gri ton', hint: 'Yalnızca renkle ayrışan öğeleri yakalar' },
  { value: 'blur', label: 'Bulanık (göz kısma)', hint: 'Görsel hiyerarşiyi test eder' },
  { value: 'contrast', label: 'Yüksek kontrast', hint: 'Zayıf kontrastları belirginleştirir' },
  { value: 'invert', label: 'Ters', hint: 'Hızlı koyu mod bakışı' },
]

function VisionMenu() {
  const app = useApp()
  const cur = VISIONS.find((v) => v.value === app.vision) ?? VISIONS[0]
  return (
    <Menu label={app.vision === 'none' ? 'Görme' : `Görme: ${cur.label}`}
           on={app.vision !== 'none'} icon={<IcEye />}
           tip="Görme simülasyonu — renk körlüğü tipleri, gri ton, bulanıklık ve kontrast testleri">
      {(close) => VISIONS.map((v) => (
        <button key={v.value} class={`menu-item${app.vision === v.value ? ' on' : ''}`}
                onClick={() => { tools.setVision(v.value === 'none' ? app.vision : v.value); close() }}>
          <span>{v.label}</span><small>{v.hint}</small>
        </button>
      ))}
    </Menu>
  )
}

/* ─── Kullanıcı tercihi (medya) emülasyonu ─────────────────────────── */

function MediaMenu() {
  const app = useApp()
  const m = app.media
  const aktif = m.colorScheme !== 'auto' || m.reducedMotion !== 'auto'
    || m.contrast !== 'auto' || m.forcedColors !== 'auto'
  const etiket = m.colorScheme === 'dark' ? 'Koyu mod'
    : m.colorScheme === 'light' ? 'Açık mod'
    : aktif ? 'Özel' : 'Otomatik'

  const Row = ({ label, hint, value, options, onPick }: {
    label: string; hint: string; value: string
    options: { v: string; l: string }[]
    onPick: (v: string) => void
  }) => (
    <div class="menu-row">
      <div class="menu-row-head"><b>{label}</b><small>{hint}</small></div>
      <div class="seg">
        {options.map((o) => (
          <button key={o.v} class={`btn sm${value === o.v ? ' on' : ''}`}
                  onClick={() => onPick(o.v)}>{o.l}</button>
        ))}
      </div>
    </div>
  )

  return (
    <Menu label={aktif ? `Tercih: ${etiket}` : 'Tercih'} on={aktif}
           tip="Kullanıcı tercihi emülasyonu — koyu mod, azaltılmış hareket, yüksek kontrast (gerçek CSS)">
      {() => (
        <div style={{ minWidth: 300 }}>
          <Row label="Renk şeması" hint="prefers-color-scheme — sitenin kendi koyu mod stilleri"
               value={m.colorScheme}
               options={[{ v: 'auto', l: 'Otomatik' }, { v: 'light', l: 'Açık' }, { v: 'dark', l: 'Koyu' }]}
               onPick={(v) => tools.setMedia({ colorScheme: v as never })} />
          <Row label="Azaltılmış hareket" hint="prefers-reduced-motion — animasyonlar kapanmalı"
               value={m.reducedMotion}
               options={[{ v: 'auto', l: 'Otomatik' }, { v: 'reduce', l: 'Azalt' }, { v: 'no-preference', l: 'Normal' }]}
               onPick={(v) => tools.setMedia({ reducedMotion: v as never })} />
          <Row label="Kontrast tercihi" hint="prefers-contrast"
               value={m.contrast}
               options={[{ v: 'auto', l: 'Otomatik' }, { v: 'more', l: 'Yüksek' }, { v: 'less', l: 'Düşük' }]}
               onPick={(v) => tools.setMedia({ contrast: v as never })} />
          <Row label="Zorlanmış renkler" hint="forced-colors — Windows Yüksek Kontrast kuralları"
               value={m.forcedColors}
               options={[{ v: 'auto', l: 'Otomatik' }, { v: 'active', l: 'Etkin' }]}
               onPick={(v) => tools.setMedia({ forcedColors: v as never })} />
          <div class="menu-note">
            Sitenin stylesheet'lerindeki ilgili <code>@media</code> kuralları yeniden yazılarak
            uygulanır — gerçek CSS davranışı, izin gerektirmez.
          </div>
        </div>
      )}
    </Menu>
  )
}

/* ─── Metin ölçekleme testi ────────────────────────────────────────── */

function TextScaleMenu() {
  const app = useApp()
  return (
    <Menu label={app.textScale === 100 ? 'Metin' : `Metin: %${app.textScale}`}
           on={app.textScale !== 100}
           tip="Metin ölçekleme testi — kök font boyutunu büyüterek WCAG 1.4.4 uyumunu kontrol edin">
      {(close) => (
        <div style={{ minWidth: 240 }}>
          {[100, 125, 150, 175, 200].map((v) => (
            <button key={v} class={`menu-item${app.textScale === v ? ' on' : ''}`}
                    onClick={() => { tools.setTextScale(v); close() }}>
              <span>Kök font %{v}{v === 100 ? ' (varsayılan)' : ''}</span>
            </button>
          ))}
          <div class="menu-note">
            WCAG 1.4.4, metnin iki katına kadar büyütülebilmesini ve içeriğin kaybolmamasını
            şart koşar. <code>rem</code> tabanlı yerleşimler bundan etkilenir; sabit
            <code>px</code> kullanan yerler ölçeklenmez.
          </div>
        </div>
      )}
    </Menu>
  )
}

/* ─── Ekran görüntüsü menüsü ───────────────────────────────────────── */

function CaptureMenu() {
  const app = useApp()

  async function run(kind: 'one' | 'allVisible' | 'allFull' | 'sheet' | 'copy') {
    try {
      const target = app.sync.soloFid ?? app.frames.find((f) => !f.hidden)?.fid
      const base = slug(new URL(app.url || 'https://sayfa').hostname) || 'sayfa'

      if (kind === 'copy') {
        if (!target) throw new Error('Ekran yok')
        await copyToClipboard(await captureFrame(target, { fullPage: false, withLabel: false }))
        actions.toast('Görüntü panoya kopyalandı', 'ok')
        return
      }
      if (kind === 'one') {
        if (!target) throw new Error('Ekran yok')
        const c = await captureFrame(target, { fullPage: true, withLabel: true })
        download(await canvasToBlob(c), `${base}-${stamp()}.png`)
        actions.toast('Görüntü indirildi', 'ok')
        return
      }
      if (kind === 'sheet') {
        const c = await contactSheet({ fullPage: false, withLabel: true })
        download(await canvasToBlob(c), `${base}-kontakt-${stamp()}.png`)
        actions.toast('Kontakt föy indirildi', 'ok')
        return
      }
      const shots = await captureAll({ fullPage: kind === 'allFull', withLabel: true })
      if (!shots.length) throw new Error('Yakalanacak ekran yok')
      const files = await Promise.all(shots.map(async (s, i) => ({
        name: `${String(i + 1).padStart(2, '0')}-${slug(s.frame.deviceId)}.png`,
        blob: await canvasToBlob(s.canvas),
      })))
      download(await makeZip(files), `${base}-${stamp()}.zip`)
      actions.toast(`${files.length} görüntü ZIP olarak indirildi`, 'ok')
    } catch (e) {
      actions.toast((e as Error).message, 'error')
    }
  }

  if (app.capture?.busy) {
    return <span class="chip on" title={app.capture.label}><span class="spin" /> {app.capture.label}</span>
  }

  return (
    <Menu label="Ekran görüntüsü" icon={<IcCamera />} iconOnly
           tip="Ekran görüntüsü — tek ekran tam sayfa, tüm ekranlar ZIP, kontakt föy, panoya kopyala">
      {(close) => [
        <button key="1" class="menu-item" onClick={() => { close(); void run('one') }}>
          <span>Bu ekran — tam sayfa</span><small>Sayfanın tamamı dilimlenip birleştirilir</small>
        </button>,
        <button key="2" class="menu-item" onClick={() => { close(); void run('copy') }}>
          <span>Bu ekran — panoya kopyala</span><small>Görünen alan, PNG olarak panoya</small>
        </button>,
        <button key="3" class="menu-item" onClick={() => { close(); void run('allVisible') }}>
          <span>Tüm ekranlar → ZIP</span><small>Görünen alan, her cihaz ayrı dosya</small>
        </button>,
        <button key="4" class="menu-item" onClick={() => { close(); void run('allFull') }}>
          <span>Tüm ekranlar → ZIP (tam sayfa)</span><small>Uzun sürebilir — her sayfa dilimlenir</small>
        </button>,
        <button key="5" class="menu-item" onClick={() => { close(); void run('sheet') }}>
          <span>Kontakt föy</span><small>Bütün ekranlar etiketli tek görselde</small>
        </button>,
      ]}
    </Menu>
  )
}

/* ─── Basit açılır menü ────────────────────────────────────────────── */

/**
 * Açılır menü.
 *
 * KONUMLANDIRMA NOTU: menü `position: fixed` ile çiziliyor, `absolute` ile değil.
 * Araç çubuğu (`.subbar`) yatay kaydırma için `overflow-x: auto; overflow-y: hidden`
 * taşıyor; absolute konumlanan bir menü bu kutuya kırpılıp yalnızca ince bir çizgi
 * olarak görünüyordu. Fixed konumlandırma kırpmayı tamamen aşar, ayrıca menü
 * çubuğun kaydırma genişliğine katkı vermediği için yerleşimi de bozmaz.
 */
export function Menu({ label, icon, on, iconOnly, tip, children }: {
  label: string
  icon?: preact.JSX.Element
  on?: boolean
  iconOnly?: boolean
  /** Fare üzerine gelince gösterilecek açıklama (yoksa etiket kullanılır) */
  tip?: string
  children: (close: () => void) => preact.ComponentChildren
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const ac = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, top: r.bottom + 5 })
    setOpen(true)
  }

  /* Menü sağ kenardan taşarsa içeri çek */
  useLayoutEffect(() => {
    if (!open || !pos) return
    const el = menuRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const pad = 8
    if (r.right > window.innerWidth - pad) {
      setPos({ left: Math.max(pad, window.innerWidth - pad - r.width), top: pos.top })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        class={`chip${on || open ? ' on' : ''}${iconOnly ? ' icon-chip' : ''}`}
        title={tip ?? label}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : ac())}
      >
        {icon}{!iconOnly && label}{!iconOnly && <span class="caret" />}
      </button>
      {open && pos && (
        <div ref={menuRef} class="menu" style={{ left: `${pos.left}px`, top: `${pos.top}px` }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </>
  )
}

export { IcCopy }
