/**
 * Cihaz kütüphanesi.
 * Tüm ölçüler DİKEY (portrait) yönde CSS pikselidir.
 * Kaynaklar: üretici teknik özellikleri, yesviz.com, screensizechecker.com, Chrome DevTools.
 */
import type { DeviceSpec, DeviceCategory, DeviceOS, BrowserProfile, SafeArea } from '@/lib/types'

/* Sık kullanılan güvenli alan (çentik) profilleri */
const NOTCH: SafeArea = { top: 44, right: 0, bottom: 34, left: 0 }
const NOTCH_BIG: SafeArea = { top: 47, right: 0, bottom: 34, left: 0 }
const ISLAND: SafeArea = { top: 59, right: 0, bottom: 34, left: 0 }
const ISLAND_XL: SafeArea = { top: 62, right: 0, bottom: 34, left: 0 }
const PUNCH: SafeArea = { top: 24, right: 0, bottom: 24, left: 0 }
const IPAD_SA: SafeArea = { top: 24, right: 0, bottom: 20, left: 0 }

interface Opt {
  note?: string
  /** Gerçek ekran ölçüsü — viewport'tan farklıysa (masaüstü presetleri) */
  screen?: [number, number]
  model?: string
  safeArea?: SafeArea
  radius?: number
  year?: number
  browser?: BrowserProfile
  touch?: boolean
  rank?: number
}

function d(
  id: string, name: string, brand: string, category: DeviceCategory, os: DeviceOS,
  width: number, height: number, dpr: number, o: Opt = {},
): DeviceSpec {
  const touchDefault = category === 'phone' || category === 'tablet' || category === 'foldable' || category === 'watch'
  return {
    id, name, brand, category, os, width, height, dpr,
    touch: o.touch ?? touchDefault,
    defaultBrowser: o.browser ?? (os === 'ios' || os === 'ipados' ? 'safari' : 'chrome'),
    model: o.model,
    safeArea: o.safeArea,
    radius: o.radius ?? (category === 'phone' ? 44 : category === 'tablet' ? 20 : 4),
    year: o.year,
    rank: o.rank,
    note: o.note,
    screenW: o.screen?.[0],
    screenH: o.screen?.[1],
  }
}

