/** Alt panel: konsol, kırılım noktaları, taşma, denetçi ve tarama raporları. */
import { useMemo } from 'preact/hooks'
import type { ScanKind, ScanResult } from '@/lib/types'
import { actions, deviceById, tools, useApp, type DrawerTab } from '../store'
import { broadcast, sendTo } from '../bus'
import { IcClose, IcPlus, IcReload, IcTrash, IcWarn } from './Icons'
import {
  AxeView, ContrastView, HeadingsView, ImagesA11yView, LandmarksView, PwaView, TabOrderView, TargetsView,
} from './A11yViews'
import { SocialView } from './Social'
import { CodeView, CssVarsView, HeadersView, StorageView, TouchDiagView } from './DevViews'

/** `grp: true` olan sekmeden önce görsel ayraç çizilir. */
const TABS: { id: DrawerTab; label: string; grp?: boolean; tip: string }[] = [
  { id: 'console', label: 'Konsol', tip: 'Tüm ekranlardan toplanan hata ve uyarılar' },
  { id: 'breakpoints', label: 'Kırılım noktaları', tip: 'Sayfanın CSS’indeki media query kırılım noktaları' },
  { id: 'overflow', label: 'Taşma', tip: 'Yatay taşmaya sebep olan elemanlar' },
  { id: 'inspect', label: 'Denetçi', tip: 'Seçilen elemanın kutu modeli ve hesaplanmış stilleri' },
  { id: 'links', label: 'Bağlantılar', tip: 'Bağlantıların HTTP durumu ve kırık bağlantılar' },
  { id: 'assets', label: 'Görseller', tip: 'Kırık ve gereğinden büyük görseller' },
  { id: 'fonts', label: 'Fontlar', tip: 'Sayfada kullanılan font aileleri ve ağırlıkları' },
  { id: 'vitals', label: 'Web Vitals', tip: 'LCP / CLS / INP — her ekran için ayrı ölçüm' },
  { id: 'meta', label: 'Meta', tip: 'title, description, canonical, og:* ve başlık yapısı' },
  { id: 'axe', label: 'Denetim', grp: true, tip: 'axe-core ile tam WCAG 2.2 AA denetimi' },
  { id: 'contrast', label: 'Kontrast', tip: 'AA eşiğinin altında kalan metin kontrastları' },
  { id: 'headings', label: 'Başlıklar', tip: 'Başlık hiyerarşisi ve atlanan seviyeler' },
  { id: 'landmarks', label: 'Landmark', tip: 'Ekran okuyucu gezinme bölgeleri (ARIA landmark)' },
  { id: 'images', label: 'Alt metin', tip: 'Görsellerin alternatif metin denetimi' },
  { id: 'tabOrder', label: 'Tab sırası', tip: 'Klavye odak sırası ve pozitif tabindex uyarıları' },
  { id: 'targets', label: 'Hedefler', tip: '44×44 pikselden küçük dokunma hedefleri' },
  { id: 'social', label: 'Sosyal', tip: '9 platformdaki paylaşım önizlemesi' },
  { id: 'pwa', label: 'PWA', tip: 'Manifest, ikonlar, service worker ve HTTPS denetimi' },
  { id: 'code', label: 'Canlı kod', grp: true, tip: 'Tüm ekranlara uygulanan canlı CSS ve JS' },
  { id: 'cssvars', label: 'CSS değişkenleri', tip: 'Sayfanın CSS özel değişkenleri (tasarım jetonları)' },
  { id: 'storage', label: 'Depolama', tip: 'localStorage, sessionStorage ve çerez yönetimi' },
  { id: 'headers', label: 'HTTP başlıkları', tip: 'Yalnızca bu sekmeye eklenen özel HTTP başlıkları' },
  { id: 'touchDiag', label: 'Parmak tanısı', tip: 'Parmak modunun her ekranda ne yapabildiğinin dökümü' },
]

