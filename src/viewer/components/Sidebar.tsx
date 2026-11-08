/** Yan panel: Cihazlar • Çalışma alanları • Ayarlar */
import { useEffect, useMemo, useState } from 'preact/hooks'
import { ConfirmButton } from './ConfirmButton'
import type { DeviceCategory, DeviceSpec } from '@/lib/types'
import { BUILTIN_SETS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/devices/catalog'
import { actions, allDevices, useApp } from '../store'
import { BROWSER_LABELS } from '@/lib/ua'
import {
  IcCheck, IcDevices, IcFolder, IcPlus, IcReload, IcSearch, IcSettings, IcStar, IcStarOff, IcTrash,
} from './Icons'

export function Sidebar() {
  const app = useApp()
  if (!app.panel) return null
  return (
    <aside class="sidebar">
      <div class="sidebar-head">
        <div class="sidebar-tabs">
          <button class={`btn${app.panel === 'devices' ? ' on' : ''}`} title="Cihaz kütüphanesi ve hazır setler"
                  onClick={() => actions.setPanel('devices')}><IcDevices /> Cihazlar</button>
          <button class={`btn${app.panel === 'workspaces' ? ' on' : ''}`} title="Çalışma alanları — adres, cihazlar ve ayarları birlikte kaydet"
                  onClick={() => actions.setPanel('workspaces')}><IcFolder /> Alanlar</button>
          <button class={`btn${app.panel === 'settings' ? ' on' : ''}`} title="Görünüm, tema ve gelişmiş ayarlar"
                  onClick={() => actions.setPanel('settings')}><IcSettings /> Ayarlar</button>
        </div>
      </div>
      {app.panel === 'devices' && <DevicePanel />}
      {app.panel === 'workspaces' && <WorkspacePanel />}
      {app.panel === 'settings' && <SettingsPanel />}
    </aside>
  )
}

/* ═══ Cihazlar ════════════════════════════════════════════════════ */

function DevicePanel() {
  const app = useApp()
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const devices = useMemo(() => allDevices(app.settings), [app.settings.customDevices])
  const active = useMemo(() => new Set(app.frames.map((f) => f.deviceId)), [app.frames])

  const filtered = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('tr')
    if (!t) return devices
    /* "390x844" veya "390" gibi ölçü aramalarını da destekle */
    const dim = /^(\d+)\s*[x×*]\s*(\d+)$/.exec(t)
    if (dim) {
      const [, a, b] = dim
      return devices.filter((d) => String(d.width) === a && String(d.height) === b)
    }
    if (/^\d{3,4}$/.test(t)) {
      return devices.filter((d) => String(d.width) === t || String(d.height) === t)
    }
    return devices.filter((d) =>
      `${d.name} ${d.brand} ${d.width}x${d.height}`.toLocaleLowerCase('tr').includes(t))
  }, [q, devices])

  const favs = devices.filter((d) => app.settings.favorites.includes(d.id))
  const byCat = useMemo(() => {
    const m = new Map<DeviceCategory, DeviceSpec[]>()
    for (const d of filtered) {
      if (!m.has(d.category)) m.set(d.category, [])
      m.get(d.category)!.push(d)
    }
    for (const list of m.values()) {
      list.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || (b.year ?? 0) - (a.year ?? 0))
    }
    return m
  }, [filtered])

  return (
    <>
      <div style={{ padding: '0 10px 10px' }}>
        <div class="search">
          <IcSearch />
          <input value={q} placeholder="Cihaz ara veya 390x844 yaz…"
                 onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          {q && <button class="btn sm icon" onClick={() => setQ('')}>×</button>}
        </div>
      </div>

      <div class="sidebar-body">
        {!q && (
          <>
            <div class="group-title">Hazır setler</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '0 6px 4px' }}>
              {BUILTIN_SETS.map((s) => (
                <button key={s.id} class="chip" title={`${s.deviceIds.length} cihaz — tıkla: değiştir, Shift+tıkla: ekle`}
                        onClick={(e) => actions.applySet(s.deviceIds, !(e as MouseEvent).shiftKey)}>
                  {s.name}
                </button>
              ))}
            </div>
            {app.settings.deviceSets.map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: '5px', padding: '0 6px 4px' }}>
                <button class="chip" onClick={(e) => actions.applySet(s.deviceIds, !(e as MouseEvent).shiftKey)}>
                  {s.name} <span style={{ opacity: .6 }}>({s.deviceIds.length})</span>
                </button>
                <button class="btn sm icon danger" title="Seti sil"
                        onClick={() => actions.deleteDeviceSet(s.id)}><IcTrash /></button>
              </div>
            ))}

            {favs.length > 0 && (
              <>
                <div class="group-title">Sık kullanılanlar <span class="count">{favs.length}</span></div>
                {favs.map((d) => <DeviceRow key={d.id} d={d} on={active.has(d.id)} />)}
              </>
            )}
          </>
        )}

        {CATEGORY_ORDER.map((cat) => {
          const list = byCat.get(cat)
          if (!list?.length) return null
          return (
            <div key={cat}>
              <div class="group-title" title={`${CATEGORY_LABELS[cat]} kategorisindeki ${list.length} cihaz`}>
                {CATEGORY_LABELS[cat]} <span class="count">{list.length}</span>
              </div>
              {list.map((d) => <DeviceRow key={d.id} d={d} on={active.has(d.id)} />)}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
            Eşleşen cihaz yok.
          </div>
        )}

        <div style={{ padding: '10px 6px 20px' }}>
          <button class="btn" style={{ width: '100%', border: '1px dashed var(--line-2)' }}
                  onClick={() => setShowNew(true)}>
            <IcPlus /> Özel cihaz ekle
          </button>
        </div>
      </div>

      {showNew && <CustomDeviceModal onClose={() => setShowNew(false)} />}
    </>
  )
}

