import sharp from 'sharp'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const directory = process.argv[2]
if (!directory) throw new Error('Pass the source image directory.')
const output = resolve(process.argv[3] ?? 'test-results/gallery-contact-sheet.jpg')
const files = (await readdir(directory)).filter(file => /\.(jpe?g|png|webp)$/i.test(file)).sort()
if (!files.length) throw new Error('No supported images found.')
const tileWidth = 320
const tileHeight = 300
const composites = []
const metadata = []
for (const [index, file] of files.entries()) {
  const source = resolve(directory, file)
  const original = await sharp(source).metadata()
  const { data, info } = await sharp(source).rotate().resize({ width: 296, height: 242, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true })
  const horizontal = index % 5 * tileWidth
  const vertical = Math.floor(index / 5) * tileHeight
  composites.push({ input: data, left: horizontal + Math.round((tileWidth - info.width) / 2), top: vertical + Math.round((250 - info.height) / 2) })
  const label = `${index + 1}. ${file}`.replace(/[<>&"]/g, '').slice(0, 41)
  composites.push({ input: Buffer.from(`<svg width="320" height="48"><rect width="320" height="48" fill="#202326"/><text x="10" y="17" fill="#fff" font-size="12" font-family="sans-serif">${label}</text><text x="10" y="35" fill="#b8c8ca" font-size="12" font-family="sans-serif">${original.width} x ${original.height}</text></svg>`), left: horizontal, top: vertical + 252 })
  metadata.push({ index: index + 1, file, width: original.width, height: original.height, orientation: original.orientation ?? 1 })
}
await mkdir(dirname(output), { recursive: true })
await sharp({ create: { width: tileWidth * 5, height: Math.ceil(files.length / 5) * tileHeight, channels: 3, background: '#303438' } }).composite(composites).jpeg({ quality: 90 }).toFile(output)
await writeFile(`${output}.json`, `${JSON.stringify(metadata, null, 2)}\n`)
console.log(JSON.stringify({ output, images: metadata }, null, 2))