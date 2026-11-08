/** Faz 3 rapor panelleri: erişilebilirlik, kontrast, sosyal önizleme, PWA. */
import type { ScanResult } from '@/lib/types'
import { useApp } from '../store'
import { broadcast, sendTo } from '../bus'
import { IcCheck, IcExternal, IcReload, IcWarn } from './Icons'

/** Tarama sonucunu ilk bulunan ekrandan alır (sayfa tüm ekranlarda aynı). */
export function firstScan<K extends keyof ScanResult>(
  scans: Record<string, Partial<Record<string, ScanResult>>>, key: K,
): ScanResult[K] | undefined {
  for (const fid of Object.keys(scans)) {
    const v = scans[fid]?.[key] as ScanResult | undefined
    if (v?.[key] !== undefined) return v[key]
  }
  return undefined
}

function Empty({ text }: { text: string }) {
  return <div class="drawer-empty">{text}</div>
}

/** Satırın üzerine gelince elemanı tüm ekranlarda vurgular. */
function hoverProps(path: string) {
  return {
    class: 'hoverable',
    onMouseEnter: () => broadcast({ t: 'highlight' as const, path }),
    onMouseLeave: () => broadcast({ t: 'highlight' as const, path: null }),
  }
}

function Rescan({ what }: { what: Parameters<typeof sendTo>[1] extends never ? never : string }) {
  const app = useApp()
  return (
    <button class="btn sm" style={{ marginLeft: 'auto', border: '1px solid var(--line)' }}
            onClick={() => {
              const f = app.frames.find((x) => !x.hidden && app.frameInfo[x.fid]?.ready)
              if (f) sendTo(f.fid, { t: 'scan', what: what as never })
            }}>
      <IcReload /> Yeniden tara
    </button>
  )
}

/* ═══ axe-core denetimi ══════════════════════════════════════════════ */

const IMPACT_TR: Record<string, string> = {
  critical: 'kritik', serious: 'ciddi', moderate: 'orta', minor: 'düşük',
}
const IMPACT_CLS: Record<string, string> = {
  critical: 'err', serious: 'err', moderate: 'warn', minor: '',
}

