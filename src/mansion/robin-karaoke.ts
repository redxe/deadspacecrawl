import { renderGlyphText } from '../glyphs'
import type { GlyphAtlas } from '../glyphs'
import type { MusicCue } from '../music-player'

export function createRobinKaraoke(parent: HTMLElement) {
  const root = document.createElement('div')
  root.className = 'mansion-karaoke'; root.hidden = true; root.setAttribute('aria-live', 'off'); parent.append(root)
  let atlas: GlyphAtlas | undefined
  let text = ''
  let current: MusicCue['lyric'] = null
  let words: HTMLElement[] = []
  const update = (lyric: MusicCue['lyric']) => {
    current = lyric
    root.hidden = !lyric || !atlas
    if (!lyric || !atlas) return
    if (text !== lyric.text) {
      text = lyric.text
      root.setAttribute('aria-label', text)
      words = text.split(' ').map(word => {
        const element = document.createElement('span'); element.className = 'mansion-karaoke-word'
        const base = document.createElement('span'); base.className = 'mansion-karaoke-base'; renderGlyphText(base, word, atlas!)
        const fill = document.createElement('span'); fill.className = 'mansion-karaoke-fill'; fill.setAttribute('aria-hidden', 'true'); renderGlyphText(fill, word, atlas!)
        element.append(base, fill)
        return element
      })
      root.replaceChildren(...words)
    }
    words.forEach((word, index) => {
      word.classList.toggle('is-current', index === lyric.word)
      word.setAttribute('aria-current', index === lyric.word ? 'true' : 'false')
      const fill = index < lyric.word ? 1 : index === lyric.word ? lyric.progress : 0
      word.style.setProperty('--lyric-fill', `${(1 - fill) * 100}%`)
    })
  }
  return { update, setAtlas(next: GlyphAtlas) { atlas = next; text = ''; update(current) }, destroy() { root.remove() } }
}