export function Drawer() {
  const app = useApp()
  if (!app.drawer.open) return null

  function startResize(ev: PointerEvent) {
    ev.preventDefault()
    const startY = ev.clientY
    const startH = app.drawer.height
    const move = (e: PointerEvent) => tools.setDrawerHeight(startH - (e.clientY - startY))
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

  return (
    <div class="drawer" style={{ height: `${app.drawer.height}px` }}>
      <div class="drawer-grip" onPointerDown={(e) => startResize(e as unknown as PointerEvent)} />
      <div class="drawer-head">
        {TABS.map((t) => (
          <>
            {t.grp && <span key={`g-${t.id}`} class="grp" />}
            <button key={t.id} class={`btn sm${app.drawer.tab === t.id ? ' on' : ''}`}
                    title={t.tip}
                    onClick={() => tools.openDrawer(t.id)}>{t.label}</button>
          </>
        ))}
        <span style={{ flex: 1 }} />
        {app.drawer.tab === 'console' && app.consoleLogs.length > 0 && (
          <button class="btn sm" onClick={() => tools.clearConsole()}><IcTrash /> Temizle</button>
        )}
        <button class="btn sm icon" title="Kapat" onClick={() => tools.closeDrawer()}><IcClose /></button>
      </div>
      <div class="drawer-body">
        {app.drawer.tab === 'console' && <ConsoleView />}
        {app.drawer.tab === 'breakpoints' && <BreakpointsView />}
        {app.drawer.tab === 'overflow' && <OverflowView />}
        {app.drawer.tab === 'inspect' && <InspectView />}
        {app.drawer.tab === 'links' && <LinksView />}
        {app.drawer.tab === 'assets' && <AssetsView />}
        {app.drawer.tab === 'fonts' && <FontsView />}
        {app.drawer.tab === 'vitals' && <VitalsView />}
        {app.drawer.tab === 'meta' && <MetaView />}
        {app.drawer.tab === 'axe' && <AxeView />}
        {app.drawer.tab === 'contrast' && <ContrastView />}
        {app.drawer.tab === 'headings' && <HeadingsView />}
        {app.drawer.tab === 'landmarks' && <LandmarksView />}
        {app.drawer.tab === 'images' && <ImagesA11yView />}
        {app.drawer.tab === 'tabOrder' && <TabOrderView />}
        {app.drawer.tab === 'targets' && <TargetsView />}
        {app.drawer.tab === 'social' && <SocialView />}
        {app.drawer.tab === 'pwa' && <PwaView />}
        {app.drawer.tab === 'code' && <CodeView />}
        {app.drawer.tab === 'cssvars' && <CssVarsView />}
        {app.drawer.tab === 'storage' && <StorageView />}
        {app.drawer.tab === 'headers' && <HeadersView />}
        {app.drawer.tab === 'touchDiag' && <TouchDiagView />}
      </div>
    </div>
  )
}

/** Tarama sonucunu ilk bulunan ekrandan alır. */
function useFirstScan<K extends keyof ScanResult>(key: K): ScanResult[K] | undefined {
  const app = useApp()
  for (const fid of Object.keys(app.scans)) {
    const v = app.scans[fid]?.[key as never] as ScanResult | undefined
    if (v?.[key] !== undefined) return v[key]
  }
  return undefined
}

function Empty({ text }: { text: string }) {
  return <div class="drawer-empty">{text}</div>
}

/** Taramayı hazır olan tüm ekranlarda yeniden çalıştırır. */
function Rescan({ what, all }: { what: ScanKind; all?: boolean }) {
  const app = useApp()
  return (
    <button class="btn sm" style={{ marginLeft: 'auto', border: '1px solid var(--line)' }}
            onClick={() => {
              const list = app.frames.filter((f) => !f.hidden && app.frameInfo[f.fid]?.ready)
              for (const f of all ? list : list.slice(0, 1)) sendTo(f.fid, { t: 'scan', what })
            }}>
      <IcReload /> Yeniden tara
    </button>
  )
}

/* ─── Konsol ───────────────────────────────────────────────────────── */

function ConsoleView() {
  const app = useApp()
  if (!app.consoleLogs.length) {
    return <Empty text="Henüz hata veya uyarı yok. Sayfayı kullandıkça buraya düşecek." />
  }
  const name = (fid: string) => {
    const f = app.frames.find((x) => x.fid === fid)
    return f ? deviceById(app.settings, f.deviceId)?.name ?? '?' : '?'
  }
  /* En yeni üstte */
  const list = [...app.consoleLogs].reverse()
  return (
    <table class="tbl">
      <tbody>
        {list.map((l, i) => (
          <tr key={i}>
            <td class="w1"><span class={`dot ${l.level}`} /></td>
            <td class="w2 mut">{name(l.fid)}</td>
            <td class="mono">{l.text}{l.source ? <span class="mut"> · {l.source}</span> : null}</td>
            <td class="w1 mut">{l.count > 1 ? `×${l.count}` : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ─── Kırılım noktaları ────────────────────────────────────────────── */

function BreakpointsView() {
  const app = useApp()
  const bps = useFirstScan('breakpoints')
  const active = useMemo(() => new Set(app.frames.map((f) => (f.landscape ? f.height : f.width))), [app.frames])

  if (!bps) return <Empty text="“Kırılımlar” düğmesine basarak sayfanın CSS'ini tarayın." />
  if (!bps.length) return <Empty text="Sayfanın CSS'inde genişlik tabanlı media query bulunamadı." />

  /* Her kırılım için test edilmesi mantıklı genişlik:
     max-width kuralı için tam değer ve 1px altı; min-width için tam değer. */
  function addFrameAt(px: number, label: string) {
    const id = `bp-auto-${px}`
    if (!app.settings.customDevices.some((d) => d.id === id)) {
      actions.addCustomDevice({
        id, name: `${label} (${px}px)`, brand: 'Kırılım', category: 'custom',
        width: px, height: 900, dpr: 1, touch: px < 768, os: px < 768 ? 'android' : 'windows',
        defaultBrowser: 'chrome', custom: true,
      })
    }
    actions.addDevice(id)
    actions.toast(`${px}px ekranı eklendi`, 'ok')
  }

  return (
    <>
      <div class="drawer-note">
        {bps.length} kırılım noktası bulundu. Bir satıra tıklayarak o genişlikte ekran ekleyin.
        <button class="btn sm" style={{ marginLeft: 8, border: '1px solid var(--line)' }}
                onClick={() => {
                  for (const b of bps) addFrameAt(b.feature.startsWith('max') ? b.value : b.value, b.feature)
                }}>
          <IcPlus /> Hepsi için ekran ekle
        </button>
      </div>
      <table class="tbl">
        <thead><tr><th>Genişlik</th><th>Özellik</th><th>Kaynak</th><th /></tr></thead>
        <tbody>
          {bps.map((b) => (
            <tr key={`${b.feature}-${b.value}`} class={active.has(b.value) ? 'hit' : ''}>
              <td class="mono" style={{ fontWeight: 600 }}>{b.value}px</td>
              <td class="mut">{b.feature}{b.unit !== 'px' ? ` (${b.unit})` : ''}</td>
              <td class="mut">{b.source}</td>
              <td class="w2">
                {active.has(b.value)
                  ? <span class="mut">ekranda var</span>
                  : <button class="btn sm" onClick={() => addFrameAt(b.value, b.feature)}><IcPlus /> ekle</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ─── Taşma ────────────────────────────────────────────────────────── */

function OverflowView() {
  const app = useApp()
  const entries = Object.entries(app.overflowItems).filter(([, v]) => v.length)
  if (app.tool !== 'overflow') {
    return <Empty text="“Taşma” bindirmesini açın; taşmaya sebep olan elemanlar burada listelenir." />
  }
  if (!entries.length) return <Empty text="Yatay taşma bulunamadı. 👍" />
  return (
    <>
      <div class="drawer-note">
        Satırın üzerine gelince o eleman tüm ekranlarda vurgulanır. Sağdaki sayı, sayfa
        genişliğini kaç piksel aştığını gösterir.
      </div>
      {entries.map(([fid, items]) => {
        const f = app.frames.find((x) => x.fid === fid)
        const dev = f ? deviceById(app.settings, f.deviceId) : null
        return (
          <div key={fid}>
            <div class="drawer-group"><IcWarn /> {dev?.name ?? fid} — {items.length} eleman</div>
            <table class="tbl">
              <tbody>
                {items.map((it) => (
                  <tr key={it.path} class="hoverable"
                      onMouseEnter={() => broadcast({ t: 'highlight', path: it.path })}
                      onMouseLeave={() => broadcast({ t: 'highlight', path: null })}>
                    <td class="mono">{it.tag}</td>
                    <td class="mut mono small">{it.path}</td>
                    <td class="w2" style={{ color: 'var(--err)', textAlign: 'right' }}>+{it.right}px</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}

/* ─── Denetçi ──────────────────────────────────────────────────────── */

function InspectView() {
  const app = useApp()
  const ins = app.inspected
  if (!ins) {
    return <Empty text="“Denetçi” aracını açın ve herhangi bir ekranda bir elemana tıklayın. Aynı eleman tüm ekranlarda vurgulanır." />
  }
  const f = app.frames.find((x) => x.fid === ins.fid)
  const dev = f ? deviceById(app.settings, f.deviceId) : null
  const i = ins.info
  return (
    <div class="inspect">
      <div class="inspect-head">
        <b class="mono">{i.tag}{i.id ? `#${i.id}` : ''}</b>
        {i.classes && <span class="mut mono small">.{i.classes.split(/\s+/).slice(0, 4).join('.')}</span>}
        <span class="mut">— {dev?.name} ekranında seçildi</span>
        <span style={{ flex: 1 }} />
        <button class="btn sm" onClick={() => { broadcast({ t: 'highlight', path: i.path }) }}>
          Tümünde vurgula
        </button>
        <button class="btn sm" onClick={() => { broadcast({ t: 'highlight', path: null }); actions.toast('Vurgu kaldırıldı') }}>
          Temizle
        </button>
      </div>
      <div class="inspect-grid">
        <div class="kv"><span>Ölçü</span><b class="mono">{i.rect.w} × {i.rect.h}</b></div>
        <div class="kv"><span>Konum</span><b class="mono">{i.rect.x}, {i.rect.y}</b></div>
        <div class="kv"><span>Margin</span><b class="mono">{i.margin}</b></div>
        <div class="kv"><span>Padding</span><b class="mono">{i.padding}</b></div>
        {i.border && <div class="kv"><span>Border</span><b class="mono">{i.border}</b></div>}
        {Object.entries(i.styles).map(([k, v]) => (
          <div class="kv" key={k}><span>{k}</span><b class="mono">{v}</b></div>
        ))}
      </div>
      {i.text && <div class="inspect-text">“{i.text}”</div>}
      <div class="inspect-path mono">{i.path}</div>
    </div>
  )
}

/* ─── Bağlantılar ──────────────────────────────────────────────────── */

/** 0 = hiç erişilemedi, 4xx/5xx = hatalı */
function isBad(l: { status?: number }) {
  return l.status === 0 || (l.status ?? 0) >= 400
}

function LinksView() {
  const links = useFirstScan('links')
  if (!links) return <Empty text="“Bağlantılar” düğmesine basarak sayfadaki bağlantıları denetleyin." />
  if (!links.length) return <Empty text="Sayfada http(s) bağlantısı bulunamadı." />
  const broken = links.filter(isBad)
  return (
    <>
      <div class="drawer-note">
        {links.length} bağlantı denetlendi
        {broken.length > 0
          ? <b style={{ color: 'var(--err)' }}> — {broken.length} sorunlu</b>
          : <b style={{ color: 'var(--ok)' }}> — hepsi çalışıyor</b>}
        <Rescan what="links" />
      </div>
      <table class="tbl">
        <thead><tr><th class="w1">Durum</th><th>Metin</th><th>Adres</th></tr></thead>
        <tbody>
          {/* Sorunlular en üstte */}
          {[...links].sort((a, b) => Number(isBad(b)) - Number(isBad(a))).map((l) => (
            <tr key={l.href}>
              <td>
                <span class={`badge2 ${l.status === undefined ? '' : l.status === 0 ? 'err' : l.status >= 400 ? 'err' : l.status >= 300 ? 'warn' : 'ok'}`}>
                  {l.status === 0 ? 'erişilemedi' : l.status ?? '…'}
                </span>
              </td>
              <td>{l.text}</td>
              <td class="mono small mut">
                {l.external && <span class="badge2">dış</span>} {l.href}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ─── Görseller ────────────────────────────────────────────────────── */

function AssetsView() {
  const assets = useFirstScan('assets')
  if (!assets) return <Empty text="“Görseller” düğmesine basarak medya denetimi yapın." />
  if (!assets.length) return <Empty text="Sayfada görsel veya medya bulunamadı." />

  /** Doğal boyutu görünen boyutun 2 katından büyük görseller gereksiz ağırdır. */
  const oversized = (a: typeof assets[number]) => {
    if (a.kind === 'vektör') return false   // SVG ölçekten bağımsız
    if (!a.natural || !a.shown || a.natural === '—' || a.shown === '—') return false
    const [nw] = a.natural.split('×').map(Number)
    const [sw] = a.shown.split('×').map(Number)
    return sw > 0 && nw > sw * 2.2
  }
  const broken = assets.filter((a) => a.broken).length
  const big = assets.filter(oversized).length

  return (
    <>
      <div class="drawer-note">
        {assets.length} medya öğesi
        {broken > 0 && <b style={{ color: 'var(--err)' }}> — {broken} kırık</b>}
        {big > 0 && <b style={{ color: 'var(--warn)' }}> — {big} gereğinden büyük</b>}
        {!broken && !big && <b style={{ color: 'var(--ok)' }}> — sorun yok</b>}
        <Rescan what="assets" />
      </div>
      <table class="tbl">
        <thead><tr><th>Dosya</th><th class="w2">Tür</th><th class="w2">Doğal</th><th class="w2">Görünen</th><th class="w2">Durum</th></tr></thead>
        <tbody>
          {assets.map((a, i) => (
            <tr key={i}>
              <td class="mono small">{a.url}</td>
              <td class="mut">{a.kind}</td>
              <td class="mono mut">{a.natural ?? '—'}</td>
              <td class="mono mut">{a.shown ?? '—'}</td>
              <td>
                {a.broken
                  ? <span class="badge2 err">kırık</span>
                  : oversized(a)
                    ? <span class="badge2 warn">büyük</span>
                    : <span class="badge2 ok">tamam</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ─── Fontlar ──────────────────────────────────────────────────────── */

function FontsView() {
  const fonts = useFirstScan('fonts')
  if (!fonts) return <Empty text="“Fontlar” düğmesine basarak sayfadaki font envanterini çıkarın." />
  if (!fonts.length) return <Empty text="Font bilgisi toplanamadı." />
  return (
    <table class="tbl">
      <thead><tr><th>Aile</th><th class="w2">Kullanım</th><th>Ağırlıklar</th><th>Önizleme</th></tr></thead>
      <tbody>
        {fonts.map((f) => (
          <tr key={f.family}>
            <td class="mono">{f.family}</td>
            <td class="mut">{f.count} eleman</td>
            <td class="mut">{f.weights.join(', ')}</td>
            <td style={{ fontFamily: f.family, fontSize: 15 }}>Aa Bb Çç Ğğ 123</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ─── Web Vitals ───────────────────────────────────────────────────── */

const VITAL_LIMITS: Record<string, [number, number, string]> = {
  lcp: [2500, 4000, 'ms'],
  cls: [0.1, 0.25, ''],
  inp: [200, 500, 'ms'],
  fcp: [1800, 3000, 'ms'],
  ttfb: [800, 1800, 'ms'],
}

function VitalsView() {
  const app = useApp()
  const rows = app.frames.filter((f) => !f.hidden).map((f) => ({
    frame: f,
    v: app.scans[f.fid]?.vitals?.vitals,
  })).filter((r) => r.v)

  if (!rows.length) return <Empty text="“Vitals” düğmesine basın. Ölçümler her ekran için ayrı toplanır." />

  const cell = (key: string, val: number | undefined) => {
    if (val === undefined) return <td class="mut">—</td>
    const [good, poor, unit] = VITAL_LIMITS[key]
    const cls = val <= good ? 'ok' : val <= poor ? 'warn' : 'err'
    return <td><span class={`badge2 ${cls}`}>{key === 'cls' ? val.toFixed(3) : Math.round(val)}{unit}</span></td>
  }

  return (
    <>
      <div class="drawer-note">
        Yeşil = iyi, sarı = geliştirilmeli, kırmızı = zayıf. Ölçümler bu tarayıcıdaki gerçek
        yükleme üzerinden alınır; ağ ve CPU koşulları kendi makinenizinkidir. Henüz yüklenmemiş
        ekranlar boş görünür — birkaç saniye sonra yeniden tarayın.
        <Rescan what="vitals" all />
      </div>
      <table class="tbl">
        <thead><tr><th>Ekran</th><th>LCP</th><th>CLS</th><th>INP</th><th>FCP</th><th>TTFB</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.frame.fid}>
              <td>{deviceById(app.settings, r.frame.deviceId)?.name}</td>
              {cell('lcp', r.v!.lcp)}{cell('cls', r.v!.cls)}{cell('inp', r.v!.inp)}
              {cell('fcp', r.v!.fcp)}{cell('ttfb', r.v!.ttfb)}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ─── Meta ─────────────────────────────────────────────────────────── */

function MetaView() {
  const meta = useFirstScan('meta')
  if (!meta) return <Empty text="“Meta” düğmesine basarak sayfanın meta etiketlerini listeleyin." />
  const keys = Object.keys(meta)
  if (!keys.length) return <Empty text="Meta etiketi bulunamadı." />
  return (
    <table class="tbl">
      <tbody>
        {keys.map((k) => (
          <tr key={k}>
            <td class="w3 mut mono">{k}</td>
            <td>{meta[k]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export { sendTo }
