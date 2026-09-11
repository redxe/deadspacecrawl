import { highlightCommand } from './console-editor'
import type { MusicRange } from './music-player'

export function mergeMusicRanges(ranges: readonly MusicRange[], length: number): MusicRange[] {
  const sorted = ranges.filter(range => Number.isInteger(range.from) && Number.isInteger(range.to) && range.from >= 0 && range.from < range.to && range.to <= length)
    .map(range => ({ ...range })).sort((first, second) => first.from - second.from || first.to - second.to)
  const merged: MusicRange[] = []
  for (const range of sorted) {
    const previous = merged.at(-1)
    if (previous && range.from <= previous.to) previous.to = Math.max(previous.to, range.to)
    else merged.push(range)
  }
  return merged
}

export function initializeMusicEditor(input: HTMLTextAreaElement) {
  const editor = document.createElement('div')
  editor.className = 'music-code-editor'
  const activity = document.createElement('pre')
  activity.className = 'music-code-editor__activity'
  const syntax = document.createElement('pre')
  syntax.className = 'music-code-editor__syntax'
  for (const layer of [activity, syntax]) layer.setAttribute('aria-hidden', 'true')
  input.before(editor)
  editor.append(activity, syntax, input)
  let signature = ''

  const syncScroll = (): void => {
    for (const layer of [activity, syntax]) {
      layer.style.width = `${input.clientWidth}px`
      layer.style.height = `${input.clientHeight}px`
      layer.scrollTop = input.scrollTop
      layer.scrollLeft = input.scrollLeft
    }
  }
  const setPlayback = (source: string, ranges: readonly MusicRange[]): void => {
    const merged = source === input.value ? mergeMusicRanges(ranges, source.length) : []
    const nextSignature = JSON.stringify([input.value, merged])
    if (nextSignature === signature) return
    signature = nextSignature
    const fragment = document.createDocumentFragment()
    let offset = 0
    for (const range of merged) {
      fragment.append(document.createTextNode(input.value.slice(offset, range.from)))
      const mark = document.createElement('mark')
      mark.textContent = input.value.slice(range.from, range.to)
      fragment.append(mark)
      offset = range.to
    }
    fragment.append(document.createTextNode(`${input.value.slice(offset)}\n`))
    activity.replaceChildren(fragment)
    syncScroll()
  }
  const refresh = (): void => {
    syntax.innerHTML = `${highlightCommand(input.value)}\n`
    setPlayback('', [])
    syncScroll()
  }
  input.addEventListener('input', refresh)
  input.addEventListener('scroll', syncScroll)
  const observer = new ResizeObserver(syncScroll)
  observer.observe(input)
  refresh()
  return {
    refresh,
    setPlayback,
    destroy: () => {
      observer.disconnect()
      input.removeEventListener('input', refresh)
      input.removeEventListener('scroll', syncScroll)
    },
  }
}