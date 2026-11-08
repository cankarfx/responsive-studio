import { Session, sleep, karelerHazirTab, karelerHazir } from './cdp.mjs'
const EXT='ocnniomdddfffmfbpocmhdjbdmpnkhjn'
const ok=(b)=>b?'✓':'✗'; let hepsi=true
const k=(ad,c,ek='')=>{hepsi&&=!!c;console.log(` ${ok(c)} ${ad}${ek?' — '+ek:''}`)}

for (const t of await (await fetch('http://127.0.0.1:9222/json/list')).json())
  if (t.url.includes('viewer.html')) await fetch(`http://127.0.0.1:9222/json/close/${t.id}`)
let tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html`)}`,{method:'PUT'})).json()
let p = new Session(tab.webSocketDebuggerUrl); await p.connect(); await p.send('Runtime.enable')
/* Sayfa yüklenip chrome.* hazır olana kadar bekle — yoksa yarış oluyor */
for (let i = 0; i < 40; i++) {
  if (await p.eval(`typeof chrome !== 'undefined' && !!chrome.storage`).catch(() => false)) break
  await sleep(250)
}
await p.eval(`chrome.storage.local.set({ rs_state_v1: {
  frames: [{ fid:'m1', deviceId:'iphone-16', width:393, height:852, dpr:3, landscape:false, browser:'safari', zoom:1, hidden:false, colorScheme:'auto' }],
  layout:'grid', zoom:1, gap:24, workspaces:[], panel:null,
  sync:{ scroll:false, scrollMode:'ratio', click:false, input:false, hover:false, navigation:true, soloFid:null },
  settings:{ theme:'dark', proMode:false, httpUserAgent:null, autoReload:0, customDevices:[], deviceSets:[],
    lastWorkspaceId:null, favorites:[], defaultBrowser:'chrome', frameBusting:true, customHeaders:[],
    injectCss:'', injectJs:'', startupSet:'set-populer', loadStagger:0, touchMode:true } }})`)
p.close(); await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`)
tab = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(`chrome-extension://${EXT}/viewer.html?url=${encodeURIComponent('http://localhost:8899/kaydir.html')}`)}`,{method:'PUT'})).json()
await sleep(1200); await karelerHazirTab(tab); await sleep(1500)
p = new Session(tab.webSocketDebuggerUrl); await p.connect(); await p.send('Runtime.enable')

const b = new Session((await (await fetch('http://127.0.0.1:9222/json/version')).json()).webSocketDebuggerUrl)
await b.connect()
const { targetInfos } = await b.send('Target.getTargets')
const it = targetInfos.filter(t=>t.type==='iframe' && t.url.includes('kaydir.html'))[0]
const { sessionId } = await b.send('Target.attachToTarget',{targetId:it.targetId,flatten:true})
const fsend=(m,pp={})=>new Promise((res,rej)=>{const id=++b.id;b.pending.set(id,{res,rej});b.ws.send(JSON.stringify({id,method:m,params:pp,sessionId}))})
await fsend('Runtime.enable')
const fEval = async (e) => (await fsend('Runtime.evaluate',{returnByValue:true,expression:e})).result.value

/** Çerçeve içindeki bir elemanın viewer koordinatını hesaplar (ölçek 1). */
async function elemanKoordu(secici) {
  const r = await fEval(`(()=>{const e=document.querySelector(${JSON.stringify(secici)});
    if(!e) return null; const b=e.getBoundingClientRect(); return {x:b.x+b.width/2, y:b.y+b.height/2}})()`)
  if (!r) return null
  const kutu = await p.eval(`(()=>{const f=document.querySelector('[data-fid="m1"] .frame-box'); const b=f.getBoundingClientRect();
    return {x:b.x, y:b.y}})()`)
  return { x: Math.round(kutu.x + r.x), y: Math.round(kutu.y + r.y) }
}
async function surukle(x, y, dy, adim = 10) {
  await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y})
  await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1})
  for (let i=1;i<=adim;i++) {
    await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:Math.round(y+(dy*i)/adim),button:'left',buttons:1})
    await sleep(25)
  }
  await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y:Math.round(y+dy),button:'left'})
  await sleep(900)
}

console.log('── SAYFA KAYDIRMA + İVME + SEÇİM ──')
const govde = await elemanKoordu('.satir')
await surukle(govde.x, govde.y, -200, 10)
const d1 = await fEval(`({ y: Math.round(scrollY), secim: (getSelection()+'').length })`)
console.log('   scrollY:', d1.y, '| seçilen karakter:', d1.secim)
k('sürükleme sayfayı kaydırdı', d1.y > 100, `${d1.y}px`)
k('ivme ile fazladan kaydı', d1.y > 200, `${d1.y}px (sürükleme 200px)`)
k('metin seçilmedi', d1.secim === 0, `${d1.secim} karakter`)
await fEval(`scrollTo(0,0)`); await sleep(600)

console.log('\n── İÇ KAPSAYICI KAYDIRMASI ──')
const icK = await elemanKoordu('#icKaydir')
console.log('   iç kapsayıcı koordu:', JSON.stringify(icK))
await surukle(icK.x, icK.y, -70, 8)
const icDurum = await fEval(`({ ic: Math.round(document.getElementById('icKaydir').scrollTop), sayfa: Math.round(scrollY) })`)
console.log('   sonuç:', JSON.stringify(icDurum))
k('iç kapsayıcı kaydı', icDurum.ic > 20, `${icDurum.ic}px`)
k('sayfa kaymadı (kaydırma iç kapsayıcıda kaldı)', icDurum.sayfa < 20, `${icDurum.sayfa}px`)

console.log('\n── KISA DOKUNUŞ ──')
await fEval(`scrollTo(0,0)`); await sleep(500)
const lnk = await elemanKoordu('#lnk')
console.log('   bağlantı koordu:', JSON.stringify(lnk))
await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:lnk.x,y:lnk.y})
await sleep(200)
for (const type of ['mousePressed','mouseReleased'])
  await p.send('Input.dispatchMouseEvent',{type,x:lnk.x,y:lnk.y,button:'left',clickCount:1})
await sleep(900)
const t = await fEval(`document.getElementById('durum').textContent`)
console.log('   sonuç:', t)
k('kısa dokunuş tıklama olarak geçti', !t.includes('yok'), t)

console.log('\n── SÜRÜKLEME SONRASI TIKLAMA YUTULUYOR MU ──')
await fEval(`scrollTo(0,0); document.getElementById('durum').textContent='tıklama: yok'`); await sleep(400)
await surukle(lnk.x, lnk.y, -150, 8)
const t2 = await fEval(`document.getElementById('durum').textContent`)
console.log('   sonuç:', t2, '| scrollY:', await fEval('Math.round(scrollY)'))
k('kaydırırken bağlantı açılmadı', t2.includes('yok'), t2)
b.close(); p.close()
console.log(`\n${hepsi?'✅ GEÇTİ':'❌ BAŞARISIZ'}`); process.exit(0)
