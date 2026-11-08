/* Minimal CDP istemcisi — Node 24 yerleşik WebSocket kullanır. */
export async function targets(port = 9222) {
  const r = await fetch(`http://127.0.0.1:${port}/json/list`)
  return r.json()
}
export async function newTab(url, port = 9222) {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  return r.json()
}
export class Session {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.events = [] }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.wsUrl)
      this.ws.onopen = () => res()
      this.ws.onerror = (e) => rej(e)
      this.ws.onmessage = (m) => {
        const d = JSON.parse(m.data)
        if (d.id && this.pending.has(d.id)) {
          const { res, rej } = this.pending.get(d.id); this.pending.delete(d.id)
          d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result)
        } else if (d.method) this.events.push(d)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout ' + method)) } }, 30000)
    })
  }
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval hatası')
    return r.result.value
  }
  close() { try { this.ws.close() } catch {} }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Tüm karelerin içeriği yüklenene kadar bekler.
 *
 * Sabit `sleep` yerine bunu kullanın: açılış seti büyüdükçe (11 kare, aralıklı
 * yükleme) sabit süreler kırılgan hâle geliyor. Viewer her kareye `data-ready`
 * yazıyor (FrameView.tsx), `ready` mesajı geldiğinde 1 oluyor.
 *
 * @returns hazır kare sayısı (zaman aşımında da döner, patlamaz)
 */
export async function karelerHazir(p, zamanAsimi = 30000) {
  const bas = Date.now()
  let son = { toplam: 0, hazir: 0 }
  while (Date.now() - bas < zamanAsimi) {
    son = await p.eval(`({ toplam: document.querySelectorAll('.frame').length,
      hazir: document.querySelectorAll('.frame[data-ready="1"]').length })`).catch(() => son)
    if (son.toplam > 0 && son.hazir === son.toplam) { await sleep(400); return son.hazir }
    await sleep(300)
  }
  console.log(`   ⚠︎ kare bekleme zaman aşımı: ${son.hazir}/${son.toplam}`)
  return son.hazir
}

/** karelerHazir'ın kendi oturumunu açan hâli — `p` daha kurulmadan kullanmak için. */
export async function karelerHazirTab(tab, zamanAsimi = 30000) {
  const s = new Session(tab.webSocketDebuggerUrl)
  await s.connect(); await s.send('Runtime.enable')
  const n = await karelerHazir(s, zamanAsimi)
  s.close(); return n
}