export const DEVICES: DeviceSpec[] = [
  /* ─── iPhone ──────────────────────────────────────────────────── */
  d('iphone-17-pro-max', 'iPhone 17 Pro Max', 'Apple', 'phone', 'ios', 440, 956, 3, { safeArea: ISLAND_XL, year: 2025, rank: 2 }),
  d('iphone-17-pro', 'iPhone 17 Pro', 'Apple', 'phone', 'ios', 402, 874, 3, { safeArea: ISLAND_XL, year: 2025, rank: 1 }),
  d('iphone-17', 'iPhone 17', 'Apple', 'phone', 'ios', 402, 874, 3, { safeArea: ISLAND_XL, year: 2025, rank: 3 }),
  d('iphone-air', 'iPhone Air', 'Apple', 'phone', 'ios', 420, 912, 3, { safeArea: ISLAND_XL, year: 2025 }),
  d('iphone-16-pro-max', 'iPhone 16 Pro Max', 'Apple', 'phone', 'ios', 440, 956, 3, { safeArea: ISLAND_XL, year: 2024, rank: 5 }),
  d('iphone-16-pro', 'iPhone 16 Pro', 'Apple', 'phone', 'ios', 402, 874, 3, { safeArea: ISLAND_XL, year: 2024, rank: 4 }),
  d('iphone-16-plus', 'iPhone 16 Plus', 'Apple', 'phone', 'ios', 430, 932, 3, { safeArea: ISLAND, year: 2024 }),
  d('iphone-16', 'iPhone 16', 'Apple', 'phone', 'ios', 393, 852, 3, { safeArea: ISLAND, year: 2024, rank: 6 }),
  d('iphone-16e', 'iPhone 16e', 'Apple', 'phone', 'ios', 390, 844, 3, { safeArea: ISLAND, year: 2025 }),
  d('iphone-15-pro-max', 'iPhone 15 Pro Max', 'Apple', 'phone', 'ios', 430, 932, 3, { safeArea: ISLAND, year: 2023 }),
  d('iphone-15-pro', 'iPhone 15 Pro', 'Apple', 'phone', 'ios', 393, 852, 3, { safeArea: ISLAND, year: 2023, rank: 7 }),
  d('iphone-15-plus', 'iPhone 15 Plus', 'Apple', 'phone', 'ios', 430, 932, 3, { safeArea: ISLAND, year: 2023 }),
  d('iphone-15', 'iPhone 15', 'Apple', 'phone', 'ios', 393, 852, 3, { safeArea: ISLAND, year: 2023, rank: 8 }),
  d('iphone-14-pro-max', 'iPhone 14 Pro Max', 'Apple', 'phone', 'ios', 430, 932, 3, { safeArea: ISLAND, year: 2022 }),
  d('iphone-14-pro', 'iPhone 14 Pro', 'Apple', 'phone', 'ios', 393, 852, 3, { safeArea: ISLAND, year: 2022 }),
  d('iphone-14-plus', 'iPhone 14 Plus', 'Apple', 'phone', 'ios', 428, 926, 3, { safeArea: NOTCH_BIG, year: 2022 }),
  d('iphone-14', 'iPhone 14', 'Apple', 'phone', 'ios', 390, 844, 3, { safeArea: NOTCH_BIG, year: 2022, rank: 9 }),
  d('iphone-13-pro-max', 'iPhone 13 Pro Max', 'Apple', 'phone', 'ios', 428, 926, 3, { safeArea: NOTCH_BIG, year: 2021 }),
  d('iphone-13-pro', 'iPhone 13 Pro', 'Apple', 'phone', 'ios', 390, 844, 3, { safeArea: NOTCH_BIG, year: 2021 }),
  d('iphone-13', 'iPhone 13', 'Apple', 'phone', 'ios', 390, 844, 3, { safeArea: NOTCH_BIG, year: 2021, rank: 10 }),
  d('iphone-13-mini', 'iPhone 13 mini', 'Apple', 'phone', 'ios', 375, 812, 3, { safeArea: NOTCH, year: 2021 }),
  d('iphone-12-pro-max', 'iPhone 12 Pro Max', 'Apple', 'phone', 'ios', 428, 926, 3, { safeArea: NOTCH_BIG, year: 2020 }),
  d('iphone-12-pro', 'iPhone 12 Pro', 'Apple', 'phone', 'ios', 390, 844, 3, { safeArea: NOTCH_BIG, year: 2020 }),
  d('iphone-12', 'iPhone 12', 'Apple', 'phone', 'ios', 390, 844, 3, { safeArea: NOTCH_BIG, year: 2020 }),
  d('iphone-12-mini', 'iPhone 12 mini', 'Apple', 'phone', 'ios', 375, 812, 3, { safeArea: NOTCH, year: 2020 }),
  d('iphone-11-pro-max', 'iPhone 11 Pro Max', 'Apple', 'phone', 'ios', 414, 896, 3, { safeArea: NOTCH, year: 2019 }),
  d('iphone-11-pro', 'iPhone 11 Pro', 'Apple', 'phone', 'ios', 375, 812, 3, { safeArea: NOTCH, year: 2019 }),
  d('iphone-11', 'iPhone 11', 'Apple', 'phone', 'ios', 414, 896, 2, { safeArea: NOTCH, year: 2019 }),
  d('iphone-xr', 'iPhone XR', 'Apple', 'phone', 'ios', 414, 896, 2, { safeArea: NOTCH, year: 2018 }),
  d('iphone-xs-max', 'iPhone XS Max', 'Apple', 'phone', 'ios', 414, 896, 3, { safeArea: NOTCH, year: 2018 }),
  d('iphone-x', 'iPhone X / XS', 'Apple', 'phone', 'ios', 375, 812, 3, { safeArea: NOTCH, year: 2017 }),
  d('iphone-se3', 'iPhone SE (2022)', 'Apple', 'phone', 'ios', 375, 667, 2, { year: 2022, radius: 8, rank: 11 }),
  d('iphone-8-plus', 'iPhone 8 Plus', 'Apple', 'phone', 'ios', 414, 736, 3, { year: 2017, radius: 8 }),
  d('iphone-8', 'iPhone 6/7/8', 'Apple', 'phone', 'ios', 375, 667, 2, { year: 2017, radius: 8 }),
  d('iphone-se1', 'iPhone SE (2016)', 'Apple', 'phone', 'ios', 320, 568, 2, { year: 2016, radius: 8, rank: 12 }),
  d('iphone-5', 'iPhone 5 / 5s', 'Apple', 'phone', 'ios', 320, 568, 2, { year: 2013, radius: 8 }),

  /* ─── iPad ────────────────────────────────────────────────────── */
  d('ipad-pro-13-m5', 'iPad Pro 13" (M5)', 'Apple', 'tablet', 'ipados', 1032, 1376, 2, { safeArea: IPAD_SA, year: 2025, rank: 21 }),
  d('ipad-pro-11-m5', 'iPad Pro 11" (M5)', 'Apple', 'tablet', 'ipados', 834, 1210, 2, { safeArea: IPAD_SA, year: 2025, rank: 20 }),
  d('ipad-pro-13-m4', 'iPad Pro 13" (M4)', 'Apple', 'tablet', 'ipados', 1032, 1376, 2, { safeArea: IPAD_SA, year: 2024 }),
  d('ipad-pro-11-m4', 'iPad Pro 11" (M4)', 'Apple', 'tablet', 'ipados', 834, 1210, 2, { safeArea: IPAD_SA, year: 2024 }),
  d('ipad-pro-129', 'iPad Pro 12.9"', 'Apple', 'tablet', 'ipados', 1024, 1366, 2, { year: 2022, rank: 22 }),
  d('ipad-pro-11', 'iPad Pro 11"', 'Apple', 'tablet', 'ipados', 834, 1194, 2, { year: 2022, rank: 23 }),
  d('ipad-pro-105', 'iPad Pro 10.5"', 'Apple', 'tablet', 'ipados', 834, 1112, 2, { year: 2017 }),
  d('ipad-air-13', 'iPad Air 13" (M3)', 'Apple', 'tablet', 'ipados', 1024, 1366, 2, { year: 2025 }),
  d('ipad-air-11', 'iPad Air 11" (M3)', 'Apple', 'tablet', 'ipados', 820, 1180, 2, { year: 2025, rank: 24 }),
  d('ipad-air-4', 'iPad Air (4./5. nesil)', 'Apple', 'tablet', 'ipados', 820, 1180, 2, { year: 2022 }),
  d('ipad-11', 'iPad (11", A16)', 'Apple', 'tablet', 'ipados', 820, 1180, 2, { year: 2025 }),
  d('ipad-10', 'iPad (10. nesil)', 'Apple', 'tablet', 'ipados', 820, 1180, 2, { year: 2022, rank: 25 }),
  d('ipad-9', 'iPad (9. nesil)', 'Apple', 'tablet', 'ipados', 810, 1080, 2, { year: 2021 }),
  d('ipad-mini-7', 'iPad mini (A17 Pro)', 'Apple', 'tablet', 'ipados', 744, 1133, 2, { year: 2024, rank: 26 }),
  d('ipad-mini-5', 'iPad mini (5. nesil)', 'Apple', 'tablet', 'ipados', 768, 1024, 2, { year: 2019 }),
  d('ipad-97', 'iPad 9.7"', 'Apple', 'tablet', 'ipados', 768, 1024, 2, { year: 2018, rank: 27 }),

  /* ─── Samsung Galaxy ──────────────────────────────────────────── */
  d('galaxy-s25-ultra', 'Galaxy S25 Ultra', 'Samsung', 'phone', 'android', 384, 832, 3.75, { model: 'SM-S938B', safeArea: PUNCH, year: 2025, browser: 'samsung', rank: 31 }),
  d('galaxy-s25-plus', 'Galaxy S25+', 'Samsung', 'phone', 'android', 384, 832, 3, { model: 'SM-S936B', safeArea: PUNCH, year: 2025, browser: 'samsung' }),
  d('galaxy-s25', 'Galaxy S25', 'Samsung', 'phone', 'android', 360, 780, 3, { model: 'SM-S931B', safeArea: PUNCH, year: 2025, browser: 'samsung', rank: 30 }),
  d('galaxy-s24-ultra', 'Galaxy S24 Ultra', 'Samsung', 'phone', 'android', 384, 832, 3.75, { model: 'SM-S928B', safeArea: PUNCH, year: 2024, browser: 'samsung' }),
  d('galaxy-s24', 'Galaxy S24', 'Samsung', 'phone', 'android', 360, 780, 3, { model: 'SM-S921B', safeArea: PUNCH, year: 2024, browser: 'samsung', rank: 32 }),
  d('galaxy-s23-ultra', 'Galaxy S23 Ultra', 'Samsung', 'phone', 'android', 384, 824, 3.75, { model: 'SM-S918B', safeArea: PUNCH, year: 2023, browser: 'samsung' }),
  d('galaxy-s23', 'Galaxy S23', 'Samsung', 'phone', 'android', 360, 780, 3, { model: 'SM-S911B', safeArea: PUNCH, year: 2023, browser: 'samsung' }),
  d('galaxy-s22-ultra', 'Galaxy S22 Ultra', 'Samsung', 'phone', 'android', 384, 824, 3.75, { model: 'SM-S908B', safeArea: PUNCH, year: 2022, browser: 'samsung' }),
  d('galaxy-s22', 'Galaxy S22', 'Samsung', 'phone', 'android', 360, 780, 3, { model: 'SM-S901B', safeArea: PUNCH, year: 2022, browser: 'samsung' }),
  d('galaxy-s21-ultra', 'Galaxy S21 Ultra', 'Samsung', 'phone', 'android', 384, 854, 3.75, { model: 'SM-G998B', safeArea: PUNCH, year: 2021, browser: 'samsung' }),
  d('galaxy-s21', 'Galaxy S21', 'Samsung', 'phone', 'android', 360, 800, 3, { model: 'SM-G991B', safeArea: PUNCH, year: 2021, browser: 'samsung' }),
  d('galaxy-s20', 'Galaxy S20', 'Samsung', 'phone', 'android', 360, 800, 3, { model: 'SM-G980F', safeArea: PUNCH, year: 2020, browser: 'samsung', rank: 33 }),
  d('galaxy-s10', 'Galaxy S10', 'Samsung', 'phone', 'android', 360, 760, 4, { model: 'SM-G973F', year: 2019, browser: 'samsung' }),
  d('galaxy-s9', 'Galaxy S8 / S9', 'Samsung', 'phone', 'android', 360, 740, 4, { model: 'SM-G960F', year: 2018, browser: 'samsung', rank: 34 }),
  d('galaxy-note20', 'Galaxy Note 20', 'Samsung', 'phone', 'android', 412, 883, 2.625, { model: 'SM-N980F', year: 2020, browser: 'samsung' }),
  d('galaxy-a55', 'Galaxy A55', 'Samsung', 'phone', 'android', 360, 800, 3, { model: 'SM-A556B', year: 2024, browser: 'samsung', rank: 35 }),
  d('galaxy-a15', 'Galaxy A15', 'Samsung', 'phone', 'android', 360, 800, 3, { model: 'SM-A155F', year: 2024, browser: 'samsung' }),
  d('galaxy-tab-s10-ultra', 'Galaxy Tab S10 Ultra', 'Samsung', 'tablet', 'android', 960, 1536, 2, { model: 'SM-X926B', year: 2024 }),
  d('galaxy-tab-s9', 'Galaxy Tab S9', 'Samsung', 'tablet', 'android', 800, 1280, 2, { model: 'SM-X710', year: 2023, rank: 36 }),
  d('galaxy-tab-a9', 'Galaxy Tab A9+', 'Samsung', 'tablet', 'android', 800, 1280, 2, { model: 'SM-X210', year: 2023 }),

  /* ─── Katlanabilir ────────────────────────────────────────────── */
  d('z-fold7-closed', 'Galaxy Z Fold7 (kapalı)', 'Samsung', 'foldable', 'android', 374, 932, 3, { model: 'SM-F966B', year: 2025, browser: 'samsung', rank: 40 }),
  d('z-fold7-open', 'Galaxy Z Fold7 (açık)', 'Samsung', 'foldable', 'android', 704, 884, 2.625, { model: 'SM-F966B', year: 2025, browser: 'samsung', rank: 41 }),
  d('z-fold6-closed', 'Galaxy Z Fold6 (kapalı)', 'Samsung', 'foldable', 'android', 344, 882, 3.5, { model: 'SM-F956B', year: 2024, browser: 'samsung' }),
  d('z-fold6-open', 'Galaxy Z Fold6 (açık)', 'Samsung', 'foldable', 'android', 673, 841, 2.625, { model: 'SM-F956B', year: 2024, browser: 'samsung' }),
  d('z-flip7', 'Galaxy Z Flip7', 'Samsung', 'foldable', 'android', 360, 880, 3, { model: 'SM-F766B', year: 2025, browser: 'samsung' }),
  d('z-flip7-cover', 'Galaxy Z Flip7 (kapak ekranı)', 'Samsung', 'foldable', 'android', 360, 374, 3, { model: 'SM-F766B', year: 2025, browser: 'samsung' }),
  d('pixel-fold-closed', 'Pixel 10 Pro Fold (kapalı)', 'Google', 'foldable', 'android', 412, 892, 2.625, { model: 'Pixel 10 Pro Fold', year: 2025 }),
  d('pixel-fold-open', 'Pixel 10 Pro Fold (açık)', 'Google', 'foldable', 'android', 674, 841, 2.625, { model: 'Pixel 10 Pro Fold', year: 2025 }),
  d('surface-duo', 'Surface Duo', 'Microsoft', 'foldable', 'android', 540, 720, 2.5, { model: 'Surface Duo', year: 2020 }),

  /* ─── Google Pixel ────────────────────────────────────────────── */
  d('pixel-10-pro-xl', 'Pixel 10 Pro XL', 'Google', 'phone', 'android', 432, 960, 3, { model: 'Pixel 10 Pro XL', safeArea: PUNCH, year: 2025, rank: 51 }),
  d('pixel-10-pro', 'Pixel 10 Pro', 'Google', 'phone', 'android', 410, 912, 3, { model: 'Pixel 10 Pro', safeArea: PUNCH, year: 2025, rank: 50 }),
  d('pixel-10', 'Pixel 10', 'Google', 'phone', 'android', 412, 924, 2.625, { model: 'Pixel 10', safeArea: PUNCH, year: 2025, rank: 52 }),
  d('pixel-9-pro-xl', 'Pixel 9 Pro XL', 'Google', 'phone', 'android', 412, 923, 3, { model: 'Pixel 9 Pro XL', safeArea: PUNCH, year: 2024 }),
  d('pixel-9-pro', 'Pixel 9 Pro', 'Google', 'phone', 'android', 412, 892, 3.5, { model: 'Pixel 9 Pro', safeArea: PUNCH, year: 2024 }),
  d('pixel-9', 'Pixel 9', 'Google', 'phone', 'android', 412, 923, 2.625, { model: 'Pixel 9', safeArea: PUNCH, year: 2024, rank: 53 }),
  d('pixel-8-pro', 'Pixel 8 Pro', 'Google', 'phone', 'android', 448, 998, 2.625, { model: 'Pixel 8 Pro', safeArea: PUNCH, year: 2023 }),
  d('pixel-8', 'Pixel 8', 'Google', 'phone', 'android', 412, 915, 2.625, { model: 'Pixel 8', safeArea: PUNCH, year: 2023 }),
  d('pixel-7-pro', 'Pixel 7 Pro', 'Google', 'phone', 'android', 412, 892, 3.5, { model: 'Pixel 7 Pro', year: 2022 }),
  d('pixel-7', 'Pixel 7', 'Google', 'phone', 'android', 412, 915, 2.625, { model: 'Pixel 7', year: 2022, rank: 54 }),
  d('pixel-6', 'Pixel 6', 'Google', 'phone', 'android', 412, 915, 2.625, { model: 'Pixel 6', year: 2021 }),
  d('pixel-5', 'Pixel 5', 'Google', 'phone', 'android', 393, 851, 2.75, { model: 'Pixel 5', year: 2020 }),
  d('pixel-4a', 'Pixel 4a', 'Google', 'phone', 'android', 393, 851, 2.75, { model: 'Pixel 4a', year: 2020 }),
  d('pixel-4', 'Pixel 4', 'Google', 'phone', 'android', 353, 745, 2.75, { model: 'Pixel 4', year: 2019 }),
  d('pixel-tablet', 'Pixel Tablet', 'Google', 'tablet', 'android', 900, 1440, 2, { model: 'Pixel Tablet', year: 2023 }),

  /* ─── Diğer Android ───────────────────────────────────────────── */
  d('oneplus-13', 'OnePlus 13', 'OnePlus', 'phone', 'android', 384, 854, 3.5, { model: 'PJZ110', year: 2025 }),
  d('oneplus-12', 'OnePlus 12', 'OnePlus', 'phone', 'android', 360, 804, 3, { model: 'CPH2573', year: 2024 }),
  d('oneplus-nord', 'OnePlus Nord 4', 'OnePlus', 'phone', 'android', 412, 915, 2.625, { model: 'CPH2661', year: 2024 }),
  d('xiaomi-15', 'Xiaomi 15', 'Xiaomi', 'phone', 'android', 393, 873, 2.75, { model: '24129PN74G', year: 2025 }),
  d('xiaomi-14', 'Xiaomi 14', 'Xiaomi', 'phone', 'android', 393, 873, 2.75, { model: '23127PN0CG', year: 2024 }),
  d('redmi-note-14', 'Redmi Note 14', 'Xiaomi', 'phone', 'android', 393, 873, 2.75, { model: '24094RAD4G', year: 2025, rank: 60 }),
  d('poco-x6', 'POCO X6 Pro', 'Xiaomi', 'phone', 'android', 393, 873, 2.75, { model: '23113RKC6G', year: 2024 }),
  d('huawei-p60', 'Huawei P60 Pro', 'Huawei', 'phone', 'android', 360, 780, 3, { model: 'MNA-LX9', year: 2023 }),
  d('oppo-find-x8', 'OPPO Find X8', 'OPPO', 'phone', 'android', 360, 800, 3, { model: 'CPH2651', year: 2024 }),
  d('vivo-x200', 'vivo X200', 'vivo', 'phone', 'android', 360, 800, 3, { model: 'V2434', year: 2024 }),
  d('nothing-3', 'Nothing Phone (3)', 'Nothing', 'phone', 'android', 412, 915, 2.625, { model: 'A024', year: 2025 }),
  d('moto-g-power', 'Moto G Power', 'Motorola', 'phone', 'android', 412, 915, 2.625, { model: 'moto g power', year: 2024 }),
  d('lenovo-tab-p12', 'Lenovo Tab P12', 'Lenovo', 'tablet', 'android', 800, 1280, 2, { model: 'TB370FU', year: 2023 }),
  d('kindle-fire-hd', 'Fire HD 10', 'Amazon', 'tablet', 'android', 800, 1280, 1.5, { model: 'KFTRWI', year: 2023 }),
  d('nexus-7', 'Nexus 7', 'Google', 'tablet', 'android', 600, 960, 2, { model: 'Nexus 7', year: 2013 }),

  /* ─── Dizüstü / Masaüstü (Apple) ──────────────────────────────── */
  d('mbp-16', 'MacBook Pro 16"', 'Apple', 'laptop', 'macos', 1728, 1117, 2, { year: 2023, browser: 'safari', rank: 70 }),
  d('mbp-14', 'MacBook Pro 14"', 'Apple', 'laptop', 'macos', 1512, 982, 2, { year: 2023, browser: 'safari', rank: 71 }),
  d('mba-15', 'MacBook Air 15"', 'Apple', 'laptop', 'macos', 1710, 1112, 2, { year: 2024, browser: 'safari' }),
  d('mba-13', 'MacBook Air 13"', 'Apple', 'laptop', 'macos', 1470, 956, 2, { year: 2024, browser: 'safari', rank: 72 }),
  d('mbp-13', 'MacBook Pro 13"', 'Apple', 'laptop', 'macos', 1440, 900, 2, { year: 2020, browser: 'safari' }),
  d('macbook-12', 'MacBook 12"', 'Apple', 'laptop', 'macos', 1152, 720, 2, { year: 2017, browser: 'safari' }),
  d('imac-24', 'iMac 24"', 'Apple', 'desktop', 'macos', 2240, 1260, 2, { year: 2024, browser: 'safari' }),
  d('studio-display', 'Studio Display 27"', 'Apple', 'desktop', 'macos', 2560, 1440, 2, { year: 2022, browser: 'safari', rank: 73 }),
  d('pro-display-xdr', 'Pro Display XDR 32"', 'Apple', 'desktop', 'macos', 3008, 1692, 2, { year: 2019, browser: 'safari' }),

  /* ─── Dizüstü / Masaüstü (Windows) ────────────────────────────── */
  d('surface-pro-11', 'Surface Pro 11', 'Microsoft', 'laptop', 'windows', 1440, 960, 2, { year: 2024, touch: true }),
  d('surface-pro-7', 'Surface Pro 7', 'Microsoft', 'laptop', 'windows', 912, 1368, 2, { year: 2019, touch: true, rank: 80 }),
  d('surface-laptop', 'Surface Laptop', 'Microsoft', 'laptop', 'windows', 1500, 1000, 2, { year: 2023, touch: true }),
  d('surface-book', 'Surface Book', 'Microsoft', 'laptop', 'windows', 1500, 1000, 2, { year: 2017, touch: true }),
  d('laptop-hd', 'Dizüstü HD (1366×768)', 'Genel', 'laptop', 'windows', 1366, 768, 1, { rank: 81 }),
  d('laptop-hdplus', 'Dizüstü HD+ (1600×900)', 'Genel', 'laptop', 'windows', 1600, 900, 1),
  d('laptop-fhd', 'Dizüstü FHD (1920×1080)', 'Genel', 'laptop', 'windows', 1920, 1080, 1, { rank: 82 }),
  d('laptop-1440', 'Dizüstü (1440×900)', 'Genel', 'laptop', 'windows', 1440, 900, 1),
  d('laptop-1536', 'Dizüstü (1536×864)', 'Genel', 'laptop', 'windows', 1536, 864, 1, { rank: 83 }),
  d('laptop-retina', 'Dizüstü Retina (1680×1050)', 'Genel', 'laptop', 'windows', 1680, 1050, 2),

  /* ─── macOS: gerçek tarayıcı viewport'ları ────────────────────────
     macOS'ta menü çubuğu (25) + Chrome sekme ve adres çubuğu (≈87) toplam
     ~112 px yer kaplar. Aşağıdakiler tam ekran Chrome penceresinin CSS
     piksel cinsinden kullanılabilir alanıdır. */
  d('mac-air-13-browser', 'MacBook Air 13" — tarayıcı', 'Apple', 'laptop', 'macos', 1470, 844, 2,
    { screen: [1470, 956], note: '1470×956 ekran · tam ekran Chrome penceresi', browser: 'chrome', rank: 10 }),
  d('mac-pro-14-browser', 'MacBook Pro 14" — tarayıcı', 'Apple', 'laptop', 'macos', 1512, 870, 2,
    { screen: [1512, 982], note: '1512×982 ekran · tam ekran Chrome penceresi', browser: 'chrome' }),
  d('mac-pro-16-browser', 'MacBook Pro 16" — tarayıcı', 'Apple', 'laptop', 'macos', 1728, 1005, 2,
    { screen: [1728, 1117], note: '1728×1117 ekran · tam ekran Chrome penceresi', browser: 'chrome' }),

  /* ─── Windows: gerçek tarayıcı viewport'ları ──────────────────────
     Bunlar EKRAN çözünürlüğü değil, Chrome penceresinin CSS piksel
     cinsinden kullanılabilir alanıdır (ekran yüksekliği − görev çubuğu
     − tarayıcı arayüzü ≈ 160 px). Ölçüm: en yaygın masaüstü viewport'u
     1920×920 (screensize.net), en yaygın ekran 1920×1080 (StatCounter).

     Windows ölçeklemesi DPR'ı da değiştirir: %125 → 1.25, %150 → 1.5.
     Bu, `srcset` ve `image-set()` ile hangi görselin seçileceğini
     belirlediği için responsive testte önemlidir. */
  d('win-fhd', 'Windows FHD — %100', 'Windows', 'desktop', 'windows', 1920, 920, 1,
    { screen: [1920, 1080], note: '1920×1080 ekran · en yaygın masaüstü kurulumu (~%22)', rank: 1, touch: false }),
  d('win-fhd-125', 'Windows FHD — %125 ölçek', 'Windows', 'desktop', 'windows', 1536, 736, 1.25,
    { screen: [1536, 864], note: '1920×1080 ekran, %125 ölçekleme · 2. en yaygın (screen 1536×864)', rank: 2, touch: false }),
  d('win-laptop-hd', 'Windows dizüstü HD', 'Windows', 'laptop', 'windows', 1366, 608, 1,
    { screen: [1366, 768], note: '1366×768 ekran · uygun fiyatlı dizüstülerin klasiği, dar yerleşimleri kırar', rank: 3, touch: false }),
  d('win-laptop-1610', 'Windows dizüstü 16:10 — %125 ölçek', 'Windows', 'laptop', 'windows', 1536, 832, 1.25,
    { screen: [1536, 960], note: '1920×1200 ekran, %125 ölçekleme · güncel kurumsal dizüstü standardı (ThinkPad T/X, Dell Pro, EliteBook 800) · 16:10 olduğu için FHD dizüstüden ~96 px daha uzun', rank: 4, touch: false }),
  d('win-fhd-150', 'Windows FHD — %150 ölçek', 'Windows', 'desktop', 'windows', 1280, 613, 1.5,
    { screen: [1280, 720], note: '1920×1080 ekran, %150 ölçekleme · küçük dizüstü ve erişilebilirlik ayarı', touch: false }),
  d('win-hd-plus', 'Windows HD+ (1600×900)', 'Windows', 'laptop', 'windows', 1600, 740, 1,
    { screen: [1600, 900], note: '1600×900 ekran', touch: false }),
  d('win-wxga', 'Windows WXGA (1280×720)', 'Windows', 'desktop', 'windows', 1280, 560, 1,
    { screen: [1280, 720], note: '1280×720 ekran · en dar yaygın masaüstü', touch: false }),
  d('win-qhd', 'Windows QHD — %100', 'Windows', 'desktop', 'windows', 2560, 1280, 1,
    { screen: [2560, 1440], note: '2560×1440 ekran', touch: false }),
  d('win-qhd-150', 'Windows QHD — %150 ölçek', 'Windows', 'desktop', 'windows', 1707, 853, 1.5,
    { screen: [1707, 960], note: '2560×1440 ekran, %150 ölçekleme · yaygın oyuncu/ofis kurulumu', touch: false }),
  d('win-4k-150', 'Windows 4K — %150 ölçek', 'Windows', 'desktop', 'windows', 2560, 1280, 1.5,
    { screen: [2560, 1440], note: '3840×2160 ekran, %150 ölçekleme · Windows’un 4K varsayılanı', touch: false }),
  d('win-4k-200', 'Windows 4K — %200 ölçek', 'Windows', 'desktop', 'windows', 1920, 920, 2,
    { screen: [1920, 1080], note: '3840×2160 ekran, %200 ölçekleme', touch: false }),
  d('win-surface-scaled', 'Surface Pro — %200 ölçek', 'Windows', 'laptop', 'windows', 1440, 800, 2,
    { screen: [1440, 960], note: '2880×1920 ekran, %200 ölçekleme · dokunmatik', touch: true }),

  /* ─── Masaüstü monitörler ─────────────────────────────────────── */
  d('desktop-720', 'Monitör HD (1280×720)', 'Genel', 'desktop', 'windows', 1280, 720, 1),
  d('desktop-800', 'Monitör (1280×800)', 'Genel', 'desktop', 'windows', 1280, 800, 1),
  d('desktop-1080', 'Monitör FHD (1920×1080)', 'Genel', 'desktop', 'windows', 1920, 1080, 1, { rank: 90 }),
  d('desktop-1200', 'Monitör WUXGA (1920×1200)', 'Genel', 'desktop', 'windows', 1920, 1200, 1),
  d('desktop-qhd', 'Monitör QHD (2560×1440)', 'Genel', 'desktop', 'windows', 2560, 1440, 1, { rank: 91 }),
  d('desktop-4k', 'Monitör 4K (3840×2160)', 'Genel', 'desktop', 'windows', 3840, 2160, 1, { rank: 92 }),
  d('desktop-5k', 'Monitör 5K (5120×2880)', 'Genel', 'desktop', 'windows', 5120, 2880, 1),
  d('ultrawide-1080', 'Ultra Geniş (2560×1080)', 'Genel', 'desktop', 'windows', 2560, 1080, 1),
  d('ultrawide-1440', 'Ultra Geniş (3440×1440)', 'Genel', 'desktop', 'windows', 3440, 1440, 1, { rank: 93 }),
  d('superultrawide', 'Süper Geniş (5120×1440)', 'Genel', 'desktop', 'windows', 5120, 1440, 1),

  /* ─── Genel kırılım noktaları ─────────────────────────────────── */
  d('bp-320', 'Çok küçük (320px)', 'Kırılım', 'phone', 'android', 320, 640, 2, { rank: 100 }),
  d('bp-360', 'Mobil S (360px)', 'Kırılım', 'phone', 'android', 360, 640, 2, { rank: 101 }),
  d('bp-375', 'Mobil M (375px)', 'Kırılım', 'phone', 'ios', 375, 667, 2, { rank: 102 }),
  d('bp-414', 'Mobil L (414px)', 'Kırılım', 'phone', 'ios', 414, 896, 2, { rank: 103 }),
  d('bp-480', 'Phablet (480px)', 'Kırılım', 'phone', 'android', 480, 800, 2),
  d('bp-600', 'Küçük tablet (600px)', 'Kırılım', 'tablet', 'android', 600, 960, 2),
  d('bp-768', 'Tablet (768px)', 'Kırılım', 'tablet', 'ipados', 768, 1024, 2, { rank: 104 }),
  d('bp-1024', 'Tablet yatay (1024px)', 'Kırılım', 'tablet', 'ipados', 1024, 768, 2, { rank: 105 }),
  d('bp-1280', 'Masaüstü (1280px)', 'Kırılım', 'desktop', 'windows', 1280, 800, 1, { rank: 106 }),
  d('bp-1440', 'Geniş masaüstü (1440px)', 'Kırılım', 'desktop', 'windows', 1440, 900, 1),
  d('bp-1920', 'Tam HD (1920px)', 'Kırılım', 'desktop', 'windows', 1920, 1080, 1),

  /* Tailwind CSS kırılım noktaları */
  d('tw-sm', 'Tailwind sm (640px)', 'Tailwind', 'tablet', 'android', 640, 900, 1),
  d('tw-md', 'Tailwind md (768px)', 'Tailwind', 'tablet', 'android', 768, 1024, 1),
  d('tw-lg', 'Tailwind lg (1024px)', 'Tailwind', 'desktop', 'windows', 1024, 768, 1),
  d('tw-xl', 'Tailwind xl (1280px)', 'Tailwind', 'desktop', 'windows', 1280, 800, 1),
  d('tw-2xl', 'Tailwind 2xl (1536px)', 'Tailwind', 'desktop', 'windows', 1536, 900, 1),

  /* Bootstrap 5 kırılım noktaları */
  d('bs-xs', 'Bootstrap xs (<576px)', 'Bootstrap', 'phone', 'android', 575, 900, 2),
  d('bs-sm', 'Bootstrap sm (576px)', 'Bootstrap', 'phone', 'android', 576, 900, 2),
  d('bs-md', 'Bootstrap md (768px)', 'Bootstrap', 'tablet', 'android', 768, 1024, 1),
  d('bs-lg', 'Bootstrap lg (992px)', 'Bootstrap', 'tablet', 'windows', 992, 768, 1),
  d('bs-xl', 'Bootstrap xl (1200px)', 'Bootstrap', 'desktop', 'windows', 1200, 800, 1),
  d('bs-xxl', 'Bootstrap xxl (1400px)', 'Bootstrap', 'desktop', 'windows', 1400, 900, 1),

  /* Material Design 3 pencere sınıfları */
  d('md-compact', 'Material Compact (<600px)', 'Material', 'phone', 'android', 412, 915, 2.625),
  d('md-medium', 'Material Medium (600px)', 'Material', 'tablet', 'android', 700, 1000, 2),
  d('md-expanded', 'Material Expanded (840px)', 'Material', 'tablet', 'android', 900, 1000, 2),
  d('md-large', 'Material Large (1200px)', 'Material', 'desktop', 'windows', 1280, 900, 1),

  /* ─── Saat / TV / Konsol ──────────────────────────────────────── */
  d('watch-ultra', 'Apple Watch Ultra', 'Apple', 'watch', 'ios', 205, 251, 2, { year: 2024, radius: 40 }),
  d('watch-45', 'Apple Watch 45mm', 'Apple', 'watch', 'ios', 198, 242, 2, { year: 2023, radius: 40 }),
  d('watch-41', 'Apple Watch 41mm', 'Apple', 'watch', 'ios', 176, 215, 2, { year: 2023, radius: 40 }),
  d('galaxy-watch', 'Galaxy Watch 7', 'Samsung', 'watch', 'android', 200, 200, 2, { model: 'SM-L310', year: 2024, radius: 100 }),
  d('tv-720', 'TV 720p', 'Genel', 'tv', 'other', 1280, 720, 1, { touch: false }),
  d('tv-1080', 'TV 1080p', 'Genel', 'tv', 'other', 1920, 1080, 1, { touch: false }),
  d('tv-4k', 'TV 4K', 'Genel', 'tv', 'other', 3840, 2160, 1, { touch: false }),
  d('steam-deck', 'Steam Deck', 'Valve', 'console', 'linux', 1280, 800, 1, { touch: true }),
  d('switch', 'Nintendo Switch', 'Nintendo', 'console', 'other', 1280, 720, 1, { touch: true }),
  d('ps5', 'PlayStation 5 tarayıcı', 'Sony', 'console', 'other', 1920, 1080, 1, { touch: false }),
]

