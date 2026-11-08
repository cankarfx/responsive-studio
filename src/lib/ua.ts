/**
 * User-Agent ve Client Hints üretimi.
 *
 * Sabit UA dizeleri gömmek yerine, çalışma anında kullanıcının GERÇEK Chrome
 * sürümünü okuyup şablonlara yerleştiriyoruz. Böylece eklenti eskimiyor ve
 * üretilen UA'lar her zaman geçerli görünüyor.
 */
import type { BrowserProfile, DeviceSpec, UaDataOverride } from './types'

function detectChromeVersion(): { major: string; full: string } {
  const m = /Chrome\/(\d+)\.(\d+)\.(\d+)\.(\d+)/.exec(navigator.userAgent)
  if (m) return { major: m[1], full: `${m[1]}.${m[2]}.${m[3]}.${m[4]}` }
  return { major: '140', full: '140.0.0.0' }
}

const chromeVer = detectChromeVersion()

/** Motor sürümleri — Ayarlar ekranından değiştirilebilir. */
export const ENGINE = {
  chrome: chromeVer.major,
  chromeFull: chromeVer.full,
  /** Edge, Chromium ile aynı ana sürümü kullanır */
  edge: chromeVer.major,
  opera: String(Number(chromeVer.major) - 26),
  firefox: '144.0',
  /** Safari / WebKit */
  safariVersion: '18.6',
  webkit: '605.1.15',
  /** iOS sürümü (UA formatı: alt çizgili) */
  iosVersion: '18_6',
  /** Android sürümü */
  androidVersion: '16',
  /** Samsung Internet */
  samsung: '27.0',
  macOS: '10_15_7',
}

const WEBKIT_BLINK = 'AppleWebKit/537.36 (KHTML, like Gecko)'

