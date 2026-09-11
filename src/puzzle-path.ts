import { CheckCircle2, Circle, LockKeyhole, Route, X, createElement } from 'lucide'
import { getPuzzlePath, type PathPuzzle } from './puzzle-path-state'
import './puzzle-path.css'

export function initializePuzzlePath(app: HTMLElement, getPuzzles: () => PathPuzzle[], onOpen: (id: string) => void) {
  const visitedKey = 'signal-archive.puzzle-path-visited.v1'
  let visited = false
  try { visited = localStorage.getItem(visitedKey) === 'true' } catch {}
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'icon-button puzzle-path-trigger'
  trigger.classList.toggle('puzzle-path-trigger--unvisited', !visited)
  trigger.title = 'Puzzle path'
  trigger.setAttribute('aria-label', 'Puzzle path')
  trigger.setAttribute('aria-haspopup', 'dialog')
  trigger.setAttribute('aria-controls', 'puzzle-path-dialog')
  const label = document.createElement('span')
  label.className = 'puzzle-path-trigger__label'
  label.textContent = 'Puzzle path'
  trigger.append(label, createElement(Route))
  app.querySelector('[data-open-archive]')!.before(trigger)

  const dialog = document.createElement('dialog')
  dialog.id = 'puzzle-path-dialog'
  dialog.className = 'puzzle-path-dialog'
  dialog.setAttribute('aria-labelledby', 'puzzle-path-title')
  dialog.innerHTML = `<header class="puzzle-path-header"><div><span>PRIVATE RELAY</span><h2 id="puzzle-path-title">Puzzle Path</h2></div><button class="icon-button" type="button" title="Close puzzle path" aria-label="Close puzzle path"></button></header><ol class="puzzle-path-list"></ol>`
  const close = dialog.querySelector('button')!
  close.append(createElement(X))
  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    dialog.close()
  })
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  const list = dialog.querySelector('ol')!
  const render = (): void => {
    list.replaceChildren()
    getPuzzlePath(getPuzzles()).forEach((puzzle, index) => {
      const item = document.createElement('li')
      item.className = `puzzle-path-step puzzle-path-step--${puzzle.status}`
      const marker = document.createElement('span')
      marker.className = 'puzzle-path-marker'
      marker.setAttribute('aria-hidden', 'true')
      marker.append(createElement(puzzle.status === 'completed' ? CheckCircle2 : puzzle.status === 'locked' ? LockKeyhole : Circle))
      const content = document.createElement('div')
      const title = document.createElement('h3')
      title.textContent = `${String(index + 1).padStart(2, '0')} / ${puzzle.title}`
      const state = document.createElement('p')
      state.textContent = puzzle.status === 'locked' ? `Locked / Complete ${puzzle.prerequisite}`
        : puzzle.status === 'completed' ? 'Completed'
        : puzzle.status === 'pending' ? 'Awaiting puzzle content' : 'Available'
      content.append(title, state)
      item.append(marker, content)
      if (puzzle.status === 'available' || (puzzle.reviewable && puzzle.status === 'completed')) {
        const open = document.createElement('button')
        open.type = 'button'
        open.className = 'icon-text-button'
        open.textContent = puzzle.status === 'completed' ? 'Review' : 'Open'
        open.setAttribute('aria-label', `${open.textContent} ${puzzle.title}`)
        open.addEventListener('click', () => { dialog.close(); onOpen(puzzle.id) })
        item.append(open)
      }
      list.append(item)
    })
  }
  trigger.addEventListener('click', () => {
    render()
    dialog.showModal()
    trigger.classList.remove('puzzle-path-trigger--unvisited')
    try { localStorage.setItem(visitedKey, 'true') } catch {}
  })
  app.append(dialog)
  return {
    refresh: () => { if (dialog.open) render() },
    destroy: () => { dialog.remove(); trigger.remove() },
  }
}