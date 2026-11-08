/**
 * SOSYAL ÖNİZLEME KARTLARI
 *
 * Sayfanın meta etiketlerinden, bağlantı her platformda nasıl görüneceğini
 * yeniden oluşturur. Her platformun kendi kırpma ve öncelik kuralları vardır:
 * örneğin X büyük görsel için `twitter:card=summary_large_image` ister,
 * Google SERP açıklamayı ~155 karakterde keser.
 */
import { useApp } from '../store'
import { sendTo } from '../bus'
import { IcReload, IcWarn } from './Icons'

function useMeta(): Record<string, string> | undefined {
  const app = useApp()
  for (const fid of Object.keys(app.scans)) {
    const m = app.scans[fid]?.meta?.meta
    if (m) return m
  }
  return undefined
}

function pick(m: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) if (m[k]) return m[k]
  return ''
}

function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, '') } catch { return '' }
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s
}

export function SocialView() {
  const app = useApp()
  const meta = useMeta()

  if (!meta) {
    return (
      <div class="drawer-empty">
        “Sosyal” düğmesine basın. Sayfanın meta etiketlerinden her platformun
        paylaşım önizlemesi yeniden oluşturulur.
      </div>
    )
  }

  const url = app.url
  const host = hostOf(url)
  const title = pick(meta, 'og:title', 'twitter:title', 'title')
  const desc = pick(meta, 'og:description', 'twitter:description', 'description')
  const rawImage = pick(meta, 'og:image', 'twitter:image', 'og:image:url')
  /* Yalnızca web görselleri — chrome-extension:/file: gibi şemalar yüklenmesin */
  const image = rawImage && /^https?:\/\//i.test(rawImage) ? rawImage : ''
  const siteName = pick(meta, 'og:site_name') || host
  const cardType = pick(meta, 'twitter:card') || 'summary'
  const largeImage = cardType === 'summary_large_image'

  const eksikler: string[] = []
  if (!meta['og:title']) eksikler.push('og:title')
  if (!meta['og:description']) eksikler.push('og:description')
  if (!meta['og:image']) eksikler.push('og:image')
  if (!meta['twitter:card']) eksikler.push('twitter:card')

  const rescan = () => {
    const f = app.frames.find((x) => !x.hidden && app.frameInfo[x.fid]?.ready)
    if (f) sendTo(f.fid, { t: 'scan', what: 'meta' })
  }

  return (
    <>
      <div class="drawer-note">
        {eksikler.length
          ? <><IcWarn style={{ width: 12, height: 12, color: 'var(--warn)' }} />
              <b style={{ color: 'var(--warn)' }}>Eksik etiketler: {eksikler.join(', ')}</b>
              <span class="mut"> — bunlar olmadan platformlar tahmin yürütür</span></>
          : <b style={{ color: 'var(--ok)' }}>Tüm temel paylaşım etiketleri mevcut</b>}
        <button class="btn sm" style={{ marginLeft: 'auto', border: '1px solid var(--line)' }}
                onClick={rescan}><IcReload /> Yeniden tara</button>
      </div>

      <div class="social-grid">
        {/* ── Google arama sonucu ── */}
        <Card name="Google arama sonucu" note="Başlık ~60, açıklama ~155 karakterde kesilir">
          <div class="serp">
            <div class="serp-host">
              <span class="serp-favicon">{(host[0] ?? '?').toUpperCase()}</span>
              <div><div class="serp-site">{siteName}</div><div class="serp-url">{clip(url, 60)}</div></div>
            </div>
            <div class="serp-title">{clip(pick(meta, 'title', 'og:title'), 60)}</div>
            <div class="serp-desc">{clip(desc, 155) || 'Açıklama yok — Google sayfadan metin seçecek.'}</div>
          </div>
        </Card>

        {/* ── X / Twitter ── */}
        <Card name="X (Twitter)" note={`twitter:card = ${cardType}`}>
          <div class={`x-card${largeImage ? ' large' : ''}`}>
            {image
              ? <img class="x-img" src={image} alt="" />
              : <div class="ph">og:image yok</div>}
            <div class="x-body">
              <div class="x-host">{host}</div>
              <div class="x-title">{clip(title, 70)}</div>
              <div class="x-desc">{clip(desc, 125)}</div>
            </div>
          </div>
        </Card>

        {/* ── Facebook ── */}
        <Card name="Facebook" note="1200×630 görsel önerilir">
          <div class="fb-card">
            {image ? <img class="fb-img" src={image} alt="" /> : <div class="ph">og:image yok</div>}
            <div class="fb-body">
              <div class="fb-host">{host.toUpperCase()}</div>
              <div class="fb-title">{clip(title, 88)}</div>
              <div class="fb-desc">{clip(desc, 100)}</div>
            </div>
          </div>
        </Card>

        {/* ── LinkedIn ── */}
        <Card name="LinkedIn" note="Açıklama gösterilmez, yalnızca başlık ve alan adı">
          <div class="li-card">
            {image ? <img class="li-img" src={image} alt="" /> : <div class="ph">og:image yok</div>}
            <div class="li-body">
              <div class="li-title">{clip(title, 100)}</div>
              <div class="li-host">{host}</div>
            </div>
          </div>
        </Card>

        {/* ── WhatsApp ── */}
        <Card name="WhatsApp" note="Küçük kare görsel, sohbet balonunda">
          <div class="wa-bubble">
            <div class="wa-prev">
              {image ? <img src={image} alt="" /> : <div class="ph sm">yok</div>}
              <div class="wa-text">
                <div class="wa-title">{clip(title, 60)}</div>
                <div class="wa-desc">{clip(desc, 80)}</div>
                <div class="wa-host">{host}</div>
              </div>
            </div>
            <div class="wa-url">{clip(url, 44)}</div>
          </div>
        </Card>

        {/* ── Slack ── */}
        <Card name="Slack" note="Sol kenarlıkta theme-color kullanılır">
          <div class="sl-card" style={{ borderLeftColor: meta['theme-color'] || '#6366f1' }}>
            <div class="sl-site">{siteName}</div>
            <div class="sl-title">{clip(title, 80)}</div>
            <div class="sl-desc">{clip(desc, 180)}</div>
            {image && <img class="sl-img" src={image} alt="" />}
          </div>
        </Card>

        {/* ── Discord ── */}
        <Card name="Discord" note="Koyu tema, sol kenarlık renkli">
          <div class="dc-card" style={{ borderLeftColor: meta['theme-color'] || '#5865f2' }}>
            <div class="dc-site">{siteName}</div>
            <div class="dc-title">{clip(title, 80)}</div>
            <div class="dc-desc">{clip(desc, 150)}</div>
            {image && <img class="dc-img" src={image} alt="" />}
          </div>
        </Card>

        {/* ── Telegram ── */}
        <Card name="Telegram" note="Sol çizgili alıntı bloğu">
          <div class="tg-card">
            <div class="tg-site">{siteName}</div>
            <div class="tg-title">{clip(title, 80)}</div>
            <div class="tg-desc">{clip(desc, 140)}</div>
            {image && <img class="tg-img" src={image} alt="" />}
          </div>
        </Card>

        {/* ── iMessage ── */}
        <Card name="iMessage" note="Görsel üstte, başlık altta">
          <div class="im-card">
            {image ? <img class="im-img" src={image} alt="" /> : <div class="ph">og:image yok</div>}
            <div class="im-body">
              <div class="im-title">{clip(title, 60)}</div>
              <div class="im-host">{host}</div>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

function Card({ name, note, children }: {
  name: string; note: string; children: preact.ComponentChildren
}) {
  return (
    <div class="social-card">
      <div class="social-head"><b>{name}</b><span class="mut">{note}</span></div>
      {children}
    </div>
  )
}
