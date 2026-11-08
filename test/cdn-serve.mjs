import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
createServer((req,res)=>{
  try {
    const body = readFileSync(new URL('./fixtures/cdn' + req.url.split('?')[0], import.meta.url))
    res.writeHead(200,{'content-type':'text/css; charset=utf-8','access-control-allow-origin':'*'})
    res.end(body)
  } catch { res.writeHead(404); res.end('yok') }
}).listen(8898, ()=>console.log('cdn 8898'))
