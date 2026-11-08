/** Ortak tip tanımları — hem viewer, hem service worker, hem content script kullanır. */

export type DeviceCategory =
  | 'phone'
  | 'tablet'
  | 'foldable'
  | 'laptop'
  | 'desktop'
  | 'watch'
  | 'tv'
  | 'console'
  | 'custom'

export type DeviceOS = 'ios' | 'ipados' | 'android' | 'windows' | 'macos' | 'linux' | 'other'

/** Tarayıcı profili — motor değişmez, yalnızca UA + Client Hints değişir. */
export type BrowserProfile =
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'safari'
  | 'opera'
  | 'samsung'
  | 'webview'

export interface SafeArea {
  top: number
  right: number
  bottom: number
  left: number
}

export interface DeviceSpec {
  id: string
  /** Görünen ad */
  name: string
  category: DeviceCategory
  brand: string
  /** Dikey (portrait) CSS piksel genişliği */
  width: number
  /** Dikey (portrait) CSS piksel yüksekliği */
  height: number
  /** Cihaz piksel oranı */
  dpr: number
  touch: boolean
  os: DeviceOS
  /** Bu cihaz için varsayılan tarayıcı profili */
  defaultBrowser: BrowserProfile
  /** Android/WebView UA'sında kullanılan model kodu */
  model?: string
  /** Çentik / yuvarlak köşe güvenli alanları (dikey konumda) */
  safeArea?: SafeArea
  /** Ekran köşe yarıçapı (px) — bezel çizimi için */
  radius?: number
  /** Piyasaya çıkış yılı — sıralama/filtre için */
  year?: number
  /** Kullanıcı tanımlı mı */
  custom?: boolean
  /** Popülerlik sıralaması (düşük = daha popüler) */
  rank?: number
  /** Listede ipucu olarak gösterilen açıklama (ör. gerçek ekran çözünürlüğü) */
  note?: string
  /**
   * Cihazın GERÇEK ekran ölçüsü (CSS px). Masaüstü presetlerinde `width`/`height`
   * tarayıcı viewport'unu temsil eder; `screen.width` / `screen.height` ise fiziksel
   * ekranı döndürmelidir. Belirtilmezse viewport ölçüsü kullanılır.
   */
  screenW?: number
  screenH?: number
}

/** Tuvaldeki tek bir ekran örneği. */
export interface Frame {
  /** Benzersiz örnek kimliği (aynı cihaz iki kez eklenebilir) */
  fid: string
  deviceId: string
  /** Cihaz tanımından sapma varsa (serbest boyutlandırma) */
  width: number
  height: number
  dpr: number
  landscape: boolean
  browser: BrowserProfile
  /** Frame başına zoom çarpanı (1 = otomatik ölçekle aynı) */
  zoom: number | null
  hidden: boolean
  /** Serbest tuval modunda konum */
  x?: number
  y?: number
  /** prefers-color-scheme override */
  colorScheme: 'auto' | 'light' | 'dark'
  /** Erişilebilirlik filtresi (Faz 3) */
  filter?: string | null
  locked?: boolean
  /** Ekran görüntüsü sırasında geçici olarak zorlanan yükseklik */
  forceH?: number | null
  /** Tasarım bindirmesi (pixel-perfect karşılaştırma) */
  overlay?: DesignOverlay | null
}

export interface DesignOverlay {
  /** data: URL olarak görsel */
  src: string
  opacity: number
  x: number
  y: number
  scale: number
  blend: 'normal' | 'difference'
  /** Bindirmeyi geçici gizle */
  hidden: boolean
}

export type LayoutMode = 'grid' | 'row' | 'column' | 'free' | 'focus'

export interface SyncSettings {
  scroll: boolean
  /** 'ratio' = oransal (farklı sayfa yüksekliklerinde hizalı), 'absolute' = birebir px */
  scrollMode: 'ratio' | 'absolute'
  click: boolean
  input: boolean
  hover: boolean
  navigation: boolean
  /** Etkileşimi yalnızca bu frame'e kilitler */
  soloFid: string | null
}