export function AxeView() {
  const app = useApp()
  const axe = firstScan(app.scans, 'axe')
  if (!axe) {
    return <Empty text="“Denetim” düğmesine basın. axe-core (WCAG 2.0/2.1/2.2 AA) tüm sayfayı tarar; ilk çalıştırmada kütüphane yüklendiği için birkaç saniye sürebilir." />
  }
  if (axe.error) return <Empty text={`Denetim çalıştırılamadı: ${axe.error}`} />
  if (!axe.issues.length) {
    return (
      <div class="drawer-empty" style={{ color: 'var(--ok)' }}>
        <IcCheck style={{ width: 22, height: 22 }} />
        <div style={{ marginTop: 8 }}>
          axe-core hiçbir ihlal bulamadı. ({axe.passes} kural geçti)
          <div class="mut" style={{ marginTop: 6 }}>
            Otomatik denetimler sorunların yaklaşık %30–40'ını yakalar; klavye ve ekran
            okuyucu ile elle test bunu tamamlar.
          </div>
        </div>
      </div>
    )
  }
  const bySeverity = ['critical', 'serious', 'moderate', 'minor']
  const sorted = [...axe.issues].sort(
    (a, b) => bySeverity.indexOf(a.impact) - bySeverity.indexOf(b.impact))

  return (
    <>
      <div class="drawer-note">
        <b style={{ color: 'var(--err)' }}>{axe.issues.length} ihlal</b>
        <span class="mut"> · {axe.passes} kural geçti · WCAG 2.2 AA + en iyi uygulamalar</span>
        <Rescan what="axe" />
      </div>
      {sorted.map((v) => (
        <div key={v.id} class="axe-item">
          <div class="axe-head">
            <span class={`badge2 ${IMPACT_CLS[v.impact] ?? ''}`}>{IMPACT_TR[v.impact] ?? v.impact}</span>
            <b>{v.help}</b>
            <span class="mut mono small">{v.id}</span>
            {/^https:\/\//.test(v.helpUrl) && (
              <a class="btn sm" href={v.helpUrl} target="_blank" rel="noreferrer"
                 title="axe belgelerinde aç"><IcExternal /></a>
            )}
          </div>
          <div class="axe-desc mut">{v.description}</div>
          <div class="axe-nodes">
            {v.nodes.map((n, i) => (
              <div key={i} {...hoverProps(n.path)}>
                <code>{n.path}</code>
                {n.summary && <div class="mut small">{n.summary}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/* ═══ Kontrast ═══════════════════════════════════════════════════════ */

export function ContrastView() {
  const app = useApp()
  const list = firstScan(app.scans, 'contrast')
  if (!list) {
    return <Empty text="“Kontrast” düğmesine basın. Sayfadaki metinlerin renk kontrastı WCAG eşiklerine göre denetlenir." />
  }
  if (!list.length) {
    return (
      <div class="drawer-empty" style={{ color: 'var(--ok)' }}>
        <IcCheck style={{ width: 22, height: 22 }} />
        <div style={{ marginTop: 8 }}>Kontrast sorunu bulunamadı — tüm metinler en az AA eşiğini geçiyor.</div>
      </div>
    )
  }
  return (
    <>
      <div class="drawer-note">
        <b style={{ color: 'var(--err)' }}>{list.length} metin AA eşiğinin altında</b>
        <span class="mut"> · normal metin 4.5:1, büyük metin (24px veya kalın 18.7px) 3:1 olmalı</span>
        <Rescan what="contrast" />
      </div>
      <table class="tbl">
        <thead><tr><th class="w2">Oran</th><th class="w3">Renkler</th><th>Metin</th><th class="w2">Boyut</th><th class="w2">Gerekli</th></tr></thead>
        <tbody>
          {list.map((c, i) => (
            <tr key={i} {...hoverProps(c.path)}>
              <td><span class="badge2 err">{c.ratio.toFixed(2)}:1</span></td>
              <td>
                <span class="swatch" style={{ background: c.bg, color: c.fg }}>Aa</span>
                <span class="mut mono small"> {c.fg} / {c.bg}</span>
                {c.uncertain && <span class="badge2 warn" title="Arka planda görsel veya gradyan var — gerçek kontrast değişebilir">?</span>}
              </td>
              <td>{c.text}</td>
              <td class="mut mono">{c.size}px{c.bold ? ' kalın' : ''}</td>
              <td class="mut">{c.large ? '3:1' : '4.5:1'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ═══ Başlık yapısı ══════════════════════════════════════════════════ */

export function HeadingsView() {
  const app = useApp()
  const list = firstScan(app.scans, 'headings')
  if (!list) return <Empty text="“Başlıklar” düğmesine basın. Başlık hiyerarşisi ve atlanan seviyeler gösterilir." />
  if (!list.length) return <Empty text="Sayfada başlık elemanı (h1–h6) bulunamadı — bu başlı başına bir sorun." />

  const h1 = list.filter((h) => h.level === 1).length
  const atlanan = list.filter((h) => h.skipped).length
  return (
    <>
      <div class="drawer-note">
        {list.length} başlık ·{' '}
        {h1 === 1
          ? <b style={{ color: 'var(--ok)' }}>tek h1 ✓</b>
          : <b style={{ color: h1 === 0 ? 'var(--err)' : 'var(--warn)' }}>{h1} adet h1</b>}
        {atlanan > 0 && <b style={{ color: 'var(--warn)' }}> · {atlanan} seviye atlaması</b>}
        <Rescan what="headings" />
      </div>
      <div class="outline">
        {list.map((h, i) => (
          <div key={i} {...hoverProps(h.path)}
               class={`outline-row hoverable${h.skipped ? ' bad' : ''}`}
               style={{ paddingLeft: `${8 + (h.level - 1) * 22}px` }}>
            <span class="badge2">h{h.level}</span>
            <span>{h.text}</span>
            {h.skipped && <span class="badge2 warn"><IcWarn style={{ width: 10, height: 10 }} /> seviye atlandı</span>}
          </div>
        ))}
      </div>
    </>
  )
}

/* ═══ Landmark ═══════════════════════════════════════════════════════ */

export function LandmarksView() {
  const app = useApp()
  const list = firstScan(app.scans, 'landmarks')
  if (!list) return <Empty text="“Landmark” düğmesine basın. Ekran okuyucuların sayfada gezinmek için kullandığı bölgeler listelenir." />
  const main = list.filter((l) => l.role === 'main').length
  const nav = list.filter((l) => l.role === 'navigation').length
  return (
    <>
      <div class="drawer-note">
        {list.length} landmark ·{' '}
        {main === 1
          ? <b style={{ color: 'var(--ok)' }}>tek main ✓</b>
          : <b style={{ color: main === 0 ? 'var(--err)' : 'var(--warn)' }}>{main} adet main</b>}
        {nav > 1 && <span class="mut"> · {nav} navigation (her birinin aria-label'ı olmalı)</span>}
        <Rescan what="landmarks" />
      </div>
      <table class="tbl">
        <thead><tr><th class="w2">Rol</th><th class="w2">Etiket</th><th>Erişilebilir ad</th><th>Yol</th></tr></thead>
        <tbody>
          {list.map((l, i) => (
            <tr key={i} {...hoverProps(l.path)}>
              <td><span class="badge2">{l.role}</span></td>
              <td class="mono mut">&lt;{l.tag}&gt;</td>
              <td>{l.label || <span class="mut">— ad yok</span>}</td>
              <td class="mono small mut">{l.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ═══ Alt metin ══════════════════════════════════════════════════════ */

export function ImagesA11yView() {
  const app = useApp()
  const list = firstScan(app.scans, 'images')
  if (!list) return <Empty text="“Alt metin” düğmesine basın. Görsellerin alternatif metinleri denetlenir." />
  if (!list.length) return <Empty text="Sayfada <img> elemanı yok." />
  const sorunlu = list.filter((i) => i.issue).length
  return (
    <>
      <div class="drawer-note">
        {list.length} görsel ·{' '}
        {sorunlu
          ? <b style={{ color: 'var(--err)' }}>{sorunlu} sorunlu</b>
          : <b style={{ color: 'var(--ok)' }}>hepsi uygun</b>}
        <span class="mut"> · dekoratif görseller <code>alt=""</code> almalı</span>
        <Rescan what="images" />
      </div>
      <table class="tbl">
        <thead><tr><th class="w2">Durum</th><th class="w3">Dosya</th><th>Alt metin</th></tr></thead>
        <tbody>
          {list.map((im, i) => (
            <tr key={i} {...hoverProps(im.path)}>
              <td>
                {im.issue
                  ? <span class="badge2 err">{im.issue}</span>
                  : im.decorative
                    ? <span class="badge2">dekoratif</span>
                    : <span class="badge2 ok">tamam</span>}
              </td>
              <td class="mono small mut">{im.src}</td>
              <td>{im.alt === null ? <span class="mut">—</span> : im.alt || <span class="mut">(boş — dekoratif)</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ═══ Tab sırası ═════════════════════════════════════════════════════ */

export function TabOrderView() {
  const app = useApp()
  const list = firstScan(app.scans, 'tabOrder')
  if (!list) return <Empty text="“Tab sırası” düğmesine basın. Klavye ile gezinirken odağın hangi sırayla dolaşacağı listelenir." />
  if (!list.length) return <Empty text="Odaklanabilir eleman bulunamadı." />
  const pozitif = list.filter((t) => +t.tabindex > 0).length
  const gorunmez = list.filter((t) => !t.visible).length
  return (
    <>
      <div class="drawer-note">
        {list.length} odak durağı
        {pozitif > 0 && <b style={{ color: 'var(--warn)' }}> · {pozitif} pozitif tabindex (doğal sırayı bozar)</b>}
        {gorunmez > 0 && <b style={{ color: 'var(--warn)' }}> · {gorunmez} görünmez ama odaklanabilir</b>}
        <Rescan what="tabOrder" />
      </div>
      <table class="tbl">
        <thead><tr><th class="w1">#</th><th class="w2">Eleman</th><th>Erişilebilir ad</th><th class="w2">tabindex</th><th class="w2">Görünür</th></tr></thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.index} {...hoverProps(t.path)}>
              <td class="mono">{t.index}</td>
              <td class="mono mut">&lt;{t.tag}&gt;</td>
              <td>{t.label}</td>
              <td>{+t.tabindex > 0
                ? <span class="badge2 warn">{t.tabindex}</span>
                : <span class="mut">{t.tabindex}</span>}</td>
              <td>{t.visible ? <span class="badge2 ok">evet</span> : <span class="badge2 err">hayır</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ═══ Dokunma hedefleri ══════════════════════════════════════════════ */

export function TargetsView() {
  const app = useApp()
  const list = firstScan(app.scans, 'targets')
  if (!list) return <Empty text="“Hedefler” düğmesine basın. 44×44 CSS pikselden küçük dokunma hedefleri listelenir." />
  if (!list.length) {
    return (
      <div class="drawer-empty" style={{ color: 'var(--ok)' }}>
        <IcCheck style={{ width: 22, height: 22 }} />
        <div style={{ marginTop: 8 }}>Tüm etkileşimli hedefler en az 44×44 px.</div>
      </div>
    )
  }
  return (
    <>
      <div class="drawer-note">
        <b style={{ color: 'var(--warn)' }}>{list.length} küçük hedef</b>
        <span class="mut"> · WCAG 2.2 asgari 24×24 şart koşar; Apple ve Google 44×44 önerir.
          Bu tarama, taramayı yapan ekranın genişliğine göredir.</span>
        <Rescan what="targets" />
      </div>
      <table class="tbl">
        <thead><tr><th class="w2">Ölçü</th><th class="w2">Eleman</th><th>Erişilebilir ad</th><th>Yol</th></tr></thead>
        <tbody>
          {list.map((t, i) => (
            <tr key={i} {...hoverProps(t.path)}>
              <td>
                <span class={`badge2 ${t.w < 24 || t.h < 24 ? 'err' : 'warn'}`}>{t.w}×{t.h}</span>
              </td>
              <td class="mono mut">&lt;{t.tag}&gt;</td>
              <td>{t.label}</td>
              <td class="mono small mut">{t.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ═══ PWA ════════════════════════════════════════════════════════════ */

export function PwaView() {
  const app = useApp()
  const p = firstScan(app.scans, 'pwa')
  if (!p) return <Empty text="“PWA” düğmesine basın. Manifest, ikonlar, service worker ve HTTPS durumu denetlenir." />
  const Row = ({ ok, label, value }: { ok: boolean | null; label: string; value: string }) => (
    <div class="pwa-row">
      <span class={`badge2 ${ok === null ? '' : ok ? 'ok' : 'err'}`}>{ok === null ? '—' : ok ? '✓' : '✗'}</span>
      <b>{label}</b>
      <span class="mut">{value}</span>
    </div>
  )
  return (
    <div style={{ padding: '10px 12px' }}>
      <Row ok={p.httpsOk} label="Güvenli bağlam"
           value={p.httpsOk ? 'HTTPS veya localhost' : 'PWA için HTTPS gerekir'} />
      <Row ok={!!p.manifest.url} label="Web App Manifest"
           value={p.manifest.error ?? p.manifest.url ?? 'link[rel=manifest] yok'} />
      {p.manifest.ok && (
        <>
          <Row ok={!!p.manifest.name} label="  ↳ name" value={p.manifest.name || '—'} />
          <Row ok={(p.manifest.icons ?? 0) > 0} label="  ↳ icons" value={`${p.manifest.icons} ikon`} />
          <Row ok={!!p.manifest.display} label="  ↳ display" value={p.manifest.display || '—'} />
          <Row ok={!!p.manifest.startUrl} label="  ↳ start_url" value={p.manifest.startUrl || '—'} />
        </>
      )}
      <Row ok={p.serviceWorker} label="Service Worker"
           value={p.serviceWorker ? 'kayıtlı' : 'kayıtlı değil (çevrimdışı çalışmaz)'} />
      <Row ok={!!p.themeColor} label="theme-color" value={p.themeColor ?? 'yok'} />
      <Row ok={p.appleTouchIcon} label="apple-touch-icon"
           value={p.appleTouchIcon ? 'var' : 'yok — iOS ana ekran ikonu bulanık olur'} />
      <div class="group-title" style={{ background: 'none' }}>Favicon ve ikonlar</div>
      {p.icons.length === 0 && <div class="mut" style={{ padding: '4px 8px' }}>Hiç ikon bağlantısı yok.</div>}
      <div class="icon-grid">
        {p.icons.map((ic, i) => (
          <div key={i} class="icon-card">
            {/^(https?:|data:image\/)/i.test(ic.href) && <img src={ic.href} alt="" width={32} height={32} />}
            <div><b class="mono small">{ic.rel}</b><div class="mut small">{ic.sizes}</div></div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}><Rescan what="pwa" /></div>
    </div>
  )
}
