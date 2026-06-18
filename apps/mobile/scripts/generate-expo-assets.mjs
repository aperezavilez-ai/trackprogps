/**
 * Genera assets de Expo desde el icono web.
 * Uso: node scripts/generate-expo-assets.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mobileRoot = join(__dirname, '..')
const webIcon = join(mobileRoot, '..', 'web', 'public', 'icons', 'icon-512.png')
const assetsDir = join(mobileRoot, 'assets')

async function main() {
  mkdirSync(assetsDir, { recursive: true })
  const sharp = (await import('sharp')).default
  const source = readFileSync(webIcon)

  const sizes = [
    ['icon.png', 1024],
    ['adaptive-icon.png', 1024],
    ['splash.png', 1284],
    ['notification-icon.png', 96],
    ['favicon.png', 48],
  ]

  for (const [name, size] of sizes) {
    const buf = await sharp(source).resize(size, size, { fit: 'contain', background: '#0f172a' }).png().toBuffer()
    writeFileSync(join(assetsDir, name), buf)
    console.log('Wrote', name)
  }

  console.log('Assets listos en apps/mobile/assets')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