function DeviceRow({ d, on }: { d: DeviceSpec; on: boolean }) {
  const app = useApp()
  const fav = app.settings.favorites.includes(d.id)
  return (
    <div class={`dev-row${on ? ' on' : ''}`} onClick={() => actions.toggleDevice(d.id)}
         title={`${d.name}\n${d.width}×${d.height} · DPR ${d.dpr} · ${BROWSER_LABELS[d.defaultBrowser]}`
           + (d.note ? `\n${d.note}` : '')}>
      <span class="mark">{on && <IcCheck />}</span>
      <span class="nm">{d.name}</span>
      <span class="dim">{d.width}×{d.height}</span>
      <button class={`star${fav ? ' on' : ''}`} title="Sık kullanılanlara ekle"
              onClick={(e) => { e.stopPropagation(); actions.toggleFavorite(d.id) }}>
        {fav ? <IcStar /> : <IcStarOff />}
      </button>
      {d.custom && (
        <ConfirmButton class="btn sm icon danger" title="Özel cihazı sil (açık ekranları da kapanır)"
                       onConfirm={() => actions.removeCustomDevice(d.id)} armedLabel="Sil?"><IcTrash /></ConfirmButton>
      )}
    </div>
  )
}

function CustomDeviceModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [w, setW] = useState('1280')
  const [h, setH] = useState('800')
  const [dpr, setDpr] = useState('1')
  const [touch, setTouch] = useState(false)

  /* Escape ile kapat */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function save() {
    /* Sınırlar: çok küçük ekran işe yaramaz, çok büyüğü (ör. 100000 px) sekmeyi kilitler */
    const width = Math.min(7680, Math.max(120, parseInt(w) || 0))
    const height = Math.min(7680, Math.max(160, parseInt(h) || 0))
    const dev: DeviceSpec = {
      id: `custom-${Date.now().toString(36)}`,
      name: name.trim() || `${width}×${height}`,
      brand: 'Özel',
      category: 'custom',
      width, height,
      dpr: Math.min(5, Math.max(0.5, parseFloat(dpr) || 1)),
      touch,
      os: touch ? 'android' : 'windows',
      defaultBrowser: 'chrome',
      custom: true,
    }
    actions.addCustomDevice(dev)
    actions.addDevice(dev.id)
    onClose()
  }

  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Özel cihaz</h3>
        <div class="content">
          <div class="field">
            <label>Ad</label>
            <input type="text" value={name} placeholder="Örn. Müşteri monitörü" autoFocus
                   onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          </div>
          <div class="row">
            <div class="field"><label>Genişlik (px)</label>
              <input type="number" min="120" max="7680" value={w} onInput={(e) => setW((e.target as HTMLInputElement).value)} /></div>
            <div class="field"><label>Yükseklik (px)</label>
              <input type="number" min="160" max="7680" value={h} onInput={(e) => setH((e.target as HTMLInputElement).value)} /></div>
            <div class="field"><label>DPR</label>
              <input type="number" step="0.25" value={dpr} onInput={(e) => setDpr((e.target as HTMLInputElement).value)} /></div>
          </div>
          <div class="set-row" style={{ padding: 0 }} onClick={() => setTouch(!touch)}>
            <div class="txt"><b>Dokunmatik</b><small>maxTouchPoints ve dokunma olayları etkin olur</small></div>
            <div class={`switch${touch ? ' on' : ''}`} />
          </div>
        </div>
        <div class="foot">
          <button class="btn" onClick={onClose}>Vazgeç</button>
          <button class="btn primary" onClick={save}>Ekle</button>
        </div>
      </div>
    </div>
  )
}

