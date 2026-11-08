/**
 * SÜRÜKLEYEREK KAYDIRMA (touch panning)
 *
 * Gerçek bir telefonda parmağını sürüklediğinde sayfa kayar. Masaüstünde ise
 * fareyle sürüklemek metin seçer. Parmak modunun en temel davranışı bu olduğu
 * için burada taklit ediliyor:
 *   • basılı tutup sürükleme → en yakın kaydırılabilir kapsayıcıyı kaydırır
 *   • sürükleme sırasında metin seçimi engellenir
 *   • bırakınca ivme (momentum) ile kayış sürer
 *   • kısa dokunuşlar tıklama olarak geçer; sürüklemeden sonraki tıklama
 *     yutulur (telefonda kaydırırken bağlantıya basılmış sayılmaz)
 *   • görsel ve bağlantılar tarayıcının yerel sürükle-bırak'ını başlatmaz —
 *     yoksa Chrome `pointercancel` gönderip kaydırmayı keser ve nesne imlece
 *     yapışır. Sitenin kendi `draggable="true"` öğelerine dokunulmaz.
 */

const TIKLAMA_ESIGI = 8       // px — bunun altındaki hareket dokunuş sayılır
const SURTUNME = 0.94         // ivme sönümü
const MIN_HIZ = 0.35          // px/kare — bunun altında ivme durur

interface Durum {
  hedef: Element | Window
  sonX: number
  sonY: number
  hareket: number
  vx: number
  vy: number
  sonZaman: number
}

let durum: Durum | null = null
let tiklamaYut = false
let ivmeId = 0
let kurulu = false
let etkin = true

/** Form elemanlarında sürükleme kaydırmaya dönüşmemeli. */
const FORM = /^(INPUT|TEXTAREA|SELECT|OPTION|BUTTON|VIDEO|AUDIO)$/

function kaydirilabilirMi(el: Element): boolean {
  const cs = getComputedStyle(el)
  const dikey = /(auto|scroll|overlay)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1
  const yatay = /(auto|scroll|overlay)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1
  return dikey || yatay
}

/** Hedeften yukarı çıkarak kaydırılabilir ilk kapsayıcıyı bulur. */
function kaydirmaHedefi(baslangic: Element | null): Element | Window {
  let el: Element | null = baslangic
  let derinlik = 0
  while (el && derinlik++ < 40) {
    if (el !== document.body && el !== document.documentElement && kaydirilabilirMi(el)) return el
    el = el.parentElement
  }
  return window
}

function kaydir(hedef: Element | Window, dx: number, dy: number) {
  if (hedef === window) window.scrollBy(dx, dy)
  else {
    const e = hedef as Element
    e.scrollTop += dy
    e.scrollLeft += dx
  }
}

function secimStili(kapat: boolean) {
  const id = '__rs_nosel__'
  document.getElementById(id)?.remove()
  if (!kapat) return
  const st = document.createElement('style')
  st.id = id
  st.textContent = 'html, html * { user-select: none !important; -webkit-user-select: none !important }'
  document.documentElement.appendChild(st)
}

/** Görsel/bağlantıların yerel sürüklenmesini kapatır (CSS katmanı). */
function surukleStili(kapat: boolean) {
  const id = '__rs_nodrag__'
  document.getElementById(id)?.remove()
  if (!kapat) return
  const st = document.createElement('style')
  st.id = id
  st.textContent = 'img:not([draggable="true"]), a:not([draggable="true"]), area, svg image'
    + ' { -webkit-user-drag: none !important }'
  ;(document.head ?? document.documentElement).appendChild(st)
}

/** Yerel sürükleme yine başlarsa (CSS'i ezen site) iptal et (olay katmanı). */
function onDragStart(e: DragEvent) {
  if (!etkin || !e.isTrusted) return
  const t = e.target as Element | null
  if (t instanceof Element && t.closest('[draggable="true"]')) return
  e.preventDefault()
}

