/**
 * Genera iconos PWA PNG desde public/icons/icon.svg
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'icons', 'icon.svg')
const outDir = join(root, 'public', 'icons')

async function main() {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.error('Instala sharp: npm install sharp --save-dev')
    process.exit(1)
  }

  const svg = readFileSync(svgPath)

  for (const size of [192, 512]) {
    const buf = await sharp(svg).resize(size, size).png().toBuffer()
    const out = join(outDir, `icon-${size}.png`)
    writeFileSync(out, buf)
    console.log('Wrote', out)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
