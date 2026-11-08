/**
 * EKRAN GÖRÜNTÜSÜ MOTORU
 *
 * Chrome eklentilerinde bir iframe'in içeriğini doğrudan piksel olarak okumanın
 * yolu yok; `chrome.tabs.captureVisibleTab` yalnızca **görünür** alanı verir.
 * Bu yüzden tam sayfa görüntü için: çerçeve yüksekliği içerik boyuna çıkarılır,
 * tuval dilim dilim kaydırılıp her dilim yakalanır ve tek bir canvas'ta birleştirilir.
 *
 * Yakalanan piksel yoğunluğu ekranın DPR'ı × ekran ölçeğidir; kalite için ölçek
 * geçici olarak mümkün olan en yükseğe çıkarılır.
 */
import type { Frame } from '@/lib/types'
import { actions, deviceById, frameSize, getState, setState, tools } from './store'
import { bg, sendTo } from './bus'

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
/* Sekme arka plandayken requestAnimationFrame hiç tetiklenmez — süre sınırı şart */
const raf = () => Promise.race([
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  wait(400),
])

/** Kullanıcının müdahalesi gerektiren, toplu çekimi de durduran hata. */
class CaptureAbort extends Error {}

/** Aynı anda tek çekim — iki çekim tuvalin kaydırmasını paylaşınca bozuk görüntü çıkıyor. */
let running = false

/** Tarayıcının güvenle oluşturabildiği en uzun tuval kenarı (piksel). */
const MAX_CANVAS = 16384
/** Kırpılan sayfalar — çekim bitince bildirilir (çekim sırasında bildirimler gizli). */
let clipped: string[] = []
function reportClipped() {
  if (clipped.length) actions.toast(`Sayfa çok uzun, kırpıldı: ${clipped.join(', ')}`, 'info')
  clipped = []
}

/** captureVisibleTab saniyede ~2 çağrıyla sınırlı — aralara nefes payı koy. */
const CAPTURE_GAP = 260

async function grab(): Promise<HTMLImageElement> {
  for (let tries = 0; tries < 4; tries++) {
    const r = await bg<{ ok: boolean; dataUrl?: string; error?: string }>({ t: 'captureVisible', format: 'png' })
    if (r?.ok && r.dataUrl) {
      const img = new Image()
      img.src = r.dataUrl
      await img.decode()
      return img
    }
    if (r?.error?.includes('önde değil') || document.hidden) {
      throw new CaptureAbort('Görüntü alınırken stüdyo sekmesinden ayrıldınız — çekim durduruldu')
    }
    await wait(350)
  }
  throw new Error('Ekran yakalanamadı (Chrome hız sınırı)')
}

