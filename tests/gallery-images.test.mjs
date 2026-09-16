import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { makeGalleryImage, galleryPlan } from '../tooling/populate-gallery.mjs'

test('gallery selection uses all twenty originals once in seventeen frames', () => {
  const files = galleryPlan.flatMap(item => item.files)
  assert.equal(galleryPlan.length, 17)
  assert.equal(new Set(galleryPlan.map(item => item.frame)).size, 17)
  assert.equal(files.length, 20)
  assert.equal(new Set(files).size, 20)
  assert.equal(galleryPlan.filter(item => item.files.length === 2).length, 3)
})

test('gallery copies preserve proportions and remove metadata without enlarging small originals', async () => {
  const input = await sharp({ create: { width: 320, height: 640, channels: 3, background: '#d594aa' } }).withMetadata().jpeg().toBuffer()
  const image = await makeGalleryImage([input])
  const meta = await sharp(image).metadata()
  assert.equal(meta.width, 320)
  assert.equal(meta.height, 640)
  assert.equal(meta.format, 'webp')
  assert.equal(meta.exif, undefined)
})

test('collages share an edge length and preserve complete image proportions with a narrow gutter', async () => {
  const wide = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#ff0000' } }).png().toBuffer()
  const tall = await sharp({ create: { width: 300, height: 600, channels: 3, background: '#0000ff' } }).png().toBuffer()
  const row = await sharp(await makeGalleryImage([wide, tall], { lossless: true })).metadata()
  assert.equal(row.width, 1016)
  assert.equal(row.height, 400)
  const column = await sharp(await makeGalleryImage([wide, tall], { direction: 'vertical', lossless: true })).metadata()
  assert.equal(column.width, 300)
  assert.equal(column.height, 766)
})