/* ═══ Çalışma alanları ════════════════════════════════════════════ */

function WorkspacePanel() {
  const app = useApp()
  const [name, setName] = useState('')
  const [setName2, setSetName] = useState('')

  return (
    <div class="sidebar-body">
      <div class="group-title">Yeni çalışma alanı</div>
      <div style={{ padding: '0 6px 10px', display: 'flex', gap: '6px' }}>
        <div class="search" style={{ flex: 1 }}>
          <input value={name} placeholder="Proje adı…"
                 onInput={(e) => setName((e.target as HTMLInputElement).value)}
                 onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { actions.saveWorkspace(name.trim()); setName('') } }} />
        </div>
        <button class="btn primary" disabled={!name.trim()}
                onClick={() => { actions.saveWorkspace(name.trim()); setName('') }}>Kaydet</button>
      </div>
      <div style={{ padding: '0 8px 10px', fontSize: 11, color: 'var(--fg-3)' }}>
        Geçerli adres, cihazlar, yerleşim ve senkron ayarları birlikte kaydedilir.
      </div>

      <div class="group-title">Kayıtlı alanlar <span class="count">{app.workspaces.length}</span></div>
      <div style={{ padding: '0 6px' }}>
        {app.workspaces.length === 0 && (
          <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--fg-3)' }}>Henüz kayıt yok.</div>
        )}
        {app.workspaces.map((w) => (
          <div key={w.id} class="ws-row">
            <div class="txt" style={{ cursor: 'pointer' }} onClick={() => actions.loadWorkspace(w.id)}>
              <b>{w.name}</b>
              <small>{w.frames.length} ekran • {w.url || 'adres yok'}</small>
            </div>
            <ConfirmButton class="btn sm icon danger" title="Çalışma alanını sil"
                           onConfirm={() => actions.deleteWorkspace(w.id)} armedLabel="Sil?"><IcTrash /></ConfirmButton>
          </div>
        ))}
      </div>

      <div class="group-title">Geçerli cihazları set olarak kaydet</div>
      <div style={{ padding: '0 6px 10px', display: 'flex', gap: '6px' }}>
        <div class="search" style={{ flex: 1 }}>
          <input value={setName2} placeholder="Set adı…"
                 onInput={(e) => setSetName((e.target as HTMLInputElement).value)} />
        </div>
        <button class="btn" disabled={!setName2.trim() || !app.frames.length}
                onClick={() => { actions.saveDeviceSet(setName2.trim()); setSetName('') }}>Ekle</button>
      </div>

      <div class="group-title">Yedekleme</div>
      <div style={{ padding: '0 6px 20px', display: 'flex', gap: '6px' }}>
        <button class="btn" style={{ flex: 1, border: '1px solid var(--line)' }}
                onClick={() => actions.exportSettings()}>Dışa aktar</button>
        <button class="btn" style={{ flex: 1, border: '1px solid var(--line)' }}
                onClick={() => actions.importSettings()}>İçe aktar</button>
      </div>
    </div>
  )
}

