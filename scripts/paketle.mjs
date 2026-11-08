/**
 * SÜRÜM PAKETİ — GitHub Releases'a yüklenecek ZIP'i üretir.
 *
 *   npm run paket   →  release/responsive-studio-v<sürüm>.zip
 *
 * ZIP açıldığında tek bir `responsive-studio/` klasörü çıkar (içinde manifest.json);
 * kullanıcı Chrome'da doğrudan bu klasörü "Paketlenmemiş öğe yükle" ile seçer.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const OUT = resolve(ROOT, 'release')

const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
if (manifest.version !== pkg.version) {
  console.error(`Sürüm uyuşmuyor: manifest ${manifest.version} ≠ package.json ${pkg.version}`)
  process.exit(1)
}

const name = `responsive-studio-v${manifest.version}.zip`
const stage = resolve(OUT, 'responsive-studio')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
cpSync(DIST, stage, { recursive: true })

const r = spawnSync('zip', ['-r', '-X', '-q', name, 'responsive-studio', '-x', '*.DS_Store'], { cwd: OUT, stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)
rmSync(stage, { recursive: true, force: true })
if (!existsSync(resolve(OUT, name))) process.exit(1)
console.log(`✓ release/${name}`)