export interface ChromeSettings {
  /** Cihaz çerçevesi (bezel) göster */
  bezel: boolean
  /** Çentik / safe-area simülasyonu */
  safeArea: boolean
  /** Frame etiketlerini göster */
  labels: boolean
  /** Kaydırma çubuklarını göster */
  scrollbars: boolean
  /** Arka plan ızgarası */
  canvasGrid: boolean
}

export interface Workspace {
  id: string
  name: string
  url: string
  frames: Frame[]
  layout: LayoutMode
  zoom: number | 'fit'
  sync: SyncSettings
  chrome: ChromeSettings
  gap: number
  createdAt: number
  updatedAt: number
}

export interface DeviceSet {
  id: string
  name: string
  deviceIds: string[]
  builtin?: boolean
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  /** Pro Mod (chrome.debugger / CDP) açık mı */
  proMode: boolean
  /** Sekme geneli HTTP User-Agent override'ı (null = dokunma) */
  httpUserAgent: string | null
  /** Otomatik yenileme aralığı (sn, 0 = kapalı) */
  autoReload: number
  /** Kaydedilen özel cihazlar */
  customDevices: DeviceSpec[]
  /** Kullanıcı cihaz setleri */
  deviceSets: DeviceSet[]
  /** Son kullanılan çalışma alanı */
  lastWorkspaceId: string | null
  /** Sık kullanılan cihaz kimlikleri */
  favorites: string[]
  /** Yeni frame eklerken varsayılan tarayıcı profili */
  defaultBrowser: BrowserProfile
  /** Tüm isteklere eklenen özel HTTP başlıkları (yalnızca stüdyo sekmesinde) */
  customHeaders: CustomHeader[]
  /** Tüm ekranlara enjekte edilen canlı CSS */
  injectCss: string
  /** Tüm ekranlara enjekte edilen canlı JS */
  injectJs: string
  /** Stüdyo ilk açıldığında yüklenecek cihaz seti kimliği */
  startupSet: string
  /**
   * Ekranlar arasındaki yükleme gecikmesi (ms). Hepsi aynı anda yüklenirse
   * sunucuya N kat istek gider ve hız sınırlayıcılar (429) devreye girebilir.
   */
  loadStagger: number
  /**
   * Dokunmatik cihazlarda parmak emülasyonu: CSS `pointer`/`hover` sorguları
   * dokunmatik gibi davranır ve `:hover` stilleri hiç uygulanmaz. Kapatınca
   * ekranlar fareyle kullanılıyormuş gibi davranır (hover durumlarını
   * incelemek için kullanışlıdır).
   */
  touchMode: boolean
  /** iframe'i sandbox ile çalıştırıp sitenin üst pencereyi ele geçirmesini engelle */
  frameBusting: boolean
}

/* ─── Frame ↔ Viewer postMessage protokolü ─────────────────────────── */

export interface FramePayload {
  /** Güvenlik jetonu — yalnızca bizim mesajlarımız kabul edilir */
  token: string
  fid: string
  ua: string
  uaData: UaDataOverride
  width: number
  height: number
  /** Gerçek ekran ölçüsü — `screen.width` / `screen.height` bunu döndürür */
  screenW: number
  screenH: number
  dpr: number
  touch: boolean
  /** Parmak modu: CSS pointer/hover sorguları dokunmatik gibi davransın,
      `:hover` stilleri hiç uygulanmasın */
  touchMode: boolean
  colorScheme: 'auto' | 'light' | 'dark'
  safeArea: SafeArea | null
  os: DeviceOS
  platform: string
  /** Kaydırma çubukları görünsün mü (mobil cihazlarda gerçekçi olan: hayır) */
  showScrollbars: boolean
}

export interface UaDataOverride {
  brands: { brand: string; version: string }[]
  mobile: boolean
  platform: string
  platformVersion: string
  architecture: string
  bitness: string
  model: string
  uaFullVersion: string
  wow64: boolean
}

