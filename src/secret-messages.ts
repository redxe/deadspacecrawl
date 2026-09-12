import { Mail, X, RefreshCw, ArrowLeft, ChevronRight, createElement } from 'lucide'
import { renderGlyphText, type GlyphAtlas } from './glyphs'
import { decryptSecretMessages, secretDatabaseLimit, type SecretMessage } from './secret-database'
import { initializeSecretGlyphInput } from './secret-glyph-input'
import { readSecretProgress, saveSecretProgress } from './secret-progress'
import './secret-messages.css'

export function initializeSecretMessages(app: HTMLElement, atlas: Promise<GlyphAtlas>) {
  const trigger = document.createElement('button')
  trigger.type = 'button'; trigger.className = 'icon-button secret-messages-trigger'; trigger.title = 'Secret messages'
  trigger.setAttribute('aria-label', 'Secret messages'); trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', 'secret-messages-dialog')
  const label = document.createElement('span'); label.textContent = 'Secret messages'; trigger.append(label, createElement(Mail))
  app.querySelector('[data-open-archive]')!.before(trigger)
  const dialog = document.createElement('dialog')
  dialog.id = 'secret-messages-dialog'; dialog.className = 'archive-dialog secret-messages-dialog'; dialog.setAttribute('aria-labelledby', 'secret-messages-title')
  dialog.innerHTML = `<div class="archive-dialog__shell"><header class="archive-dialog__header"><div><span>PRIVATE TRANSMISSIONS</span><h2 id="secret-messages-title">Secret Messages</h2></div><div class="secret-dialog-actions"><button type="button" class="icon-button" title="Reload messages" aria-label="Reload messages" data-secret-reload></button><button type="button" class="icon-button" title="Close secret messages" aria-label="Close secret messages" data-secret-close></button></div></header><label class="secret-search">Search titles<input type="search" autocomplete="off" data-secret-search></label><p class="secret-status" role="status" data-secret-status></p><div class="secret-message-list" data-secret-list></div></div>`
  const find = <ElementType extends HTMLElement>(selector: string) => dialog.querySelector<ElementType>(selector)!
  const list = find('[data-secret-list]'), status = find('[data-secret-status]'), search = find<HTMLInputElement>('[data-secret-search]')
  const detail = document.createElement('dialog')
  detail.className = 'archive-dialog secret-messages-dialog secret-detail-dialog'
  detail.id = 'secret-message-detail'; detail.setAttribute('aria-labelledby', 'secret-detail-title')
  detail.innerHTML = `<div class="archive-dialog__shell"><header class="archive-dialog__header"><button type="button" class="icon-button" title="Back to messages" aria-label="Back to messages" data-secret-back></button><div><span>PRIVATE TRANSMISSION</span><h2 id="secret-detail-title"></h2><time data-secret-date></time></div><button type="button" class="icon-button" title="Close message" aria-label="Close message" data-detail-close></button></header><div class="secret-detail-body" data-secret-decode></div></div>`
  const detailTitle = detail.querySelector<HTMLElement>('#secret-detail-title')!
  const detailBody = detail.querySelector<HTMLElement>('[data-secret-decode]')!
  const drafts = new Map<string, { text: string; values: string[] }>()
  let decoder: ReturnType<typeof initializeSecretGlyphInput> | undefined
  let selectedButton: HTMLButtonElement | undefined
  detail.querySelector('[data-secret-back]')!.append(createElement(ArrowLeft))
  detail.querySelector('[data-detail-close]')!.append(createElement(X))
  function closeDetail() { decoder?.destroy(); detail.close(); if (dialog.open && selectedButton?.isConnected) selectedButton.focus() }
  detail.querySelector('[data-secret-back]')!.addEventListener('click', closeDetail)
  detail.querySelector('[data-detail-close]')!.addEventListener('click', closeDetail)
  detail.addEventListener('click', event => { if (event.target === detail) closeDetail() })
  detail.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDetail() } })
  detail.addEventListener('close', () => { if (detail.open) return; decoder?.destroy(); decoder = undefined; detailBody.replaceChildren(); detailTitle.textContent = ''; if (dialog.open && selectedButton?.isConnected) selectedButton.focus(); selectedButton = undefined })
  let records: SecretMessage[] = []
  let glyphs: GlyphAtlas | undefined
  let generation = 0
  let controller: AbortController | undefined
  find('[data-secret-close]').append(createElement(X)); find('[data-secret-reload]').append(createElement(RefreshCw))
  function render() {
    list.replaceChildren()
    const filtered = records.filter(record => record.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))
    status.textContent = records.length ? `${filtered.length} of ${records.length} messages` : 'No secret messages yet.'
    if (!glyphs) return
    for (const record of filtered) {
      const article = document.createElement('button'); article.type = 'button'; article.className = 'secret-message'
      article.setAttribute('aria-label', `Open ${record.title}`); article.setAttribute('aria-haspopup', 'dialog'); article.setAttribute('aria-controls', detail.id)
      const title = document.createElement('span'); title.className = 'secret-message-title'; title.textContent = record.title
      const timestamp = document.createElement('time'); timestamp.dateTime = record.updatedAt; timestamp.textContent = new Date(record.updatedAt).toLocaleDateString()
      const content = document.createElement('div'); content.className = 'secret-message-glyphs'; content.setAttribute('aria-hidden', 'true')
      renderGlyphText(content, record.text.slice(0, 70).split('\n')[0]!, glyphs)
      const arrow = createElement(ChevronRight); arrow.classList.add('secret-message-arrow')
      article.append(title, timestamp, content, arrow)
      article.addEventListener('click', () => {
        if (!glyphs) return
        selectedButton = article
        detailTitle.textContent = record.title
        const date = detail.querySelector<HTMLTimeElement>('[data-secret-date]')!
        date.dateTime = record.updatedAt; date.textContent = timestamp.textContent
        decoder?.destroy(); detailBody.replaceChildren()
        const saved = drafts.get(record.id)
        decoder = initializeSecretGlyphInput(detailBody, record.text, glyphs, saved?.text === record.text ? saved.values : readSecretProgress(record.id, record.updatedAt), values => {
          drafts.set(record.id, { text: record.text, values })
          saveSecretProgress(record.id, record.updatedAt, values)
        })
        detail.showModal(); detailBody.scrollTop = 0
      })
      list.append(article)
    }
  }
  async function load() {
    controller?.abort(); controller = new AbortController()
    const current = ++generation
    records = []; list.replaceChildren(); status.textContent = 'Loading encrypted messages...'
    find<HTMLButtonElement>('[data-secret-reload]').disabled = true
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}secret-messages.enc.json`, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error('Messages are unavailable. Try reloading.')
      if (Number(response.headers.get('content-length')) > secretDatabaseLimit) throw new Error('Message database is too large.')
      const source = await response.text()
      if (source.length > secretDatabaseLimit) throw new Error('Message database is too large.')
      const decoded = await decryptSecretMessages(JSON.parse(source))
      const loadedAtlas = await atlas
      if (current !== generation || !dialog.open) return
      records = decoded; glyphs = loadedAtlas; render()
    } catch (error) { if (current === generation && dialog.open) status.textContent = error instanceof Error ? error.message : 'Could not load messages.' }
    finally { if (current === generation) find<HTMLButtonElement>('[data-secret-reload]').disabled = false }
  }
  trigger.addEventListener('click', () => { search.value = ''; dialog.showModal(); void load() })
  find('[data-secret-reload]').addEventListener('click', () => { void load() })
  find('[data-secret-close]').addEventListener('click', () => dialog.close())
  search.addEventListener('input', render)
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.close() } })
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  dialog.addEventListener('close', () => { if (dialog.open) return; decoder?.destroy(); detail.close(); drafts.clear(); generation++; controller?.abort(); records = []; list.replaceChildren(); search.value = ''; status.textContent = '' })
  app.append(dialog, detail)
  return { destroy: () => { generation++; controller?.abort(); decoder?.destroy(); drafts.clear(); records = []; detail.remove(); dialog.remove(); trigger.remove() } }
}