import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const galleryPlan = [
  { frame: 'gallery-1', files: ['20260523_235958.jpg'] },
  { frame: 'gallery-2', files: ['20250621_230510.jpg', '20260910_132204.jpg'], direction: 'horizontal' },
  { frame: 'gallery-3', files: ['20260907_180157.jpg'] },
  { frame: 'gallery-4', files: ['20260910_184836.jpg'] },
  { frame: 'gallery-5', files: ['20260907_215447.jpg'] },
  { frame: 'gallery-6', files: ['IMG_20260914_160108.jpg'] },
  { frame: 'gallery-7', files: ['FB_IMG_1745277280951.jpg', 'Snapchat-327073400.jpg'], direction: 'horizontal' },
  { frame: 'ballroom-north-1', files: ['image3.png'], dark: true },
  { frame: 'ballroom-north-2', files: ['Art_Commission__The_Ferryman.png'], dark: true },
  { frame: 'ballroom-north-3', files: ['image5.png'], dark: true },
  { frame: 'ballroom-north-4', files: ['20260910_235621.jpg'] },
  { frame: 'ballroom-east-1', files: ['Screenshot_2026-09-08_194232.png'], dark: true },
  { frame: 'ballroom-east-2', files: ['Screenshot_2026-09-08_215336.png', 'Screenshot_2026-09-09_191033.png'], direction: 'vertical', dark: true },
  { frame: 'ballroom-east-3', files: ['image4.png'], dark: true },
  { frame: 'ballroom-west-1', files: ['com.vrchat.oculus.quest-20260910-025122.jpg'], dark: true },
  { frame: 'ballroom-west-2', files: ['FB_IMG_1779907917905.jpg'] },
  { frame: 'ballroom-west-3', files: ['image6.png'], dark: true },
]

export async function makeGalleryImage(inputs, { direction = 'horizontal', dark = false, lossless = false } = {}) {
  const background = dark ? '#15191b' : '#e7e8e2'
  const encoding = { quality: 90, effort: 5, lossless }
  if (inputs.length === 1) return sharp(inputs[0]).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).flatten({ background }).webp(encoding).toBuffer()
  if (inputs.length !== 2) throw new Error('Use one image or a two-image collage.')
  const horizontal = direction === 'horizontal'
  const dimensions = await Promise.all(inputs.map(async input => {
    const meta = await sharp(input).metadata()
    return meta.orientation >= 5 ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height }
  }))
  const gap = 16
  const ratio = dimensions.reduce((sum, size) => sum + (horizontal ? size.width / size.height : size.height / size.width), 0)
  const common = Math.floor(Math.min(1200, ...dimensions.map(size => horizontal ? size.height : size.width), (1600 - gap) / ratio))
  const tiles = await Promise.all(inputs.map(input => sharp(input).rotate().resize(horizontal ? { height: common, withoutEnlargement: true } : { width: common, withoutEnlargement: true }).flatten({ background }).png().toBuffer({ resolveWithObject: true })))
  const width = horizontal ? tiles.reduce((sum, tile) => sum + tile.info.width, gap) : common
  const height = horizontal ? common : tiles.reduce((sum, tile) => sum + tile.info.height, gap)
  let offset = 0
  const composite = tiles.map(tile => {
    const placement = { input: tile.data, left: horizontal ? offset : 0, top: horizontal ? 0 : offset }
    offset += (horizontal ? tile.info.width : tile.info.height) + gap
    return placement
  })
  return sharp({ create: { width, height, channels: 3, background } }).composite(composite).webp(encoding).toBuffer()
}

async function populate(directory) {
  if (!directory) throw new Error('Pass the source photo directory. Originals are never modified.')
  const root = fileURLToPath(new URL('../', import.meta.url))
  const manifest = resolve(root, 'public/mansion-gallery.json')
  const original = await readFile(manifest, 'utf8')
  const gallery = JSON.parse(original)
  if (gallery.version !== 1 || !gallery.images || Array.isArray(gallery.images)) throw new Error('Invalid gallery manifest.')
  const generated = []
  for (const item of galleryPlan) {
    const inputs = item.files.map(file => resolve(directory, file))
    const image = await makeGalleryImage(inputs, { ...item, lossless: item.files.every(file => /\.png$/i.test(file)) })
    const hash = createHash('sha256').update(image).digest('hex').slice(0, 16)
    const filename = `${item.frame}-${hash}.webp`
    const { width, height, exif } = await sharp(image).metadata()
    if (exif || Math.max(width, height) > 1600) throw new Error(`Invalid generated image for ${item.frame}`)
    generated.push({ image, filename, frame: item.frame, width, height, bytes: image.length, sources: item.files })
  }
  const destination = resolve(root, 'public/mansion-images')
  await mkdir(destination, { recursive: true })
  for (const item of generated) {
    await writeFile(resolve(destination, item.filename), item.image)
    gallery.images[item.frame] = `mansion-images/${item.filename}`
  }
  if (await readFile(manifest, 'utf8') !== original) throw new Error('Gallery changed while importing. Run again to preserve the latest edits.')
  const temporary = `${manifest}.import.tmp`
  await writeFile(temporary, `${JSON.stringify(gallery, null, 2)}\n`)
  await rename(temporary, manifest)
  console.log(JSON.stringify({ frames: generated.length, originals: generated.reduce((sum, item) => sum + item.sources.length, 0), totalBytes: generated.reduce((sum, item) => sum + item.bytes, 0), images: generated.map(({ image, ...item }) => item) }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await populate(process.argv[2])