export const DEVICE_MAP = new Map(DEVICES.map((x) => [x.id, x]))

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  phone: 'Telefon',
  tablet: 'Tablet',
  foldable: 'Katlanabilir',
  laptop: 'Dizüstü',
  desktop: 'Masaüstü',
  watch: 'Akıllı saat',
  tv: 'TV',
  console: 'Konsol',
  custom: 'Özel',
}

export const CATEGORY_ORDER: DeviceCategory[] = [
  'phone', 'tablet', 'foldable', 'laptop', 'desktop', 'watch', 'tv', 'console', 'custom',
]

/** Hazır cihaz setleri */
export const BUILTIN_SETS = [
  /* Açılış seti: gerçek kullanım verisine göre en kritik 11 ekran.
     Dört telefon (320 / 360 / 393 / 440 — 320 taşmaları yakalar),
     iki tablet (Android 800 + iPad 820, ikisi farklı UA ve tarayıcı),
     dört Windows kurulumu (kurumsal HD ve FHD dizüstüler, 16:10 dizüstü,
     en yaygın masaüstü) ve bir Mac dizüstü.
     Kare sayısı artınca yükleme sırayla (loadStagger) yapılır; sunucuyu
     eşzamanlı 11 istekle yormamak için ayarlardan aralık artırılabilir. */
  { id: 'set-populer', name: 'Popüler', builtin: true, deviceIds: [
    // Telefon: 320 (en dar gerçek cihaz) → 360 → 393 → 440
    'iphone-se1', 'galaxy-s25', 'iphone-16', 'iphone-17-pro-max',
    // Tablet: Android 800 + iPad 820
    'galaxy-tab-s9', 'ipad-air-11',
    // Windows: kurumsal dizüstüler + en yaygın masaüstü
    'win-laptop-hd', 'win-fhd-125', 'win-laptop-1610', 'win-fhd',
    // macOS
    'mac-air-13-browser',
  ] },
  { id: 'set-windows', name: 'Windows (en yaygın)', builtin: true, deviceIds: ['win-wxga', 'win-laptop-hd', 'win-fhd-125', 'win-laptop-1610', 'win-fhd', 'win-qhd-150', 'win-4k-150'] },
  { id: 'set-mobil', name: 'Mobil', builtin: true, deviceIds: ['iphone-se3', 'iphone-13-mini', 'galaxy-s25', 'iphone-16', 'pixel-10', 'iphone-17-pro-max'] },
  { id: 'set-tablet', name: 'Tablet', builtin: true, deviceIds: ['ipad-mini-7', 'ipad-10', 'ipad-pro-11-m5', 'ipad-pro-13-m5', 'galaxy-tab-s9'] },
  { id: 'set-masaustu', name: 'Masaüstü', builtin: true, deviceIds: ['win-laptop-hd', 'win-fhd-125', 'win-fhd', 'mba-13', 'mbp-16', 'win-qhd'] },
  { id: 'set-tailwind', name: 'Tailwind kırılımları', builtin: true, deviceIds: ['bp-375', 'tw-sm', 'tw-md', 'tw-lg', 'tw-xl', 'tw-2xl'] },
  { id: 'set-bootstrap', name: 'Bootstrap kırılımları', builtin: true, deviceIds: ['bs-xs', 'bs-sm', 'bs-md', 'bs-lg', 'bs-xl', 'bs-xxl'] },
  { id: 'set-apple', name: 'Apple ekosistemi', builtin: true, deviceIds: ['iphone-17-pro', 'iphone-16e', 'ipad-air-11', 'ipad-pro-13-m5', 'mba-13', 'studio-display'] },
  { id: 'set-katlanabilir', name: 'Katlanabilir', builtin: true, deviceIds: ['z-flip7-cover', 'z-fold7-closed', 'z-fold7-open', 'pixel-fold-open'] },
  { id: 'set-uc', name: 'Uç durumlar', builtin: true, deviceIds: ['bp-320', 'watch-45', 'z-flip7-cover', 'superultrawide', 'desktop-4k'] },
]