/** İşletim sistemi + tarayıcı profiline göre tam UA dizesi üretir. */
export function buildUserAgent(device: DeviceSpec, browser: BrowserProfile): string {
  const C = ENGINE.chrome
  const isMobile = device.category === 'phone' || device.category === 'foldable' || device.category === 'watch'
  const model = device.model ?? 'K'

  switch (device.os) {
    case 'ios': {
      const ios = ENGINE.iosVersion
      if (browser === 'chrome')
        return `Mozilla/5.0 (iPhone; CPU iPhone OS ${ios} like Mac OS X) AppleWebKit/${ENGINE.webkit} (KHTML, like Gecko) CriOS/${C}.0.0.0 Mobile/15E148 Safari/604.1`
      if (browser === 'firefox')
        return `Mozilla/5.0 (iPhone; CPU iPhone OS ${ios} like Mac OS X) AppleWebKit/${ENGINE.webkit} (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15`
      if (browser === 'edge')
        return `Mozilla/5.0 (iPhone; CPU iPhone OS ${ios} like Mac OS X) AppleWebKit/${ENGINE.webkit} (KHTML, like Gecko) Version/${ENGINE.safariVersion} EdgiOS/${C}.0.0.0 Mobile/15E148 Safari/604.1`
      return `Mozilla/5.0 (iPhone; CPU iPhone OS ${ios} like Mac OS X) AppleWebKit/${ENGINE.webkit} (KHTML, like Gecko) Version/${ENGINE.safariVersion} Mobile/15E148 Safari/604.1`
    }
    case 'ipados': {
      const ios = ENGINE.iosVersion
      if (browser === 'chrome')
        return `Mozilla/5.0 (iPad; CPU OS ${ios} like Mac OS X) AppleWebKit/${ENGINE.webkit} (KHTML, like Gecko) CriOS/${C}.0.0.0 Mobile/15E148 Safari/604.1`
      // iPadOS varsayılanı "masaüstü site iste" — Mac UA gönderir
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${ENGINE.macOS}) AppleWebKit/${ENGINE.webkit} (KHTML, like Gecko) Version/${ENGINE.safariVersion} Safari/605.1.15`
    }
    case 'android': {
      const A = ENGINE.androidVersion
      const mob = isMobile || device.category === 'foldable' ? ' Mobile' : ''
      if (browser === 'firefox')
        return `Mozilla/5.0 (Android ${A}; Mobile; rv:${ENGINE.firefox}) Gecko/${ENGINE.firefox} Firefox/${ENGINE.firefox}`
      if (browser === 'samsung')
        return `Mozilla/5.0 (Linux; Android ${A}; ${model}) ${WEBKIT_BLINK} SamsungBrowser/${ENGINE.samsung} Chrome/${C}.0.0.0${mob} Safari/537.36`
      if (browser === 'edge')
        return `Mozilla/5.0 (Linux; Android ${A}; ${model}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0${mob} Safari/537.36 EdgA/${C}.0.0.0`
      if (browser === 'opera')
        return `Mozilla/5.0 (Linux; Android ${A}; ${model}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0${mob} Safari/537.36 OPR/${ENGINE.opera}.0.0.0`
      if (browser === 'webview')
        return `Mozilla/5.0 (Linux; Android ${A}; ${model}; wv) ${WEBKIT_BLINK} Version/4.0 Chrome/${C}.0.0.0${mob} Safari/537.36`
      return `Mozilla/5.0 (Linux; Android ${A}; ${model}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0${mob} Safari/537.36`
    }
    case 'macos': {
      const mac = `Macintosh; Intel Mac OS X ${ENGINE.macOS}`
      if (browser === 'safari')
        return `Mozilla/5.0 (${mac}) AppleWebKit/${ENGINE.webkit} (KHTML, like Gecko) Version/${ENGINE.safariVersion} Safari/605.1.15`
      if (browser === 'firefox')
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${ENGINE.firefox}) Gecko/20100101 Firefox/${ENGINE.firefox}`
      if (browser === 'edge')
        return `Mozilla/5.0 (${mac}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0 Safari/537.36 Edg/${C}.0.0.0`
      if (browser === 'opera')
        return `Mozilla/5.0 (${mac}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0 Safari/537.36 OPR/${ENGINE.opera}.0.0.0`
      return `Mozilla/5.0 (${mac}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0 Safari/537.36`
    }
    case 'linux': {
      if (browser === 'firefox')
        return `Mozilla/5.0 (X11; Linux x86_64; rv:${ENGINE.firefox}) Gecko/20100101 Firefox/${ENGINE.firefox}`
      return `Mozilla/5.0 (X11; Linux x86_64) ${WEBKIT_BLINK} Chrome/${C}.0.0.0 Safari/537.36`
    }
    default: {
      const win = 'Windows NT 10.0; Win64; x64'
      if (browser === 'firefox')
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${ENGINE.firefox}) Gecko/20100101 Firefox/${ENGINE.firefox}`
      if (browser === 'edge')
        return `Mozilla/5.0 (${win}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0 Safari/537.36 Edg/${C}.0.0.0`
      if (browser === 'opera')
        return `Mozilla/5.0 (${win}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0 Safari/537.36 OPR/${ENGINE.opera}.0.0.0`
      if (browser === 'safari')
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${ENGINE.macOS}) AppleWebKit/${ENGINE.webkit} (KHTML, like Gecko) Version/${ENGINE.safariVersion} Safari/605.1.15`
      return `Mozilla/5.0 (${win}) ${WEBKIT_BLINK} Chrome/${C}.0.0.0 Safari/537.36`
    }
  }
}

/** navigator.platform karşılığı */
export function platformFor(device: DeviceSpec): string {
  switch (device.os) {
    case 'ios': return 'iPhone'
    case 'ipados': return 'MacIntel'
    case 'android': return 'Linux armv81'
    case 'macos': return 'MacIntel'
    case 'linux': return 'Linux x86_64'
    default: return 'Win32'
  }
}

function chBrands(browser: BrowserProfile): { brand: string; version: string }[] {
  const C = ENGINE.chrome
  // GREASE markası — gerçek Chrome da böyle sahte bir giriş gönderir
  const grease = { brand: 'Not=A?Brand', version: '24' }
  switch (browser) {
    case 'edge':
      return [{ brand: 'Chromium', version: C }, grease, { brand: 'Microsoft Edge', version: C }]
    case 'opera':
      return [{ brand: 'Chromium', version: C }, grease, { brand: 'Opera', version: ENGINE.opera }]
    case 'samsung':
      return [{ brand: 'Chromium', version: C }, grease, { brand: 'Samsung Internet', version: ENGINE.samsung }]
    default:
      return [{ brand: 'Chromium', version: C }, grease, { brand: 'Google Chrome', version: C }]
  }
}

/** Client Hints (navigator.userAgentData) override nesnesi üretir. */
export function buildUaData(device: DeviceSpec, browser: BrowserProfile): UaDataOverride {
  const mobile =
    device.category === 'phone' || device.category === 'foldable' || device.category === 'watch'
  const chPlatform =
    device.os === 'android' ? 'Android'
      : device.os === 'ios' ? 'iOS'
      : device.os === 'ipados' ? 'macOS'
      : device.os === 'macos' ? 'macOS'
      : device.os === 'linux' ? 'Linux'
      : 'Windows'
  const platformVersion =
    device.os === 'android' ? `${ENGINE.androidVersion}.0.0`
      : device.os === 'macos' || device.os === 'ipados' ? '15.6.0'
      : device.os === 'ios' ? ENGINE.iosVersion.replace(/_/g, '.')
      : device.os === 'linux' ? '6.11.0'
      : '19.0.0'

  return {
    brands: chBrands(browser),
    mobile,
    platform: chPlatform,
    platformVersion,
    architecture: device.os === 'android' || device.os === 'ios' ? '' : 'x86',
    bitness: device.os === 'android' || device.os === 'ios' ? '' : '64',
    model: device.os === 'android' ? (device.model ?? '') : '',
    uaFullVersion: `${ENGINE.chrome}.0.0.0`,
    wow64: false,
  }
}

/** HTTP `Sec-CH-UA` başlığı biçimi */
export function chUaHeader(browser: BrowserProfile): string {
  return chBrands(browser).map((b) => `"${b.brand}";v="${b.version}"`).join(', ')
}

export const BROWSER_LABELS: Record<BrowserProfile, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  safari: 'Safari',
  opera: 'Opera',
  samsung: 'Samsung Internet',
  webview: 'Android WebView',
}
