/**
 * Generates all favicon and app-icon sizes from public/Aquila Logo.png
 * Run once: node scripts/gen-favicons.mjs
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir  = dirname(fileURLToPath(import.meta.url))
const root   = resolve(__dir, '..')
const src    = resolve(root, 'public', 'Aquila Logo.png')
const pub    = resolve(root, 'public')
const appDir = resolve(root, 'app')

async function resize(size, dest, opts = {}) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, ...opts })
    .toFile(dest)
  console.log(`✓ ${dest.replace(root, '')}`)
}

async function buildIco(sizes, dest) {
  // Build a multi-size ICO file manually using PNG data chunks.
  const chunks = await Promise.all(
    sizes.map(s =>
      sharp(src)
        .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  )

  const HEADER_SIZE  = 6
  const DIR_SIZE     = 16
  const dirOffset    = HEADER_SIZE + DIR_SIZE * chunks.length
  let offset = dirOffset

  // ICO header
  const header = Buffer.alloc(HEADER_SIZE)
  header.writeUInt16LE(0, 0)           // reserved
  header.writeUInt16LE(1, 2)           // type: 1 = ICO
  header.writeUInt16LE(chunks.length, 4)

  const dirs = chunks.map((chunk, i) => {
    const s   = sizes[i]
    const dir = Buffer.alloc(DIR_SIZE)
    dir.writeUInt8(s === 256 ? 0 : s, 0)  // width  (0 = 256)
    dir.writeUInt8(s === 256 ? 0 : s, 1)  // height (0 = 256)
    dir.writeUInt8(0, 2)                   // color count
    dir.writeUInt8(0, 3)                   // reserved
    dir.writeUInt16LE(1, 4)               // planes
    dir.writeUInt16LE(32, 6)              // bits per pixel
    dir.writeUInt32LE(chunk.length, 8)    // size
    dir.writeUInt32LE(offset, 12)         // offset
    offset += chunk.length
    return dir
  })

  const ico = Buffer.concat([header, ...dirs, ...chunks])
  writeFileSync(dest, ico)
  console.log(`✓ ${dest.replace(root, '')}`)
}

async function main() {
  console.log('Generating favicons from Aquila Logo.png …\n')

  // Standard PNG favicons (public/)
  await resize(16,  resolve(pub, 'favicon-16x16.png'))
  await resize(32,  resolve(pub, 'favicon-32x32.png'))
  await resize(180, resolve(pub, 'apple-touch-icon.png'))
  await resize(192, resolve(pub, 'android-chrome-192x192.png'))
  await resize(512, resolve(pub, 'android-chrome-512x512.png'))

  // Multi-size ICO (16 + 32 + 48) → overwrites the default Next.js one in app/
  await buildIco([16, 32, 48], resolve(appDir, 'favicon.ico'))

  console.log('\nDone. Deploy and hard-refresh to see the new favicon.')
}

main().catch(e => { console.error(e); process.exit(1) })