function boxOf(fid: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-fid="${fid}"] .frame-box`)
}

function canvasEl(): HTMLElement {
  return document.querySelector<HTMLElement>('.canvas')!
}

export interface CaptureOptions {
  fullPage: boolean
  /** Cihaz çerçevesi ve etiketler dahil edilsin mi */
  withLabel: boolean
}

/**
 * Tek bir ekranı yakalar ve canvas döndürür.
 * `fullPage` ise sayfanın tamamı dilimlenerek birleştirilir.
 */
export async function captureFrame(fid: string, opt: CaptureOptions): Promise<HTMLCanvasElement> {
  if (running) throw new Error('Başka bir ekran görüntüsü alınıyor — bitmesini bekleyin')
  running = true
  document.body.classList.add('capturing')
  clipped = []
  try { return await captureOne(fid, opt) } finally {
    running = false
    document.body.classList.remove('capturing')
    tools.setCapture(null)
    reportClipped()
  }
}

async function captureOne(fid: string, opt: CaptureOptions): Promise<HTMLCanvasElement> {
  const state = getState()
  const frame = state.frames.find((f) => f.fid === fid)
  if (!frame) throw new Error('Ekran bulunamadı')

  const info = state.frameInfo[fid]
  const originalForceH = frame.forceH ?? null
  const originalZoom = frame.zoom ?? null
  /* Çok uzun sayfalar tarayıcının tuval sınırını aşar ve sonunda hiç görüntü
     çıkmaz — en uzun kenarı sınırla ve kullanıcıya söyle. */
  const maxH = Math.floor(MAX_CANVAS / (window.devicePixelRatio || 1)) - 80
  const wantH = opt.fullPage ? Math.max(info?.scrollHeight ?? 0, frameSize(frame).h) : null
  const contentH = wantH ? Math.min(wantH, maxH) : null
  if (wantH && contentH && wantH > contentH) {
    clipped.push(`${deviceById(state.settings, frame.deviceId)?.name ?? frame.deviceId} (ilk ${contentH}/${wantH} px)`)
  }

  try {
    /* Geçici vurguları temizle — denetçi kutusu görüntüye karışmasın */
    sendTo(fid, { t: 'highlight', path: null })

    /* KALİTE: yakalanan çözünürlük, ekrandaki ölçek × ekranın DPR'ıdır.
       Ekranlar küçültülmüş görüntülendiği için yakalamadan önce bu çerçeveyi
       1:1 ölçeğe çekiyoruz; retina ekranda bu, cihaz pikseline yakın çıktı verir.
       Çerçeve pencereden geniş kalırsa aşağıdaki döngü yatayda da dilimler. */
    actions.updateFrame(fid, { zoom: 1 })

    if (contentH) {
      sendTo(fid, { t: 'setHeight', height: contentH })
      sendTo(fid, { t: 'scrollTo', y: 0 })
      actions.updateFrame(fid, { forceH: contentH })
      await wait(520) // tembel görseller ve yeniden yerleşim
    }
    await raf()

    const box = boxOf(fid)
    if (!box) throw new Error('Ekran görünür değil')

    const dpr = window.devicePixelRatio || 1
    const cv = canvasEl()
    const cvRect0 = cv.getBoundingClientRect()
    const savedScroll = { top: cv.scrollTop, left: cv.scrollLeft }

    const box0 = box.getBoundingClientRect()
    const boxW = box0.width
    const boxH = box0.height
    const boxTopInCanvas = box0.top - cvRect0.top + cv.scrollTop
    const boxLeftInCanvas = box0.left - cvRect0.left + cv.scrollLeft

    const out = document.createElement('canvas')
    out.width = Math.round(boxW * dpr)
    out.height = Math.round(boxH * dpr)
    const ctx = out.getContext('2d')!

    /* Görünür alandan biraz pay bırak — kenar yuvarlamalarında boşluk kalmasın */
    const stepY = Math.max(80, cvRect0.height - 24)
    const stepX = Math.max(80, cvRect0.width - 24)
    const cols = Math.ceil(boxW / stepX)
    const rows = Math.ceil(boxH / stepY)
    const total = cols * rows
    let done = 0

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cv.scrollTop = boxTopInCanvas + r * stepY
        cv.scrollLeft = Math.max(0, boxLeftInCanvas + c * stepX - (c === 0 ? 8 : 0))
        await raf()

        const cvr = cv.getBoundingClientRect()
        const b = box.getBoundingClientRect()
        const visTop = Math.max(b.top, cvr.top)
        const visBottom = Math.min(b.bottom, cvr.bottom)
        const visLeft = Math.max(b.left, cvr.left)
        const visRight = Math.min(b.right, cvr.right)
        const hh = visBottom - visTop
        const ww = visRight - visLeft
        if (hh <= 1 || ww <= 1) { done++; continue }

        tools.setCapture({ busy: true, label: `Yakalanıyor… %${Math.round((done / total) * 100)}` })
        const img = await grab()

        ctx.drawImage(
          img,
          Math.round(visLeft * dpr), Math.round(visTop * dpr),
          Math.round(ww * dpr), Math.round(hh * dpr),
          Math.round((visLeft - b.left) * dpr), Math.round((visTop - b.top) * dpr),
          Math.round(ww * dpr), Math.round(hh * dpr),
        )
        done++
        if (done < total) await wait(CAPTURE_GAP)
      }
    }

    cv.scrollTop = savedScroll.top
    cv.scrollLeft = savedScroll.left
    return opt.withLabel ? withCaption(out, frame, dpr) : out
  } finally {
    if (contentH) sendTo(fid, { t: 'setHeight', height: null })
    actions.updateFrame(fid, { forceH: originalForceH, zoom: originalZoom })
  }
}

/** Görüntünün üstüne cihaz adı ve ölçü şeridi ekler. */
function withCaption(src: HTMLCanvasElement, frame: Frame, dpr: number): HTMLCanvasElement {
  const s = getState()
  const dev = deviceById(s.settings, frame.deviceId)
  const { w } = frameSize(frame)
  const h = frame.landscape ? frame.width : frame.height
  const bar = Math.round(30 * dpr)
  const pad = Math.round(10 * dpr)

  const out = document.createElement('canvas')
  out.width = src.width + pad * 2
  out.height = src.height + bar + pad * 2
  const c = out.getContext('2d')!
  c.fillStyle = '#0e1219'
  c.fillRect(0, 0, out.width, out.height)

  c.fillStyle = '#e6eaf2'
  c.font = `600 ${Math.round(13 * dpr)}px -apple-system, "Segoe UI", Roboto, sans-serif`
  c.textBaseline = 'middle'
  c.fillText(dev?.name ?? frame.deviceId, pad, pad + bar / 2)

  const label = `${w} × ${h}${frame.dpr !== 1 ? `  @${frame.dpr}x` : ''}`
  c.fillStyle = '#97a1b4'
  c.font = `${Math.round(12 * dpr)}px ui-monospace, Menlo, monospace`
  c.textAlign = 'right'
  c.fillText(label, out.width - pad, pad + bar / 2)
  c.textAlign = 'left'

  c.drawImage(src, pad, bar + pad)
  return out
}

/** Görünen tüm ekranları sırayla yakalar. */
export async function captureAll(opt: CaptureOptions): Promise<{ frame: Frame; canvas: HTMLCanvasElement }[]> {
  if (running) throw new Error('Başka bir ekran görüntüsü alınıyor — bitmesini bekleyin')
  running = true
  document.body.classList.add('capturing')
  const frames = getState().frames.filter((f) => !f.hidden)
  const out: { frame: Frame; canvas: HTMLCanvasElement }[] = []
  const failed: string[] = []
  clipped = []
  try {
    for (let i = 0; i < frames.length; i++) {
      tools.setCapture({ busy: true, label: `Ekran ${i + 1}/${frames.length} yakalanıyor…` })
      try {
        out.push({ frame: frames[i], canvas: await captureOne(frames[i].fid, opt) })
      } catch (e) {
        /* Sekmeden ayrılma gibi durumlarda yarım ZIP'i "başarılı" diye indirme */
        if (e instanceof CaptureAbort) throw e
        failed.push(deviceById(getState().settings, frames[i].deviceId)?.name ?? frames[i].deviceId)
      }
      await wait(CAPTURE_GAP)
    }
  } finally {
    running = false
    document.body.classList.remove('capturing')
    tools.setCapture(null)
  }
  if (failed.length) actions.toast(`Yakalanamayan ekranlar: ${failed.join(', ')}`, 'error')
  else reportClipped()
  return out
}

/** Tüm ekranları etiketli tek bir görselde yan yana dizer (kontakt föy). */
export async function contactSheet(opt: CaptureOptions): Promise<HTMLCanvasElement> {
  const shots = await captureAll({ ...opt, withLabel: true })
  if (!shots.length) throw new Error('Yakalanacak ekran yok')
  const dpr = window.devicePixelRatio || 1
  const gap = Math.round(16 * dpr)
  const maxRowW = Math.round(3600 * dpr)

  /* Basit satır sarmalı yerleşim */
  const rows: { items: typeof shots; w: number; h: number }[] = []
  let cur: typeof shots = []
  let curW = 0
  for (const sh of shots) {
    if (cur.length && curW + sh.canvas.width + gap > maxRowW) {
      rows.push({ items: cur, w: curW, h: Math.max(...cur.map((x) => x.canvas.height)) })
      cur = []; curW = 0
    }
    cur.push(sh)
    curW += sh.canvas.width + gap
  }
  if (cur.length) rows.push({ items: cur, w: curW, h: Math.max(...cur.map((x) => x.canvas.height)) })

  const totalW = Math.max(...rows.map((r) => r.w)) + gap
  const totalH = rows.reduce((a, r) => a + r.h + gap, 0) + gap
  const out = document.createElement('canvas')
  out.width = totalW
  out.height = totalH
  const c = out.getContext('2d')!
  c.fillStyle = '#0b0e14'
  c.fillRect(0, 0, totalW, totalH)

  let y = gap
  for (const row of rows) {
    let x = gap
    for (const it of row.items) {
      c.drawImage(it.canvas, x, y)
      x += it.canvas.width + gap
    }
    y += row.h + gap
  }
  return out
}

/* ═══ Dışa aktarma ═══════════════════════════════════════════════════ */

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('Görsel oluşturulamadı'))), type, quality))
}

export function download(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 8000)
}

export async function copyToClipboard(c: HTMLCanvasElement) {
  const blob = await canvasToBlob(c, 'image/png')
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export function slug(s: string) {
  return s.toLocaleLowerCase('tr')
    .replace(/[ğ]/g, 'g').replace(/[ü]/g, 'u').replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i').replace(/[ö]/g, 'o').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

export function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/* ─── Bağımlılıksız ZIP (yalnızca STORE yöntemi) ────────────────────── */

function crc32(buf: Uint8Array): number {
  let c: number
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

/** PNG'ler zaten sıkıştırılmış olduğu için sıkıştırmasız (store) ZIP yeterli. */
export async function makeZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const enc = new TextEncoder()
  const locals: BlobPart[] = []
  const central: BlobPart[] = []
  let offset = 0

  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer())
    const name = enc.encode(f.name)
    const crc = crc32(data)

    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true)
    lh.setUint16(4, 20, true)
    lh.setUint16(6, 0, true)
    lh.setUint16(8, 0, true)   // store
    lh.setUint16(10, 0, true)  // zaman
    lh.setUint16(12, 0, true)  // tarih
    lh.setUint32(14, crc, true)
    lh.setUint32(18, data.length, true)
    lh.setUint32(22, data.length, true)
    lh.setUint16(26, name.length, true)
    lh.setUint16(28, 0, true)
    locals.push(lh.buffer, name, data)

    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true)
    ch.setUint16(4, 20, true)
    ch.setUint16(6, 20, true)
    ch.setUint16(10, 0, true)
    ch.setUint32(16, crc, true)
    ch.setUint32(20, data.length, true)
    ch.setUint32(24, data.length, true)
    ch.setUint16(28, name.length, true)
    ch.setUint32(42, offset, true)
    central.push(ch.buffer, name)

    offset += 30 + name.length + data.length
  }

  const centralBlob = new Blob(central)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralBlob.size, true)
  end.setUint32(16, offset, true)
  return new Blob([...locals, centralBlob, end.buffer], { type: 'application/zip' })
}

/** Tarayıcının EyeDropper API'siyle ekrandan renk seçer. */
export async function pickColor(): Promise<string | null> {
  const ED = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper
  if (!ED) { actions.toast('Bu Chrome sürümü renk seçiciyi desteklemiyor', 'error'); return null }
  try {
    const { sRGBHex } = await new ED().open()
    await navigator.clipboard.writeText(sRGBHex)
    actions.toast(`${sRGBHex} panoya kopyalandı`, 'ok')
    return sRGBHex
  } catch { return null } // kullanıcı vazgeçti
}

export { setState }
