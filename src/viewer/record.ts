/**
 * EKRAN KAYDI — etkileşimleri WebM olarak kaydeder.
 *
 * `getDisplayMedia({ preferCurrentTab: true })` kullanılır: ek izin gerektirmez,
 * Chrome'un paylaşım seçicisinde bu sekme önceden seçili gelir. Yakalanan akış
 * `MediaRecorder` ile VP9/WebM'e kodlanır.
 *
 * GIF bilinçli olarak yok: aynı süre için WebM hem çok daha küçük hem de
 * belirgin biçimde daha kaliteli, ve her modern araç WebM'i kabul ediyor.
 */
import { actions, tools } from './store'
import { download, slug, stamp } from './capture'

let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
let stream: MediaStream | null = null

export function isRecording() { return !!recorder && recorder.state === 'recording' }

export async function startRecording(hostname: string) {
  if (isRecording()) return
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
      /* Chrome'a "bu sekmeyi öner" ipucu — tip tanımlarında yok, bu yüzden cast */
      preferCurrentTab: true,
    } as DisplayMediaStreamOptions)
  } catch {
    actions.toast('Kayıt iptal edildi', 'error')
    return
  }

  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'

  chunks = []
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
  } catch (e) {
    /* Kurucu hata verirse ekran paylaşımı açık kalıp Chrome'un "paylaşılıyor"
       göstergesi kapanmıyordu */
    cleanup()
    actions.toast(`Kayıt başlatılamadı: ${(e as Error).message}`, 'error')
    return
  }
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mime })
    download(blob, `${slug(hostname) || 'kayit'}-${stamp()}.webm`)
    actions.toast(`Kayıt indirildi (${Math.round(blob.size / 1024)} KB)`, 'ok')
    cleanup()
  }
  /* Kullanıcı Chrome'un kendi "paylaşımı durdur" düğmesine basarsa da bitir */
  stream.getVideoTracks()[0]?.addEventListener('ended', () => stopRecording())

  recorder.start(250)
  tools.setRecording(true)
  actions.toast('Kayıt başladı — durdurmak için tekrar tıklayın')
}

export function stopRecording() {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  else cleanup()
}

function cleanup() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  recorder = null
  chunks = []
  tools.setRecording(false)
}
