/** Faz 4 panelleri: canlı kod, CSS değişkenleri, depolama, çerezler, başlıklar. */
import { useEffect, useRef, useState } from 'preact/hooks'
import type { ScanResult } from '@/lib/types'
import { actions, deviceById, tools, useApp } from '../store'
import { bg, broadcast, sendTo } from '../bus'
import { IcCheck, IcCopy, IcPlus, IcReload, IcTrash, IcWarn } from './Icons'

function firstScan<K extends keyof ScanResult>(
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

/* ═══ Canlı CSS / JS enjeksiyonu ═════════════════════════════════════ */

export function CodeView() {
  const app = useApp()
  const [tab, setTab] = useState<'css' | 'js'>('css')
  const timer = useRef(0)

  /* CSS'i yazdıkça uygula (gecikmeli) — JS elle çalıştırılır, kazara döngüye girmesin */
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      broadcast({ t: 'css', code: app.settings.injectCss })
    }, 350) as unknown as number
    return () => clearTimeout(timer.current)
  }, [app.settings.injectCss])

  return (
    <div class="code-pane">
      <div class="code-tabs">
        <button class={`btn sm${tab === 'css' ? ' on' : ''}`} onClick={() => setTab('css')}>CSS</button>
        <button class={`btn sm${tab === 'js' ? ' on' : ''}`} onClick={() => setTab('js')}>JavaScript</button>
        <span class="mut small" style={{ marginLeft: 8 }}>
          {tab === 'css'
            ? 'Yazdıkça tüm ekranlara uygulanır. Sayfa yenilendiğinde korunur.'
            : 'Çalıştır düğmesine basınca tüm ekranlarda bir kez çalışır.'}
        </span>
        <span style={{ flex: 1 }} />
        {tab === 'js' && (
          <button class="btn sm primary"
                  onClick={() => {
                    broadcast({ t: 'js', code: app.settings.injectJs })
                    actions.toast('Tüm ekranlarda çalıştırıldı', 'ok')
                  }}>Çalıştır</button>
        )}
        <button class="btn sm" onClick={() => {
          if (tab === 'css') { tools.setInject({ injectCss: '' }); broadcast({ t: 'css', code: '' }) }
          else tools.setInject({ injectJs: '' })
        }}><IcTrash /> Temizle</button>
      </div>
      {tab === 'css' ? (
        <textarea
          class="code-area"
          spellcheck={false}
          placeholder={'/* Örnek: tüm ekranlarda kenarlıkları göster */\n* { outline: 1px solid #f0f4 }'}
          value={app.settings.injectCss}
          onInput={(e) => tools.setInject({ injectCss: (e.target as HTMLTextAreaElement).value })}
        />
      ) : (
        <textarea
          class="code-area"
          spellcheck={false}
          placeholder={"// Örnek: menüyü aç\ndocument.querySelector('.menu-toggle')?.click()"}
          value={app.settings.injectJs}
          onInput={(e) => tools.setInject({ injectJs: (e.target as HTMLTextAreaElement).value })}
        />
      )}
    </div>
  )
}

/* ═══ CSS değişkenleri (tasarım jetonları) ═══════════════════════════ */

