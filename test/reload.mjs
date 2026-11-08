import { Session, sleep } from './cdp.mjs'
const v = await (await fetch('http://127.0.0.1:9222/json/version')).json()
const s = new Session(v.webSocketDebuggerUrl); await s.connect()
try { await s.send('Extensions.uninstall', { id: 'ocnniomdddfffmfbpocmhdjbdmpnkhjn' }) } catch (e) { console.log('kaldirma:', e.message.slice(0,80)) }
await sleep(400)
const r = await s.send('Extensions.loadUnpacked', { path: new URL('../dist', import.meta.url).pathname })
console.log('yeniden yuklendi:', JSON.stringify(r))
s.close()