function onDown(e: PointerEvent) {
  if (!etkin || e.pointerType !== 'mouse' || e.button !== 0 || !e.isTrusted) return
  cancelAnimationFrame(ivmeId)
  const hedefEl = e.target as Element | null
  if (hedefEl && FORM.test(hedefEl.tagName)) return
  if (hedefEl?.closest?.('[contenteditable=""],[contenteditable="true"],[draggable="true"]')) return

  durum = {
    hedef: kaydirmaHedefi(hedefEl),
    sonX: e.clientX,
    sonY: e.clientY,
    hareket: 0,
    vx: 0,
    vy: 0,
    sonZaman: performance.now(),
  }
}

function onMove(e: PointerEvent) {
  if (!durum || !e.isTrusted) return
  const dx = e.clientX - durum.sonX
  const dy = e.clientY - durum.sonY
  durum.hareket += Math.abs(dx) + Math.abs(dy)
  if (durum.hareket < 2) return

  /* Parmak yukarı giderse içerik yukarı kayar → scrollTop artar */
  kaydir(durum.hedef, -dx, -dy)

  const simdi = performance.now()
  const gecen = Math.max(1, simdi - durum.sonZaman)
  durum.vx = (-dx / gecen) * 16
  durum.vy = (-dy / gecen) * 16
  durum.sonX = e.clientX
  durum.sonY = e.clientY
  durum.sonZaman = simdi

  if (durum.hareket > TIKLAMA_ESIGI) {
    secimStili(true)
    const sel = window.getSelection?.()
    if (sel && !sel.isCollapsed) sel.removeAllRanges()
  }
}

function onUp() {
  if (!durum) return
  const d = durum
  durum = null
  secimStili(false)
  if (d.hareket <= TIKLAMA_ESIGI) return

  /* Sürüklemeden sonraki tıklama yutulur — kaydırırken bağlantı açılmasın */
  tiklamaYut = true
  setTimeout(() => { tiklamaYut = false }, 350)

  /* İvme */
  let vx = d.vx
  let vy = d.vy
  const adim = () => {
    if (Math.abs(vx) < MIN_HIZ && Math.abs(vy) < MIN_HIZ) return
    kaydir(d.hedef, vx, vy)
    vx *= SURTUNME
    vy *= SURTUNME
    ivmeId = requestAnimationFrame(adim)
  }
  if (Math.abs(vx) > MIN_HIZ || Math.abs(vy) > MIN_HIZ) ivmeId = requestAnimationFrame(adim)
}

function onClick(e: MouseEvent) {
  if (!tiklamaYut || !e.isTrusted) return
  e.preventDefault()
  e.stopImmediatePropagation()
}

export function installTouchScroll() {
  if (kurulu) return
  kurulu = true
  if (document.documentElement) surukleStili(true)
  else document.addEventListener('DOMContentLoaded', () => { if (kurulu) surukleStili(true) }, { once: true })
  window.addEventListener('dragstart', onDragStart, true)
  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onUp, true)
  window.addEventListener('click', onClick, true)
}

export function removeTouchScroll() {
  if (!kurulu) return
  kurulu = false
  cancelAnimationFrame(ivmeId)
  durum = null
  tiklamaYut = false
  secimStili(false)
  surukleStili(false)
  window.removeEventListener('dragstart', onDragStart, true)
  window.removeEventListener('pointerdown', onDown, true)
  window.removeEventListener('pointermove', onMove, true)
  window.removeEventListener('pointerup', onUp, true)
  window.removeEventListener('pointercancel', onUp, true)
  window.removeEventListener('click', onClick, true)
}

/**
 * Denetçi ve cetvel araçları da sürüklemeyi kullanıyor; onlar açıkken
 * kaydırma devre dışı bırakılır.
 */
export function setTouchScrollEnabled(v: boolean) {
  etkin = v
  if (!v) {
    cancelAnimationFrame(ivmeId)
    durum = null
    secimStili(false)
  }
}
