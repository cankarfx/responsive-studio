/** Basit, bağımlılıksız durum deposu + chrome.storage kalıcılığı. */
import { useSyncExternalStore } from 'preact/compat'
import type {
  AppSettings, ChromeSettings, CustomHeader, DesignOverlay, DeviceSpec, ElementInfo, Frame,
  GridOptions, InspectTool, LayoutMode, MediaOverrides, ScanKind, ScanResult, SyncSettings,
  VisionSim, Workspace,
} from '@/lib/types'
import { DEFAULT_MEDIA } from '@/lib/types'
import { BUILTIN_SETS, DEVICE_MAP, DEVICES } from '@/devices/catalog'

export type DrawerTab =
  | 'console' | 'breakpoints' | 'overflow' | 'inspect'
  | 'links' | 'assets' | 'fonts' | 'vitals' | 'meta'
  /* ── Faz 3 ── */
  | 'axe' | 'contrast' | 'headings' | 'landmarks' | 'images' | 'tabOrder' | 'targets'
  | 'social' | 'pwa'
  /* ── Faz 4 ── */
  | 'cssvars' | 'storage' | 'code' | 'headers' | 'touchDiag'

export interface ConsoleEntry {
  fid: string
  level: 'error' | 'warn' | 'info'
  text: string
  source?: string
  time: number
  count: number
}

export interface FrameInfo {
  url?: string
  title?: string
  scrollHeight?: number
  scrollWidth?: number
  overflow?: boolean
  error?: string
  ready?: boolean
}

export interface AppState {
  /** Frame'lerin gösterdiği adres */
  url: string
  /** Adres çubuğundaki metin (henüz gidilmemiş olabilir) */
  draftUrl: string
  /** Her değiştiğinde tüm frame'ler yeniden yüklenir */
  reloadKey: number
  frames: Frame[]
  /** Sürükleyerek yeniden sıralama — yalnızca sürükleme sürerken dolu, kalıcılaştırılmaz */
  reorder: { fid: string; hedefFid: string | null; sonrasina: boolean } | null
  layout: LayoutMode
  zoom: number | 'fit'
  gap: number
  sync: SyncSettings
  chromeOpts: ChromeSettings
  settings: AppSettings
  workspaces: Workspace[]
  /** Açık yan panel */
  panel: 'devices' | 'settings' | 'workspaces' | null
  frameInfo: Record<string, FrameInfo>
  /** Geçici bildirim */
  toast: { text: string; kind: 'info' | 'error' | 'ok' } | null
  /** Gerçek CSS medya emülasyonu (tüm ekranlara uygulanır) */
  media: MediaOverrides
  /** Görme / renk körlüğü simülasyonu */
  vision: VisionSim
  /** Metin ölçekleme testi (%) */
  textScale: number
  /* ── Faz 2 ── */
  tool: InspectTool
  grid: GridOptions
  drawer: { open: boolean; tab: DrawerTab; height: number }
  /** Ekran başına tarama sonuçları */
  scans: Record<string, Partial<Record<ScanKind, ScanResult>>>
  consoleLogs: ConsoleEntry[]
  inspected: { fid: string; info: ElementInfo } | null
  overflowItems: Record<string, { path: string; tag: string; right: number }[]>
  capture: { busy: boolean; label: string } | null
  /** Ekran kaydı sürüyor mu */
  recording: boolean
  /** Adres geçmişi (geri/ileri) */
  history: string[]
  historyIndex: number
}

export const DEFAULT_SYNC: SyncSettings = {
  scroll: true,
  scrollMode: 'ratio',
  click: true,
  input: true,
  hover: false,
  navigation: true,
  soloFid: null,
}

export const DEFAULT_CHROME: ChromeSettings = {
  bezel: false,
  safeArea: true,
  labels: true,
  scrollbars: false,
  canvasGrid: true,
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  proMode: false,
  httpUserAgent: null,
  autoReload: 0,
  customDevices: [],
  deviceSets: [],
  lastWorkspaceId: null,
  favorites: ['iphone-17-pro', 'galaxy-s25', 'ipad-air-11', 'mba-13'],
  defaultBrowser: 'chrome',
  frameBusting: true,
  customHeaders: [],
  injectCss: '',
  injectJs: '',
  startupSet: 'set-populer',
  loadStagger: 150,
  touchMode: true,
}

