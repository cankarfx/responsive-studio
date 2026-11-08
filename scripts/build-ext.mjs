// Service worker + content script'leri esbuild ile paketler, statik dosyaları kopyalar.
import { build, context } from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'dist')
const watch = process.argv.includes('--watch')

const common = {
  bundle: true,
  target: 'chrome120',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  alias: { '@': resolve(ROOT, 'src') },
}

const targets = [
  // MV3 service worker → "type": "module" olduğu için ESM
  { entryPoints: [resolve(ROOT, 'src/background/service-worker.ts')], outfile: resolve(OUT, 'service-worker.js'), format: 'esm' },
  // Content script'ler modül olamaz → IIFE
  { entryPoints: [resolve(ROOT, 'src/content/bridge.ts')], outfile: resolve(OUT, 'content-bridge.js'), format: 'iife' },
  { entryPoints: [resolve(ROOT, 'src/content/emulation.ts')], outfile: resolve(OUT, 'content-emulation.js'), format: 'iife' },
]

function copyStatic() {
  mkdirSync(OUT, { recursive: true })
  cpSync(resolve(ROOT, 'public'), OUT, { recursive: true })
  /* axe-core yalnızca kullanıcı erişilebilirlik denetimi başlattığında
     dinamik import ile yüklenir; bu yüzden ayrı bir dosya olarak kopyalanıyor. */
  cpSync(resolve(ROOT, 'node_modules/axe-core/axe.min.js'), resolve(OUT, 'axe.min.js'))
  /* axe-core MPL-2.0 lisanslı — dağıtılan pakette lisans metni bulunmalı. */
  mkdirSync(resolve(OUT, 'licenses'), { recursive: true })
  cpSync(resolve(ROOT, 'node_modules/axe-core/LICENSE'), resolve(OUT, 'licenses/axe-core-LICENSE.txt'))
  cpSync(resolve(ROOT, 'node_modules/axe-core/LICENSE-3RD-PARTY.txt'), resolve(OUT, 'licenses/axe-core-LICENSE-3RD-PARTY.txt'))
  cpSync(resolve(ROOT, 'node_modules/preact/LICENSE'), resolve(OUT, 'licenses/preact-LICENSE.txt'))
}

if (process.argv.includes('--clean')) rmSync(OUT, { recursive: true, force: true })
copyStatic()

for (const t of targets) {
  const cfg = { ...common, ...t }
  if (watch) {
    const ctx = await context(cfg)
    await ctx.watch()
  } else {
    await build(cfg)
  }
}
console.log(watch ? '✓ izleme modu aktif' : '✓ eklenti dosyaları paketlendi')