export type InspectTool = 'none' | 'outline' | 'overflow' | 'grid' | 'inspect' | 'measure'

export interface GridOptions {
  /** Kolon ızgarası */
  columns: number
  gutter: number
  maxWidth: number
  /** Taban çizgisi aralığı (0 = kapalı) */
  baseline: number
  /** Kare ızgara aralığı (0 = kapalı) */
  square: number
}

export type ScanKind =
  | 'breakpoints' | 'links' | 'assets' | 'fonts' | 'vitals' | 'meta'
  /* ── Faz 3 ── */
  | 'contrast' | 'headings' | 'landmarks' | 'images' | 'tabOrder' | 'targets' | 'axe' | 'pwa'
  /* ── Faz 4 ── */
  | 'cssvars' | 'storage' | 'touchDiag'

/** Gerçek CSS medya özelliği emülasyonu (stylesheet yeniden yazımıyla). */
export interface MediaOverrides {
  colorScheme: 'auto' | 'light' | 'dark'
  reducedMotion: 'auto' | 'reduce' | 'no-preference'
  contrast: 'auto' | 'more' | 'less'
  forcedColors: 'auto' | 'active'
}

export const DEFAULT_MEDIA: MediaOverrides = {
  colorScheme: 'auto',
  reducedMotion: 'auto',
  contrast: 'auto',
  forcedColors: 'auto',
}

/** Görme engeli / renk körlüğü simülasyonu */
export type VisionSim =
  | 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'
  | 'protanomaly' | 'deuteranomaly' | 'blur' | 'grayscale' | 'contrast' | 'invert'

export type ToFrameMessage =
  | { t: 'scroll'; x: number; y: number; ratioX: number; ratioY: number; mode: 'ratio' | 'absolute' }
  | { t: 'click'; path: string; x: number; y: number }
  | { t: 'input'; path: string; value: string; kind: 'value' | 'checked' }
  | { t: 'hover'; path: string | null }
  | { t: 'key'; path: string; key: string; code: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }
  | { t: 'ping' }
  | { t: 'css'; code: string }
  | { t: 'js'; code: string }
  | { t: 'measure' }
  | { t: 'reload'; hard: boolean }
  /* ── Faz 2 ── */
  | { t: 'tool'; tool: InspectTool; grid?: GridOptions }
  | { t: 'scan'; what: ScanKind }
  | { t: 'highlight'; path: string | null }
  | { t: 'setHeight'; height: number | null }
  | { t: 'scrollTo'; y: number }
  | { t: 'filter'; value: string | null }
  /* ── Faz 3 ── */
  | { t: 'media'; overrides: MediaOverrides; touch: boolean }
  | { t: 'vision'; sim: VisionSim }
  | { t: 'textScale'; percent: number }
  /* ── Faz 4 ── */
  | { t: 'storageOp'; op: 'clear' | 'remove'; area: 'local' | 'session'; key?: string }

export interface ElementInfo {
  path: string
  tag: string
  id: string
  classes: string
  /** Kutu modeli */
  rect: { x: number; y: number; w: number; h: number }
  margin: string
  padding: string
  border: string
  /** Öne çıkan hesaplanmış stiller */
  styles: Record<string, string>
  text: string
}

export interface ContrastIssue {
  path: string
  text: string
  fg: string
  bg: string
  ratio: number
  size: number
  bold: boolean
  large: boolean
  /** 'AA' | 'AAA' | 'fail' */
  level: 'AAA' | 'AA' | 'fail'
  uncertain: boolean
}

export interface HeadingNode { level: number; text: string; path: string; skipped: boolean }
export interface LandmarkNode { role: string; label: string; tag: string; path: string }
export interface ImageIssue { src: string; alt: string | null; decorative: boolean; issue: string | null; path: string }
export interface TabStop { index: number; tag: string; label: string; path: string; tabindex: string; visible: boolean }
export interface TargetIssue { path: string; tag: string; label: string; w: number; h: number }
export interface AxeIssue {
  id: string
  impact: string
  help: string
  description: string
  nodes: { path: string; summary: string }[]
  helpUrl: string
}
export interface CssVar { name: string; value: string; scope: string; isColor: boolean }