/* ═══ Ayarlar ═════════════════════════════════════════════════════ */

function SettingsPanel() {
  const app = useApp()
  const s = app.settings
  const c = app.chromeOpts

  return (
    <div class="sidebar-body">
      <div class="group-title">Görünüm</div>
      <Toggle label="Cihaz çerçevesi" hint="Ekranı telefon gövdesi içinde göster"
              on={c.bezel} onChange={(v) => actions.setChromeOpts({ bezel: v })} />
      <Toggle label="Çentik / güvenli alan" hint="Çentik ve ana ekran çubuğunu görsel olarak işaretle"
              on={c.safeArea} onChange={(v) => actions.setChromeOpts({ safeArea: v })} />
      <Toggle label="Başlık etiketleri" hint="Cihaz adı, ölçü ve araçları göster"
              on={c.labels} onChange={(v) => actions.setChromeOpts({ labels: v })} />
      <Toggle label="Tuval ızgarası" hint="Arka planda hizalama ızgarası"
              on={c.canvasGrid} onChange={(v) => actions.setChromeOpts({ canvasGrid: v })} />
      <Toggle label="Kaydırma çubukları" hint="Kapalıyken gerçek mobil cihazlardaki gibi bindirmeli davranır ve viewport daralmaz"
              on={c.scrollbars} onChange={(v) => actions.setChromeOpts({ scrollbars: v })} />

      <div class="group-title">Tema</div>
      <div style={{ padding: '0 8px 6px' }}>
        <div class="seg" style={{ width: '100%' }}>
          {(['dark', 'light'] as const).map((t) => (
            <button key={t} class={`btn${s.theme === t ? ' on' : ''}`} style={{ flex: 1 }}
                    onClick={() => actions.setSettings({ theme: t })}>
              {t === 'dark' ? 'Koyu' : 'Açık'}
            </button>
          ))}
        </div>
      </div>

      <div class="group-title">Ekran aralığı</div>
      <div style={{ padding: '0 8px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="range" min="0" max="80" value={app.gap} style={{ flex: 1 }}
               onInput={(e) => actions.setGap(parseInt((e.target as HTMLInputElement).value))} />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', width: 32 }}>{app.gap}px</span>
      </div>

      <div class="group-title">Yükleme sırası</div>
      <div style={{ padding: '0 8px 8px' }}>
        <select class="sel" style={{ width: '100%' }} value={String(s.loadStagger)}
                onChange={(e) => actions.setSettings({ loadStagger: parseInt((e.target as HTMLSelectElement).value) })}>
          <option value="0">Hepsi aynı anda (en hızlı)</option>
          <option value="100">Kademeli — 100 ms</option>
          <option value="150">Kademeli — 150 ms (önerilen)</option>
          <option value="300">Kademeli — 300 ms</option>
          <option value="600">Kademeli — 600 ms (katı hız sınırı)</option>
        </select>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6, lineHeight: 1.5 }}>
          Tüm ekranlar aynı anda yüklenirse sunucunuza kat kat istek gider; hız sınırı olan
          API'ler <code>429 Too Many Requests</code> döndürebilir. Kademeli yükleme bunu önler.
        </div>
      </div>

      <div class="group-title">Otomatik yenileme</div>
      <div style={{ padding: '0 8px 8px' }}>
        <select class="sel" style={{ width: '100%' }} value={String(s.autoReload)}
                onChange={(e) => actions.setSettings({ autoReload: parseInt((e.target as HTMLSelectElement).value) })}>
          <option value="0">Kapalı</option>
          <option value="2">2 saniyede bir</option>
          <option value="5">5 saniyede bir</option>
          <option value="10">10 saniyede bir</option>
          <option value="30">30 saniyede bir</option>
        </select>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
          Yerel geliştirme sunucusunda canlı önizleme için kullanışlıdır.
        </div>
      </div>

      <div class="group-title">Açılış seti</div>
      <div style={{ padding: '0 8px 8px' }}>
        <select class="sel" style={{ width: '100%' }} value={s.startupSet}
                onChange={(e) => actions.setSettings({ startupSet: (e.target as HTMLSelectElement).value })}>
          {BUILTIN_SETS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          {s.deviceSets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6, lineHeight: 1.5 }}>
          Stüdyo ilk açıldığında bu set yüklenir. Ekranlarınız oturumlar arasında korunduğu için
          aşağıdaki düğmeyle istediğiniz zaman bu sete dönebilirsiniz.
        </div>
        <button class="btn" style={{ width: '100%', marginTop: 8, border: '1px solid var(--line)' }}
                onClick={() => actions.loadStartupSet()}>
          <IcReload /> Açılış setini yükle
        </button>
      </div>

      <div class="group-title">Yeni ekran varsayılanı</div>
      <div style={{ padding: '0 8px 8px' }}>
        <select class="sel" style={{ width: '100%' }} value={s.defaultBrowser}
                onChange={(e) => actions.setSettings({ defaultBrowser: (e.target as HTMLSelectElement).value as never })}>
          {Object.entries(BROWSER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
          Tarayıcı profili yalnızca User-Agent ve Client Hints değerlerini değiştirir;
          sayfa her zaman Chrome motorunda çalışır.
        </div>
      </div>

      <div class="group-title">Gelişmiş</div>
      <Toggle label="Çerçeve kaçışını engelle" hint="sandbox ile sitenin üst pencereyi ele geçirmesini önler. Bir site bozuk çalışıyorsa kapatın."
              on={s.frameBusting} onChange={(v) => actions.setSettings({ frameBusting: v })} />

      <div class="group-title">Renk şeması emülasyonu</div>
      <div style={{ padding: '0 10px 12px', fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.55 }}>
        Üstteki <b>Renk şeması</b> seçimi şu an <b>yalnızca JavaScript düzeyinde</b> uygulanır:
        <code>matchMedia('(prefers-color-scheme: dark)')</code> sorgusu emüle edilen değeri döndürür,
        ancak sitenin CSS'indeki <code>@media (prefers-color-scheme)</code> kuralları işletim
        sisteminizin temasına göre çalışmaya devam eder.
        <br /><br />
        CDP tabanlı bir “Pro Mod” denendi ve kaldırıldı: Chrome, <code>debugger</code> iznini
        isteğe bağlı olarak vermiyor — yalnızca kalıcı ve kapsamlı bir kurulum izniyle mümkün.
        Tek bir özellik için bu takas yapılmadı.
        <br /><br />
        Gerçek CSS koyu mod emülasyonu <b>Faz 3</b>'te, izin gerektirmeyen bir yolla
        (sayfanın <code>prefers-color-scheme</code> media kurallarının yeniden yazılması) gelecek.
      </div>

      <div class="group-title">Klavye kısayolları</div>
      <div style={{ padding: '0 10px 20px', fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 2 }}>
        <div><kbd>Ctrl</kbd>+<kbd>L</kbd> adres çubuğu</div>
        <div><kbd>Ctrl</kbd>+<kbd>R</kbd> tümünü yenile</div>
        <div><kbd>Ctrl</kbd>+<kbd>B</kbd> yan paneli aç/kapat</div>
        <div><kbd>Ctrl</kbd>+<kbd>0</kbd> ölçeği sığdır</div>
        <div><kbd>Ctrl</kbd>+<kbd>+</kbd> / <kbd>-</kbd> yakınlaştır</div>
        <div><kbd>R</kbd> tüm ekranları çevir</div>
        <div><kbd>O</kbd> kontur · <kbd>T</kbd> taşma · <kbd>G</kbd> ızgara</div>
        <div><kbd>I</kbd> denetçi · <kbd>M</kbd> cetvel</div>
        <div><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> tasarım bindirmesini hizala</div>
        <div><kbd>Esc</kbd> tek-ekran modundan çık</div>
      </div>
    </div>
  )
}

function Toggle({ label, hint, on, onChange }: {
  label: string; hint: string; on: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div class="set-row" onClick={() => onChange(!on)} style={{ cursor: 'pointer', margin: '0 6px' }}>
      <div class="txt"><b>{label}</b><small>{hint}</small></div>
      <div class={`switch${on ? ' on' : ''}`} />
    </div>
  )
}
