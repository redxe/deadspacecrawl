export const CHARACTER_KEYS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
  'ss', 'th', 'dbl-letter', '?', '!',
] as const

type GlyphKey = (typeof CHARACTER_KEYS)[number]
type GlyphRect = readonly [x: number, y: number, width: number, height: number]
export type GlyphAtlas = ReadonlyMap<GlyphKey, string>

const GLYPH_RECTS: readonly GlyphRect[] = [
  [187, 107, 79, 101], [278, 107, 74, 101], [364, 107, 84, 101],
  [459, 107, 92, 101], [561, 107, 98, 101], [671, 107, 81, 101],
  [763, 107, 86, 101], [861, 107, 83, 101], [956, 107, 78, 101],
  [1045, 107, 87, 101], [1143, 107, 76, 101], [1230, 107, 73, 101],
  [1312, 107, 84, 101],
  [187, 266, 79, 97], [277, 266, 83, 97], [373, 266, 88, 97],
  [473, 266, 83, 97], [567, 266, 82, 97], [670, 266, 93, 97],
  [775, 266, 84, 97], [871, 266, 73, 97], [957, 266, 84, 97],
  [1054, 266, 77, 97], [1141, 266, 81, 97], [1233, 266, 73, 97],
  [1317, 266, 81, 97],
  [200, 497, 80, 99], [318, 497, 77, 99], [440, 496, 84, 100],
  [596, 496, 98, 99], [748, 496, 85, 100], [875, 496, 86, 100],
  [986, 496, 85, 100], [1111, 496, 81, 100], [1223, 495, 81, 101],
  [1324, 495, 82, 101],
  [446, 656, 81, 99], [594, 656, 99, 99], [748, 656, 78, 99],
  [893, 655, 82, 100], [1110, 655, 81, 100],
]

const DOUBLE_MARKER_ALIASES = [
  '[DBLLTR]', '[DBL-LTR]', '[DBLLETTER]', '[DBL-LETTER]',
  '[DBL LTR]', '[DBLLTER]', '[DBL LTER]',
]

function normalizeMarkupText(text: string): string {
  return DOUBLE_MARKER_ALIASES.reduce(
    (value, alias) => value.replaceAll(alias, '[DBLLTR]'),
    text.toUpperCase(),
  )
}

export function tokenizeGlyphText(text: string): string[][] {
  const normalized = normalizeMarkupText(text)
  const lines: string[][] = []
  let currentLine: string[] = []
  let index = 0

  while (index < normalized.length) {
    const character = normalized[index]

    if (character === '\n') {
      lines.push(currentLine)
      currentLine = []
      index += 1
      continue
    }

    if (character === ' ') {
      currentLine.push(' ')
      index += 1
      continue
    }

    if (normalized.slice(index, index + 8) === '[DBLLTR]') {
      currentLine.push('dbl-letter')
      index += 8
      continue
    }

    if (character && /[A-Z]/.test(character)) {
      const pair = normalized.slice(index, index + 2)

      if (pair === 'TH') {
        currentLine.push('th')
        index += 2
        continue
      }

      if (pair === 'SS') {
        currentLine.push('ss')
        index += 2
        continue
      }

      if (normalized[index + 1] === character && character !== 'S') {
        currentLine.push(character, 'dbl-letter')
        index += 2
        continue
      }

      currentLine.push(character)

      if (normalized.slice(index + 1, index + 9) === '[DBLLTR]') {
        currentLine.push('dbl-letter')
        index += 9
      } else {
        index += 1
      }
      continue
    }

    if (character && /[0-9?!]/.test(character)) {
      currentLine.push(character)
    }

    index += 1
  }

  lines.push(currentLine)
  return lines
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load glyph chart: ${source}`))
    image.src = source
  })
}

function extractGlyph(image: HTMLImageElement, rect: GlyphRect): string {
  const [x, y, width, height] = rect
  const margin = Math.max(4, Math.round(Math.min(width, height) * 0.04))
  const sourceWidth = width - margin * 2
  const sourceHeight = height - margin * 2
  const source = document.createElement('canvas')
  source.width = sourceWidth
  source.height = sourceHeight

  const sourceContext = source.getContext('2d', { willReadFrequently: true })
  if (!sourceContext) {
    throw new Error('Canvas rendering is unavailable.')
  }

  sourceContext.drawImage(
    image,
    x + margin,
    y + margin,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  )

  const pixels = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight)
  let left = sourceWidth
  let top = sourceHeight
  let right = 0
  let bottom = 0

  for (let pixel = 0; pixel < pixels.data.length; pixel += 4) {
    const red = pixels.data[pixel] ?? 255
    const green = pixels.data[pixel + 1] ?? 255
    const blue = pixels.data[pixel + 2] ?? 255
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114
    const alpha = Math.max(0, Math.min(255, ((245 - luminance) / 165) * 255))
    const coordinate = pixel / 4
    const pixelX = coordinate % sourceWidth
    const pixelY = Math.floor(coordinate / sourceWidth)

    pixels.data[pixel] = 127
    pixels.data[pixel + 1] = 241
    pixels.data[pixel + 2] = 224
    pixels.data[pixel + 3] = alpha

    if (alpha > 5) {
      left = Math.min(left, pixelX)
      top = Math.min(top, pixelY)
      right = Math.max(right, pixelX)
      bottom = Math.max(bottom, pixelY)
    }
  }

  sourceContext.putImageData(pixels, 0, 0)

  const output = document.createElement('canvas')
  output.width = 128
  output.height = 128
  const outputContext = output.getContext('2d')

  if (!outputContext || right < left || bottom < top) {
    return output.toDataURL('image/png')
  }

  const trimmedWidth = right - left + 1
  const trimmedHeight = bottom - top + 1
  const scale = Math.min(104 / trimmedWidth, 104 / trimmedHeight)
  const targetWidth = Math.max(1, Math.round(trimmedWidth * scale))
  const targetHeight = Math.max(1, Math.round(trimmedHeight * scale))

  outputContext.drawImage(
    source,
    left,
    top,
    trimmedWidth,
    trimmedHeight,
    (128 - targetWidth) / 2,
    (128 - targetHeight) / 2,
    targetWidth,
    targetHeight,
  )

  return output.toDataURL('image/png')
}

export async function loadGlyphAtlas(chartUrl: string): Promise<GlyphAtlas> {
  const chart = await loadImage(chartUrl)
  const glyphs = new Map<GlyphKey, string>()

  CHARACTER_KEYS.forEach((key, index) => {
    const rect = GLYPH_RECTS[index]
    if (rect) {
      glyphs.set(key, extractGlyph(chart, rect))
    }
  })

  return glyphs
}

export function renderGlyphText(
  target: HTMLElement,
  text: string,
  glyphs: GlyphAtlas,
): void {
  const fragment = document.createDocumentFragment()

  tokenizeGlyphText(text).forEach((tokens) => {
    const line = document.createElement('div')
    line.className = 'glyph-line'

    tokens.forEach((token) => {
      if (token === ' ') {
        const space = document.createElement('span')
        space.className = 'glyph-space'
        line.append(space)
        return
      }

      const source = glyphs.get(token as GlyphKey)
      if (!source) {
        return
      }

      const glyph = document.createElement('img')
      glyph.className = 'glyph'
      glyph.src = source
      glyph.alt = ''
      glyph.draggable = false
      line.append(glyph)
    })

    fragment.append(line)
  })

  target.replaceChildren(fragment)
}