let seq = 0
export function makeFrame(deviceId: string, over: Partial<Frame> = {}): Frame {
  const dev = DEVICE_MAP.get(deviceId) ?? DEVICES[0]
  return {
    fid: `f${Date.now().toString(36)}${(seq++).toString(36)}`,
    deviceId: dev.id,
    width: dev.width,
    height: dev.height,
    dpr: dev.dpr,
    landscape: false,
    browser: dev.defaultBrowser,
    zoom: null,
    hidden: false,
    colorScheme: 'auto',
    ...over,
  }
}

const STARTER = BUILTIN_SETS[0].deviceIds

function initialState(): AppState {
  return {
    url: '',
    draftUrl: '',
    reloadKey: 0,
    reorder: null,
    frames: STARTER.map((id) => makeFrame(id)),
    layout: 'grid',
    zoom: 'fit',
    gap: 24,
    sync: { ...DEFAULT_SYNC },
    chromeOpts: { ...DEFAULT_CHROME },
    settings: { ...DEFAULT_SETTINGS },
    workspaces: [],
    panel: 'devices',
    frameInfo: {},
    toast: null,
    media: { ...DEFAULT_MEDIA },
    vision: 'none',
    textScale: 100,
    tool: 'none',
    grid: { columns: 12, gutter: 24, maxWidth: 1200, baseline: 0, square: 0 },
    drawer: { open: false, tab: 'console', height: 240 },
    scans: {},
    consoleLogs: [],
    inspected: null,
    overflowItems: {},
    capture: null,
    recording: false,
    history: [],
    historyIndex: -1,
  }
}

/* ─── Depo ───────────────────────────────────────────────────────── */

let state: AppState = initialState()
const listeners = new Set<() => void>()

export function getState() { return state }

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  const prev = state
  state = { ...state, ...p }
  listeners.forEach((l) => l())
  /* Yalnızca kalıcı dilimler değiştiyse kaydet — konsol/ölçüm gibi geçici
     güncellemeler kaydı sürekli ertelemesin. */
  if (!applyingRemote && PERSISTED_KEYS.some((k) => prev[k] !== state[k])) schedulePersist()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, () => state)
}

/* ─── Kalıcılık ──────────────────────────────────────────────────── */

const PERSIST_KEY = 'rs_state_v1'
const PERSISTED_KEYS = [
  'frames', 'layout', 'zoom', 'gap', 'sync', 'chromeOpts', 'settings', 'workspaces', 'panel', 'url',
] as const satisfies readonly (keyof AppState)[]
/** Tasarım bindirmeleri data: URL olarak tutulur; depolama kotası 10 MB. */
const OVERLAY_BUDGET = 3_000_000
let persistTimer = 0
let persistFirst = 0
/** Kaydedilmemiş değişiklik var mı (kapanışta yalnızca o zaman yazılır) */
let dirty = false
let applyingRemote = false
let lastWritten = ''
let quotaWarned = false

function schedulePersist() {
  dirty = true
  clearTimeout(persistTimer)
  /* Ardışık değişikliklerde en geç 2 sn içinde mutlaka kaydet */
  const now = Date.now()
  if (!persistFirst) persistFirst = now
  const wait = now - persistFirst > 2000 ? 0 : 400
  persistTimer = setTimeout(persist, wait) as unknown as number
}

/**
 * Kalıcı biçime çevirir: ekran görüntüsünün geçici yüksekliği atılır,
 * bindirme görselleri bütçeyi aşarsa kaydedilmez (yalnızca bu oturumda kalır).
 */
function framesForStorage(frames: Frame[], overlayBudget: number): Frame[] {
  let budget = overlayBudget
  return frames.map((f) => {
    let overlay = f.overlay ?? null
    if (overlay) {
      const size = overlay.src?.length ?? 0
      if (size > budget) overlay = null
      else budget -= size
    }
    return { ...f, forceH: null, overlay }
  })
}