export interface StorageDump {
  local: { key: string; value: string; size: number }[]
  session: { key: string; value: string; size: number }[]
  cookieCount: number
  totalBytes: number
}

/** Kullanıcının tanımladığı özel HTTP istek başlığı */
export interface CustomHeader { id: string; name: string; value: string; enabled: boolean }

export interface PwaReport {
  manifest: { url: string | null; ok: boolean; name?: string; icons?: number; display?: string; themeColor?: string; startUrl?: string; error?: string }
  icons: { rel: string; href: string; sizes: string }[]
  themeColor: string | null
  appleTouchIcon: boolean
  serviceWorker: boolean
  httpsOk: boolean
}

export interface ScanResult {
  breakpoints?: { value: number; unit: string; feature: string; source: string }[]
  links?: { href: string; text: string; status?: number; external: boolean }[]
  assets?: { url: string; kind: string; broken: boolean; natural?: string; shown?: string }[]
  fonts?: { family: string; count: number; weights: string[] }[]
  vitals?: { lcp?: number; cls?: number; inp?: number; fcp?: number; ttfb?: number }
  meta?: Record<string, string>
  /* ── Faz 3 ── */
  contrast?: ContrastIssue[]
  headings?: HeadingNode[]
  landmarks?: LandmarkNode[]
  images?: ImageIssue[]
  tabOrder?: TabStop[]
  targets?: TargetIssue[]
  axe?: { issues: AxeIssue[]; passes: number; error?: string }
  pwa?: PwaReport
  /* ── Faz 4 ── */
  cssvars?: CssVar[]
  storage?: StorageDump
  touchDiag?: TouchDiag
}

/** Parmak modunun bir çerçevede ne yapabildiğinin dökümü */
export interface TouchDiag {
  parmakModu: boolean
  /** İşaretleyicimizi taşıyan media kuralı sayısı — yeniden yazımın kanıtı */
  yenidenYazilan: number
  toplamSheet: number
  okunabilir: number
  okunamayan: number
  adopted: number
  shadowKok: number
  kalanHoverKurali: number
  kalanHoverMedia: number
  ornekler: string[]
}

export type FromFrameMessage =
  | { t: 'ready'; fid: string; url: string; title: string }
  | { t: 'scroll'; fid: string; x: number; y: number; ratioX: number; ratioY: number }
  | { t: 'click'; fid: string; path: string; x: number; y: number }
  | { t: 'input'; fid: string; path: string; value: string; kind: 'value' | 'checked' }
  | { t: 'hover'; fid: string; path: string | null }
  | { t: 'key'; fid: string; path: string; key: string; code: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }
  | { t: 'navigate'; fid: string; url: string }
  | { t: 'metrics'; fid: string; scrollHeight: number; scrollWidth: number; overflow: boolean }
  | { t: 'error'; fid: string; message: string }
  /* ── Faz 2 ── */
  | { t: 'console'; fid: string; level: 'error' | 'warn' | 'info'; text: string; source?: string }
  | { t: 'scan'; fid: string; what: ScanKind; data: ScanResult }
  | { t: 'inspect'; fid: string; info: ElementInfo }
  | { t: 'color'; fid: string; hex: string }
  | { t: 'overflowList'; fid: string; items: { path: string; tag: string; right: number }[] }

/* ─── Viewer ↔ Service Worker mesajları ─────────────────────────────── */

export type BgRequest =
  | { t: 'registerViewer'; token: string }
  | { t: 'setHttpUserAgent'; ua: string | null; uaData: UaDataOverride | null }
  | { t: 'captureVisible' }
  | { t: 'openTab'; url: string }