export function CssVarsView() {
  const app = useApp()
  const list = firstScan(app.scans, 'cssvars')
  const [q, setQ] = useState('')
  if (!list) return <Empty text="“CSS değişkenleri” taramasını çalıştırın. Sayfanın tasarım jetonları (--renk, --boşluk vb.) listelenir." />
  if (!list.length) return <Empty text="Sayfada CSS özel değişkeni bulunamadı." />

  const t = q.trim().toLocaleLowerCase('tr')
  const filtered = t ? list.filter((v) => `${v.name} ${v.value}`.toLocaleLowerCase('tr').includes(t)) : list
  const renkler = list.filter((v) => v.isColor).length

  return (
    <>
      <div class="drawer-note">
        {list.length} değişken · {renkler} renk
        <div class="search" style={{ height: 24, marginLeft: 10, maxWidth: 220 }}>
          <input value={q} placeholder="ara…" onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        </div>
      </div>
      <table class="tbl">
        <thead><tr><th class="w3">Değişken</th><th class="w2">Önizleme</th><th>Değer</th><th class="w3">Tanım</th></tr></thead>
        <tbody>
          {filtered.map((v) => (
            <tr key={v.name}>
              <td class="mono" style={{ color: 'var(--accent-2)' }}>{v.name}</td>
              <td>{v.isColor && !/url\(|image-set|@/i.test(v.value) && <span class="var-swatch" style={{ background: v.value }} />}</td>
              <td class="mono">
                {v.value}
                <button class="btn sm icon" title="Kopyala"
                        onClick={() => { void navigator.clipboard.writeText(`var(${v.name})`); actions.toast(`var(${v.name}) kopyalandı`, 'ok') }}>
                  <IcCopy />
                </button>
              </td>
              <td class="mut mono small">{v.scope}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ═══ Depolama (localStorage / sessionStorage / çerez) ═══════════════ */

export function StorageView() {
  const app = useApp()
  const dump = firstScan(app.scans, 'storage')
  const firstFid = app.frames.find((f) => !f.hidden && app.frameInfo[f.fid]?.ready)?.fid

  if (!dump) return <Empty text="“Depolama” taramasını çalıştırın. Sayfanın localStorage, sessionStorage ve çerez kullanımı listelenir." />

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`
  const Section = ({ area, rows }: { area: 'local' | 'session'; rows: typeof dump.local }) => (
    <>
      <div class="drawer-group" style={{ display: 'flex', alignItems: 'center' }}>
        {area === 'local' ? 'localStorage' : 'sessionStorage'} — {rows.length} anahtar
        <button class="btn sm danger" style={{ marginLeft: 'auto' }}
                disabled={!rows.length || !firstFid}
                onClick={() => {
                  broadcast({ t: 'storageOp', op: 'clear', area })
                  actions.toast(`${area === 'local' ? 'localStorage' : 'sessionStorage'} temizlendi`, 'ok')
                }}>
          <IcTrash /> Tümünü sil
        </button>
      </div>
      {!rows.length && <div class="mut" style={{ padding: '6px 12px' }}>Boş.</div>}
      {!!rows.length && (
        <table class="tbl">
          <thead><tr><th class="w3">Anahtar</th><th>Değer</th><th class="w2">Boyut</th><th class="w1" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td class="mono">{r.key}</td>
                <td class="mono small" style={{ wordBreak: 'break-all' }}>{r.value}</td>
                <td class="mut">{r.size > 1024 ? kb(r.size) : `${r.size} B`}</td>
                <td>
                  <button class="btn sm icon danger" title="Bu anahtarı sil"
                          onClick={() => broadcast({ t: 'storageOp', op: 'remove', area, key: r.key })}>
                    <IcTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )

  return (
    <>
      <div class="drawer-note">
        Toplam {kb(dump.totalBytes)} · {dump.cookieCount} çerez
        <span class="mut"> — silme işlemi tüm ekranlara uygulanır (hepsi aynı origin)</span>
        <button class="btn sm" style={{ marginLeft: 'auto', border: '1px solid var(--line)' }}
                onClick={() => firstFid && sendTo(firstFid, { t: 'scan', what: 'storage' })}>
          <IcReload /> Yeniden tara
        </button>
      </div>
      <Section area="local" rows={dump.local} />
      <Section area="session" rows={dump.session} />
      <CookieSection />
    </>
  )
}

/* ─── Çerezler (chrome.cookies — isteğe bağlı izin) ────────────────── */

interface CookieRow {
  name: string; value: string; domain: string; path: string
  secure: boolean; httpOnly: boolean; sameSite: string; session: boolean
}

function CookieSection() {
  const app = useApp()
  const [cookies, setCookies] = useState<CookieRow[] | null>(null)
  const [izin, setIzin] = useState<boolean | null>(null)

  useEffect(() => {
    void chrome.permissions.contains({ permissions: ['cookies'] }).then(setIzin)
  }, [])

  async function yukle() {
    const r = await bg<{ ok: boolean; cookies?: CookieRow[]; error?: string }>({ t: 'cookiesFor', url: app.url })
    if (r?.ok) setCookies(r.cookies ?? [])
    else actions.toast(r?.error ?? 'Çerezler okunamadı', 'error')
  }

  async function izinIste() {
    /* Kullanıcı hareketi bağlamında, await ÖNCESİNDE istenmeli */
    const granted = await chrome.permissions.request({ permissions: ['cookies'] })
    setIzin(granted)
    if (granted) void yukle()
    else actions.toast('Çerez izni verilmedi', 'error')
  }

  return (
    <>
      <div class="drawer-group" style={{ display: 'flex', alignItems: 'center' }}>
        Çerezler
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {izin === false && (
            <button class="btn sm primary" onClick={izinIste}>Çerez iznini ver</button>
          )}
          {izin && (
            <>
              <button class="btn sm" onClick={yukle}><IcReload /> Yükle</button>
              <button class="btn sm danger"
                      onClick={async () => {
                        const r = await bg<{ ok: boolean; count?: number }>({ t: 'cookieClearAll', url: app.url })
                        if (r?.ok) { actions.toast(`${r.count} çerez silindi — çıkış yapmış gibi test edin`, 'ok'); void yukle(); actions.reloadAll() }
                      }}>
                <IcTrash /> Tümünü sil
              </button>
            </>
          )}
        </span>
      </div>
      {izin === false && (
        <div class="mut" style={{ padding: '6px 12px', fontSize: 11.5, lineHeight: 1.5 }}>
          Çerezleri okuyup silmek ayrı bir izin ister. Bu izin varsayılan olarak istenmez;
          yalnızca burada, siz onay verdiğinizde etkinleşir. Oturumu kapatıp anonim kullanıcı
          deneyimini test etmek için kullanışlıdır.
        </div>
      )}
      {izin && cookies === null && (
        <div class="mut" style={{ padding: '6px 12px' }}>“Yükle” ile bu adresin çerezlerini listeleyin.</div>
      )}
      {cookies?.length === 0 && <div class="mut" style={{ padding: '6px 12px' }}>Bu adres için çerez yok.</div>}
      {!!cookies?.length && (
        <table class="tbl">
          <thead><tr><th class="w3">Ad</th><th>Değer</th><th class="w2">Alan</th><th class="w2">Bayraklar</th><th class="w1" /></tr></thead>
          <tbody>
            {cookies.map((c) => (
              <tr key={c.name + c.domain}>
                <td class="mono">{c.name}</td>
                <td class="mono small" style={{ wordBreak: 'break-all' }}>{c.value.slice(0, 120)}</td>
                <td class="mut mono small">{c.domain}</td>
                <td>
                  {c.secure && <span class="badge2 ok">secure</span>}{' '}
                  {c.httpOnly && <span class="badge2">httpOnly</span>}{' '}
                  <span class="badge2">{c.sameSite || 'unspecified'}</span>
                </td>
                <td>
                  <button class="btn sm icon danger" title="Sil"
                          onClick={async () => {
                            await bg({ t: 'cookieRemove', url: app.url, name: c.name })
                            void yukle()
                          }}><IcTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

/* ═══ Parmak modu tanısı ═════════════════════════════════════════════ */

export function TouchDiagView() {
  const app = useApp()
  const satirlar = app.frames.filter((f) => !f.hidden).map((f) => ({
    frame: f,
    d: app.scans[f.fid]?.touchDiag?.touchDiag,
  })).filter((x) => x.d)

  const tara = () => {
    for (const f of app.frames.filter((x) => !x.hidden && app.frameInfo[x.fid]?.ready)) {
      sendTo(f.fid, { t: 'scan', what: 'touchDiag' })
    }
  }

  if (!satirlar.length) {
    return (
      <div class="drawer-empty">
        Parmak modunun her ekranda tam olarak ne yapabildiğini gösterir — bir sitede
        beklendiği gibi çalışmıyorsa nerede takıldığını buradan görürsünüz.
        <button class="btn primary" style={{ marginTop: 12 }} onClick={tara}>
          <IcReload /> Tanıyı çalıştır
        </button>
      </div>
    )
  }

  const iyi = (b: boolean) => <span class={`badge2 ${b ? 'ok' : 'err'}`}>{b ? 'evet' : 'hayır'}</span>

  return (
    <>
      <div class="drawer-note">
        Dokunmatik ekranlarda <b>yeniden yazılan</b> kural sayısı 0'dan büyük ve
        <b>kalan :hover</b> 0 olmalı. Okunamayan stylesheet kaldıysa o dosya indirilemiyor
        demektir — sebebini <i>Konsol</i> panelinde görebilirsiniz.
        <button class="btn sm" style={{ marginLeft: 'auto', border: '1px solid var(--line)' }}
                onClick={tara}><IcReload /> Yeniden tara</button>
      </div>
      <table class="tbl">
        <thead>
          <tr>
            <th>Ekran</th><th class="w2">Parmak modu</th><th class="w2">Yeniden yazılan</th>
            <th class="w2">Sheet</th><th class="w2">Okunamayan</th><th class="w2">adopted</th>
            <th class="w2">shadow</th><th class="w2">Kalan :hover</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map(({ frame, d }) => {
            const dev = deviceById(app.settings, frame.deviceId)
            const dokunmatik = !!dev?.touch
            return (
              <tr key={frame.fid}>
                <td>{dev?.name}{dokunmatik ? '' : <span class="mut"> (masaüstü)</span>}</td>
                <td>{dokunmatik
                  ? iyi(d!.parmakModu)
                  : <span class="mut">kapalı</span>}</td>
                <td>{dokunmatik
                  ? (d!.yenidenYazilan > 0
                      ? <span class="badge2 ok">{d!.yenidenYazilan}</span>
                      : <span class="badge2 err">0</span>)
                  : <span class="mut">—</span>}</td>
                <td class="mut mono">{d!.okunabilir}/{d!.toplamSheet}</td>
                <td>{d!.okunamayan && dokunmatik
                  ? <span class="badge2 err">{d!.okunamayan}</span>
                  : <span class="mut">{d!.okunamayan}</span>}</td>
                <td class="mut mono">{d!.adopted}</td>
                <td class="mut mono">{d!.shadowKok}</td>
                <td>{dokunmatik
                  ? (d!.kalanHoverKurali + d!.kalanHoverMedia
                      ? <span class="badge2 err">{d!.kalanHoverKurali} + {d!.kalanHoverMedia} media</span>
                      : <span class="badge2 ok">0</span>)
                  : <span class="mut">{d!.kalanHoverKurali}</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {satirlar.some(({ frame, d }) => {
        const dev = deviceById(app.settings, frame.deviceId)
        return dev?.touch && (d!.kalanHoverKurali + d!.kalanHoverMedia > 0 || d!.okunamayan > 0)
      }) && (
        <div style={{ padding: '10px 12px' }}>
          <div class="group-title" style={{ background: 'none', paddingLeft: 0 }}>
            İşlenemeyen kural örnekleri
          </div>
          {satirlar.map(({ frame, d }) => {
            const dev = deviceById(app.settings, frame.deviceId)
            if (!dev?.touch || !d!.ornekler.length) return null
            return (
              <div key={frame.fid} style={{ marginBottom: 8 }}>
                <b class="small">{dev.name}</b>
                {d!.ornekler.map((o, i) => (
                  <div key={i} class="mono small mut" style={{ paddingLeft: 10 }}>{o}</div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ═══ Özel HTTP başlıkları ═══════════════════════════════════════════ */

export function HeadersView() {
  const app = useApp()
  const list = app.settings.customHeaders

  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')

  function basicAuthEkle() {
    if (!user) return
    /* UTF-8 → base64 (btoa tek başına ş/ğ gibi karakterlerde hata atar) */
    const bytes = new TextEncoder().encode(`${user}:${pass}`)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    tools.addHeader({ name: 'Authorization', value: `Basic ${btoa(bin)}` })
    setUser(''); setPass('')
    actions.toast('Authorization başlığı eklendi', 'ok')
  }

  return (
    <div style={{ padding: '10px 12px' }}>
      <div class="mut" style={{ fontSize: 11.5, lineHeight: 1.55, marginBottom: 10 }}>
        Buradaki başlıklar <b>yalnızca bu stüdyo sekmesinde, önizlenen sitenin alan adına</b> giden
        isteklere eklenir; normal gezinmenize ve sitenin yüklediği üçüncü taraflara sızmaz. Basic auth ile korunan önizleme ortamları, feature flag jetonları
        ve API anahtarları için kullanın.
        {list.some((h) => h.enabled && /authorization|cookie|token|key/i.test(h.name)) && (
          <div style={{ color: 'var(--warn)', marginTop: 6 }}>
            <IcWarn style={{ width: 11, height: 11, verticalAlign: '-1px' }} /> Hassas bir başlık
            tanımlı. Bu değerler <code>chrome.storage.local</code>'da düz metin saklanır.
          </div>
        )}
      </div>

      {list.map((h) => (
        <div key={h.id} class="hdr-row">
          <button class={`switch${h.enabled ? ' on' : ''}`} title="Etkin / devre dışı"
                  onClick={() => tools.updateHeader(h.id, { enabled: !h.enabled })} />
          <input type="text" placeholder="Başlık adı" value={h.name}
                 onInput={(e) => tools.updateHeader(h.id, { name: (e.target as HTMLInputElement).value })} />
          <input type="text" placeholder="Değer" value={h.value}
                 onInput={(e) => tools.updateHeader(h.id, { value: (e.target as HTMLInputElement).value })} />
          <button class="btn sm icon danger" title="Sil"
                  onClick={() => tools.removeHeader(h.id)}><IcTrash /></button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button class="btn" style={{ border: '1px dashed var(--line-2)' }}
                onClick={() => tools.addHeader()}><IcPlus /> Başlık ekle</button>
        <button class="btn" style={{ border: '1px solid var(--line)' }}
                onClick={() => { actions.reloadAll(); actions.toast('Ekranlar yeni başlıklarla yenilendi', 'ok') }}>
          <IcReload /> Uygula ve yenile
        </button>
      </div>

      <div class="group-title" style={{ background: 'none', paddingLeft: 0 }}>Basic auth yardımcısı</div>
      <div class="hdr-row">
        <input type="text" placeholder="Kullanıcı adı" value={user}
               onInput={(e) => setUser((e.target as HTMLInputElement).value)} />
        <input type="text" placeholder="Parola" value={pass}
               onInput={(e) => setPass((e.target as HTMLInputElement).value)} />
        <button class="btn sm primary" disabled={!user} onClick={basicAuthEkle}>
          <IcCheck /> Oluştur
        </button>
      </div>
    </div>
  )
}