/** Bozuk / eski kayıtlardan gelen geçersiz ekranları ayıklar. */
function validFrames(list: unknown): Frame[] | null {
  if (!Array.isArray(list)) return null
  const ok = list.filter((f): f is Frame => !!f && typeof f === 'object'
    && typeof (f as Frame).fid === 'string' && typeof (f as Frame).deviceId === 'string'
    && Number.isFinite((f as Frame).width) && (f as Frame).width > 0
    && Number.isFinite((f as Frame).height) && (f as Frame).height > 0)
    .map((f) => ({ ...f, forceH: null }))
  return ok.length ? ok : null
}

async function persist() {
  persistFirst = 0
  dirty = false
  const s = state
  const data = {
    frames: framesForStorage(s.frames, OVERLAY_BUDGET),
    layout: s.layout,
    zoom: s.zoom,
    gap: s.gap,
    sync: s.sync,
    chromeOpts: s.chromeOpts,
    settings: s.settings,
    workspaces: s.workspaces.map((w) => ({ ...w, frames: framesForStorage(w.frames, 0) })),
    panel: s.panel,
    lastUrl: s.url,
  }
  try {
    lastWritten = JSON.stringify(data)
    await chrome.storage.local.set({ [PERSIST_KEY]: data })
  } catch (e) {
    if (!quotaWarned) {
      quotaWarned = true
      actions.toast(`Ayarlar kaydedilemedi: ${(e as Error)?.message ?? 'depolama hatası'}`, 'error')
    }
  }
}

/* Sekme kapanırken bekleyen kaydı hemen yaz */
addEventListener('pagehide', () => {
  if (dirty) { clearTimeout(persistTimer); void persist() }
})

/* Birden fazla stüdyo sekmesi: diğer sekmenin kaydettiği ayarları ve çalışma
   alanlarını al — yoksa bu sekme eski kopyasıyla onları ezerdi. Ekran düzeni
   sekmeye özel kalır. */
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PERSIST_KEY]) return
    const nv = changes[PERSIST_KEY].newValue as { settings?: AppSettings; workspaces?: Workspace[] } | undefined
    if (!nv || JSON.stringify(nv) === lastWritten) return
    applyingRemote = true
    try {
      setState({
        settings: { ...DEFAULT_SETTINGS, ...(nv.settings ?? {}) },
        workspaces: Array.isArray(nv.workspaces) ? nv.workspaces : state.workspaces,
      })
    } finally { applyingRemote = false }
  })
} catch { /* test ortamı */ }

export async function hydrate() {
  try {
    const got = await chrome.storage.local.get(PERSIST_KEY)
    const saved = got?.[PERSIST_KEY] as Partial<AppState> & { lastUrl?: string } | undefined
    if (!saved) return
    state = {
      ...state,
      frames: validFrames(saved.frames) ?? state.frames,
      layout: saved.layout ?? state.layout,
      zoom: saved.zoom ?? state.zoom,
      gap: typeof saved.gap === 'number' ? saved.gap : state.gap,
      sync: { ...DEFAULT_SYNC, ...(saved.sync ?? {}) },
      chromeOpts: { ...DEFAULT_CHROME, ...(saved.chromeOpts ?? {}) },
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
      workspaces: Array.isArray(saved.workspaces) ? saved.workspaces : [],
      panel: saved.panel ?? state.panel,
    }
    /* Silinmiş özel cihazlara ait yetim ekranlar sayaçta görünüp boş kalmasın */
    const alive = state.frames.filter((f) => deviceById(state.settings, f.deviceId))
    if (alive.length !== state.frames.length) state = { ...state, frames: alive }
    listeners.forEach((l) => l())
  } catch { /* yoksay */ }
}

/* ─── Eylemler ───────────────────────────────────────────────────── */

