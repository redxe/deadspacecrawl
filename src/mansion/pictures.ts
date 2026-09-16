export interface Gallery { version: 1; images: Record<string, string> }
const api = `${import.meta.env.BASE_URL}__authoring/gallery`

export function parseGallery(value: unknown): Gallery {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('images' in value) || !value.images || typeof value.images !== 'object' || Array.isArray(value.images)) throw new Error('Invalid gallery manifest.')
  const images: Record<string, string> = {}
  for (const [id, source] of Object.entries(value.images)) {
    if (typeof source !== 'string' || !/^mansion-images\/[a-z0-9-]+\.(jpg|png|webp)$/.test(source)) throw new Error('Invalid gallery image path.')
    images[id] = source
  }
  return { version: 1, images }
}

export async function loadGallery(): Promise<Gallery> {
  const response = await fetch(`${import.meta.env.BASE_URL}mansion-gallery.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Picture collection unavailable.')
  return parseGallery(await response.json())
}

export async function openGalleryEditor() {
  const response = await fetch(api, { cache: 'no-store' })
  if (!response.ok) throw new Error('Picture editing requires the local development server.')
  const initial = await response.json()
  let revision: string = initial.revision
  return {
    gallery: parseGallery(initial.gallery),
    async save(frame: string, image: string | null): Promise<Gallery> {
      const response = await fetch(api, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Gallery-Token': initial.token }, body: JSON.stringify({ frame, image, revision }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Unable to save picture.')
      revision = result.revision
      return parseGallery(result.gallery)
    },
  }
}

export async function resizePicture(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 30_000_000) throw new Error('Choose a JPEG, PNG or WebP under 30 MB.')
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ececea'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', .88)
  } finally { image.close() }
}