export const actions = {
  toast(text: string, kind: 'info' | 'error' | 'ok' = 'info') {
    setState({ toast: { text, kind } })
    setTimeout(() => {
      if (getState().toast?.text === text) setState({ toast: null })
    }, 2600)
  },

  navigate(raw: string, pushHistory = true) {
    const url = normalizeUrl(raw)
    if (!url) return
    setState((s) => {
      const history = pushHistory
        ? [...s.history.slice(0, s.historyIndex + 1), url]
        : s.history
      return {
        url,
        draftUrl: url,
        history,
        historyIndex: pushHistory ? history.length - 1 : s.historyIndex,
        reloadKey: s.reloadKey + 1,
        frameInfo: {},
      }
    })
  },

  back() {
    const s = getState()
    if (s.historyIndex <= 0) return
    const i = s.historyIndex - 1
    setState({ historyIndex: i, url: s.history[i], draftUrl: s.history[i], reloadKey: s.reloadKey + 1 })
  },

  forward() {
    const s = getState()
    if (s.historyIndex >= s.history.length - 1) return
    const i = s.historyIndex + 1
    setState({ historyIndex: i, url: s.history[i], draftUrl: s.history[i], reloadKey: s.reloadKey + 1 })
  },

  reloadAll() {
    setState((s) => ({ reloadKey: s.reloadKey + 1, frameInfo: {} }))
  },

  addDevice(deviceId: string) {
    setState((s) => ({ frames: [...s.frames, makeFrame(deviceId, { browser: s.settings.defaultBrowser })] }))
  },

  toggleDevice(deviceId: string) {
    const s = getState()
    const existing = s.frames.filter((f) => f.deviceId === deviceId)
    if (existing.length) {
      setState({ frames: s.frames.filter((f) => f.deviceId !== deviceId) })
    } else {
      actions.addDevice(deviceId)
    }
  },

  removeFrame(fid: string) {
    setState((s) => ({
      frames: s.frames.filter((f) => f.fid !== fid),
      sync: s.sync.soloFid === fid ? { ...s.sync, soloFid: null } : s.sync,
    }))
  },

  updateFrame(fid: string, patch: Partial<Frame>) {
    setState((s) => ({ frames: s.frames.map((f) => (f.fid === fid ? { ...f, ...patch } : f)) }))
  },

  rotateFrame(fid: string) {
    setState((s) => ({
      frames: s.frames.map((f) => (f.fid === fid ? { ...f, landscape: !f.landscape } : f)),
    }))
  },

  rotateAll() {
    setState((s) => {
      const anyPortrait = s.frames.some((f) => !f.landscape)
      return { frames: s.frames.map((f) => ({ ...f, landscape: anyPortrait })) }
    })
  },

  /** Sürükleme durumunu günceller (bırakma göstergesi buna bakar). */
  setReorder(r: AppState['reorder']) {
    setState({ reorder: r })
  },

  /**
   * `fid`'i `hedefFid`'in önüne (veya `sonrasina` ise arkasına) taşır.
   *
   * Index yerine fid ile çalışıyor: tuval yalnızca `hidden` olmayan kareleri
   * diziyor, dolayısıyla oradaki sıra `frames` dizisinin index'iyle örtüşmüyor.
   */
  moveFrameTo(fid: string, hedefFid: string, sonrasina: boolean) {
    if (fid === hedefFid) return
    setState((s) => {
      const fr = [...s.frames]
      const from = fr.findIndex((f) => f.fid === fid)
      if (from < 0) return {}
      const [item] = fr.splice(from, 1)
      let to = fr.findIndex((f) => f.fid === hedefFid)
      if (to < 0) return {}
      if (sonrasina) to++
      fr.splice(to, 0, item)
      return { frames: fr }
    })
  },

  moveFrame(from: number, to: number) {
    setState((s) => {
      const fr = [...s.frames]
      const [item] = fr.splice(from, 1)
      fr.splice(to, 0, item)
      return { frames: fr }
    })
  },

  applySet(deviceIds: string[], replace = true) {
    setState((s) => ({
      frames: replace
        ? deviceIds.map((id) => makeFrame(id, { browser: s.settings.defaultBrowser }))
        : [...s.frames, ...deviceIds.map((id) => makeFrame(id, { browser: s.settings.defaultBrowser }))],
      frameInfo: replace ? {} : s.frameInfo,
    }))
  },

  clearFrames() { setState({ frames: [], frameInfo: {} }) },

  setSync(patch: Partial<SyncSettings>) {
    setState((s) => ({ sync: { ...s.sync, ...patch } }))
  },

  setChromeOpts(patch: Partial<ChromeSettings>) {
    setState((s) => ({ chromeOpts: { ...s.chromeOpts, ...patch } }))
  },

  setSettings(patch: Partial<AppSettings>) {
    setState((s) => ({ settings: { ...s.settings, ...patch } }))
  },

  setFrameInfo(fid: string, patch: FrameInfo) {
    setState((s) => ({ frameInfo: { ...s.frameInfo, [fid]: { ...s.frameInfo[fid], ...patch } } }))
  },

  addCustomDevice(dev: DeviceSpec) {
    setState((s) => ({
      settings: { ...s.settings, customDevices: [...s.settings.customDevices, dev] },
    }))
  },

  removeCustomDevice(id: string) {
    setState((s) => ({
      settings: { ...s.settings, customDevices: s.settings.customDevices.filter((d) => d.id !== id) },
      frames: s.frames.filter((f) => f.deviceId !== id),
    }))
  },

  toggleFavorite(id: string) {
    setState((s) => {
      const fav = s.settings.favorites.includes(id)
        ? s.settings.favorites.filter((x) => x !== id)
        : [...s.settings.favorites, id]
      return { settings: { ...s.settings, favorites: fav } }
    })
  },

  saveWorkspace(name: string) {
    const s = getState()
    const ws: Workspace = {
      id: `w${Date.now().toString(36)}`,
      name,
      url: s.url,
      frames: s.frames,
      layout: s.layout,
      zoom: s.zoom,
      sync: s.sync,
      chrome: s.chromeOpts,
      gap: s.gap,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setState({ workspaces: [...s.workspaces, ws] })
    actions.toast(`"${name}" çalışma alanı kaydedildi`, 'ok')
  },

  /** Ayarlarda seçili açılış setini yükler. */
  loadStartupSet() {
    const s = getState()
    const set = BUILTIN_SETS.find((x) => x.id === s.settings.startupSet)
      ?? s.settings.deviceSets.find((x) => x.id === s.settings.startupSet)
      ?? BUILTIN_SETS[0]
    actions.applySet(set.deviceIds)
    actions.toast(`"${set.name}" seti yüklendi`, 'ok')
  },

  loadWorkspace(id: string) {
    const s = getState()
    const ws = s.workspaces.find((w) => w.id === id)
    if (!ws) return
    setState({
      frames: ws.frames.map((f) => ({ ...f, fid: makeFrame(f.deviceId).fid })),
      layout: ws.layout,
      zoom: ws.zoom,
      gap: ws.gap,
      sync: { ...DEFAULT_SYNC, ...ws.sync },
      chromeOpts: { ...DEFAULT_CHROME, ...ws.chrome },
      frameInfo: {},
    })
    if (ws.url) actions.navigate(ws.url)
    actions.toast(`"${ws.name}" yüklendi`, 'ok')
  },

  deleteWorkspace(id: string) {
    setState((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) }))
  },

  setPanel(p: AppState['panel']) {
    setState((s) => ({ panel: s.panel === p ? null : p }))
  },

  togglePanel() {
    setState((s) => ({ panel: s.panel ? null : 'devices' }))
  },

  setDraft(draftUrl: string) { setState({ draftUrl }) },

  setGap(gap: number) { setState({ gap }) },

  setZoom(zoom: number | 'fit') { setState({ zoom }) },

  zoomStep(dir: 1 | -1) {
    const steps = [0.1, 0.15, 0.2, 0.25, 0.33, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 2]
    const s = getState()
    const cur = typeof s.zoom === 'number' ? s.zoom : (window.__rsFitScale ?? 0.5)
    const i = steps.findIndex((v) => v > cur + 0.001)
    const next = dir === 1
      ? steps[Math.min(steps.length - 1, i < 0 ? steps.length - 1 : i)]
      : steps[Math.max(0, (i < 0 ? steps.length : i) - 2)]
    setState({ zoom: next })
  },

  setLayout(layout: LayoutMode) { setState({ layout }) },

  showAllFrames() {
    setState((s) => ({ frames: s.frames.map((f) => ({ ...f, hidden: false })) }))
  },

  saveDeviceSet(name: string) {
    const s = getState()
    const ids = [...new Set(s.frames.map((f) => f.deviceId))]
    if (!ids.length) return
    setState({
      settings: {
        ...s.settings,
        deviceSets: [...s.settings.deviceSets, { id: `s${Date.now().toString(36)}`, name, deviceIds: ids }],
      },
    })
    actions.toast(`"${name}" seti kaydedildi`, 'ok')
  },

  deleteDeviceSet(id: string) {
    setState((s) => ({
      settings: { ...s.settings, deviceSets: s.settings.deviceSets.filter((x) => x.id !== id) },
    }))
  },

  exportSettings() {
    const s = getState()
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: s.settings,
      workspaces: s.workspaces,
      frames: s.frames,
      layout: s.layout,
      gap: s.gap,
      sync: s.sync,
      chromeOpts: s.chromeOpts,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `responsive-studio-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    actions.toast('Ayarlar dışa aktarıldı', 'ok')
  },

  importSettings() {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'application/json,.json'
    inp.onchange = async () => {
      const file = inp.files?.[0]
      if (!file) return
      try {
        const data = JSON.parse(await file.text())
        if (!data || typeof data !== 'object'
          || !['settings', 'workspaces', 'frames'].some((k) => k in data)) {
          actions.toast('Bu dosya bir Responsive Studio ayar dosyası değil', 'error')
          return
        }
        setState((s) => ({
          /* Birleştir — dosyada olmayan ayarlar (özel cihazlar, başlıklar…) silinmesin */
          settings: { ...s.settings, ...(data.settings && typeof data.settings === 'object' ? data.settings : {}) },
          workspaces: Array.isArray(data.workspaces) ? data.workspaces : s.workspaces,
          frames: validFrames(data.frames) ?? s.frames,
          layout: data.layout ?? s.layout,
          gap: typeof data.gap === 'number' ? data.gap : s.gap,
          sync: { ...DEFAULT_SYNC, ...(data.sync ?? {}) },
          chromeOpts: { ...DEFAULT_CHROME, ...(data.chromeOpts ?? {}) },
        }))
        actions.toast('Ayarlar içe aktarıldı', 'ok')
      } catch {
        actions.toast('Dosya okunamadı', 'error')
      }
    }
    inp.click()
  },
}

declare global {
  interface Window { __rsFitScale?: number }
}

/* ─── Yardımcılar ────────────────────────────────────────────────── */

export function normalizeUrl(raw: string): string {
  let v = (raw ?? '').trim()
  if (!v) return ''
  if (/^(https?|file):\/\//i.test(v)) return v
  if (/^localhost(:\d+)?([/?#].*)?$/i.test(v)) return `http://${v}`
  if (/^127\.0\.0\.1(:\d+)?([/?#].*)?$/.test(v)) return `http://${v}`
  if (/^\d+\.\d+\.\d+\.\d+(:\d+)?([/?#].*)?$/.test(v)) return `http://${v}`
  /* alan.adı, alan.adı:port, Unicode alan adları (çiçek.com), myapp.test:5173 */
  if (!/\s/.test(v) && /^[\p{L}\p{N}.-]+\.[\p{L}]{2,}(:\d+)?([/?#].*)?$/u.test(v)) {
    try { return new URL(`https://${v}`).href } catch { /* aşağıda aramaya düş */ }
  }
  /* sunucu:port (ör. intranet:8080) */
  if (/^[\p{L}\p{N}-]+:\d{2,5}([/?#].*)?$/u.test(v)) return `http://${v}`
  /* Adres gibi görünmüyorsa arama yap */
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`
}

/** Yerleşik + özel cihazların birleşik listesi */
export function allDevices(settings: AppSettings): DeviceSpec[] {
  return [...DEVICES, ...settings.customDevices]
}

export function deviceById(settings: AppSettings, id: string): DeviceSpec | undefined {
  return DEVICE_MAP.get(id) ?? settings.customDevices.find((d) => d.id === id)
}

/** Frame'in gerçek (yön ve geçici yükseklik uygulanmış) ölçüleri */
export function frameSize(f: Frame): { w: number; h: number } {
  const base = f.landscape ? { w: f.height, h: f.width } : { w: f.width, h: f.height }
  return f.forceH ? { w: base.w, h: f.forceH } : base
}

/* ═══ Faz 2 eylemleri ════════════════════════════════════════════════ */

export const tools = {
  setMedia(patch: Partial<MediaOverrides>) {
    setState((s) => {
      const media = { ...s.media, ...patch }
      return {
        media,
        /* Frame yükündeki colorScheme, sayfa yüklenirken matchMedia'nın doğru
           cevap vermesi için senkron tutulur. Yeniden yükleme GEREKMEZ: CSS
           tarafı stylesheet yeniden yazımıyla canlı değişiyor. */
        frames: s.frames.map((f) => ({ ...f, colorScheme: media.colorScheme })),
      }
    })
  },

  setVision(vision: VisionSim) {
    setState((s) => ({ vision: s.vision === vision ? 'none' : vision }))
  },

  setTextScale(textScale: number) { setState({ textScale }) },

  setTool(tool: InspectTool) {
    setState((s) => ({ tool: s.tool === tool ? 'none' : tool }))
  },

  setGrid(patch: Partial<GridOptions>) {
    setState((s) => ({ grid: { ...s.grid, ...patch } }))
  },

  openDrawer(tab: DrawerTab) {
    setState((s) => ({
      drawer: { ...s.drawer, open: !(s.drawer.open && s.drawer.tab === tab), tab },
    }))
  },

  setDrawerHeight(height: number) {
    setState((s) => ({ drawer: { ...s.drawer, height: Math.max(120, Math.min(700, height)) } }))
  },

  closeDrawer() {
    setState((s) => ({ drawer: { ...s.drawer, open: false } }))
  },

  addConsole(e: Omit<ConsoleEntry, 'time' | 'count'>) {
    setState((s) => {
      const logs = [...s.consoleLogs]
      /* Aynı frame'den aynı mesaj tekrar gelirse sayaç artır — liste şişmesin */
      const last = logs.findIndex((l) => l.fid === e.fid && l.text === e.text && l.level === e.level)
      if (last >= 0) {
        logs[last] = { ...logs[last], count: logs[last].count + 1, time: Date.now() }
      } else {
        logs.push({ ...e, time: Date.now(), count: 1 })
        if (logs.length > 400) logs.shift()
      }
      return { consoleLogs: logs }
    })
  },

  clearConsole() { setState({ consoleLogs: [] }) },

  setScan(fid: string, what: ScanKind, data: ScanResult) {
    setState((s) => ({ scans: { ...s.scans, [fid]: { ...s.scans[fid], [what]: data } } }))
  },

  setInspected(fid: string, info: ElementInfo) {
    setState({ inspected: { fid, info }, drawer: { ...getState().drawer, open: true, tab: 'inspect' } })
  },

  setOverflowItems(fid: string, items: { path: string; tag: string; right: number }[]) {
    setState((s) => ({ overflowItems: { ...s.overflowItems, [fid]: items } }))
  },

  setCapture(capture: AppState['capture']) { setState({ capture }) },

  setRecording(recording: boolean) { setState({ recording }) },

  setInject(patch: { injectCss?: string; injectJs?: string }) {
    setState((s) => ({ settings: { ...s.settings, ...patch } }))
  },

  addHeader(init: { name?: string; value?: string } = {}) {
    setState((s) => ({
      settings: {
        ...s.settings,
        customHeaders: [...s.settings.customHeaders,
          { id: `h${Date.now().toString(36)}`, name: init.name ?? '', value: init.value ?? '', enabled: true }],
      },
    }))
  },

  updateHeader(id: string, patch: Partial<CustomHeader>) {
    setState((s) => ({
      settings: {
        ...s.settings,
        customHeaders: s.settings.customHeaders.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      },
    }))
  },

  removeHeader(id: string) {
    setState((s) => ({
      settings: { ...s.settings, customHeaders: s.settings.customHeaders.filter((h) => h.id !== id) },
    }))
  },

  setOverlay(fid: string, overlay: DesignOverlay | null) {
    actions.updateFrame(fid, { overlay })
  },

  patchOverlay(fid: string, patch: Partial<DesignOverlay>) {
    const f = getState().frames.find((x) => x.fid === fid)
    if (!f?.overlay) return
    actions.updateFrame(fid, { overlay: { ...f.overlay, ...patch } })
  },
}
