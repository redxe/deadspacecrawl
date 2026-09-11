import type { Puzzle } from './puzzles/types'
import { highlightCommand, initializeConsoleEditor } from './console-editor'
import { renderConsoleValue } from './console-results'
import type { ConsoleValue } from './console-results'
import primeEngineSource from './prime-engine.js?raw'
import { commandHelp } from './console-help'
import { CHARACTER_KEYS } from './glyphs'
import { createRelayTools, relayToolDefinitions } from './relay-tools'
import { initializeToolWindows } from './tool-windows'

const CONSOLE_HISTORY_KEY = 'signal-archive.console-history.v1'
const CHANNEL = 'signal-archive-console'

interface ConsoleMessage {
  channel: string
  type: 'ready' | 'result' | 'submit' | 'clear' | 'popout'
  tool?: string
  id?: number
  logs?: Array<{ level: string; values: ConsoleValue[] }>
  result?: ConsoleValue
  duration?: number
  error?: string
  answer?: string
}

interface PuzzleConsoleOptions {
  puzzle: Puzzle
  onSubmit: (answer: string) => void
}

function createSandboxSource(): string {
  const source = `
    const CHANNEL = '${CHANNEL}';
    const send = (message) => postMessage({ channel: CHANNEL, ...message });
    ${primeEngineSource}
    Object.assign(globalThis, (${createRelayTools.toString()})(${JSON.stringify(CHARACTER_KEYS)}));
    const presentation = new WeakMap();
    const commandHelp = ${JSON.stringify(commandHelp)};
    const describe = (value, seen = new WeakSet(), depth = 0, budget = { left: 300 }) => {
      if (--budget.left < 0 || depth > 4) return { type: 'string', text: '[Preview limit]' };
      if (value === null) return { type: 'null', text: 'null' };
      const type = typeof value;
      if (type !== 'object') return {
        type: type === 'bigint' ? 'number' : type === 'symbol' ? 'string' : type,
        text: (String(value) + (type === 'bigint' ? 'n' : '')).slice(0, 4000),
      };
      if (seen.has(value)) return { type: 'string', text: '[Circular reference]' };
      seen.add(value);
      const metadata = presentation.get(value);
      if (metadata?.layout === 'tools') return { type: 'tools' };
      if (metadata?.layout === 'help') return { type: 'help', command: metadata.command };
      if (metadata?.layout === 'prime') return { type: 'prime', prime: value };
      if (Array.isArray(value)) return {
        type: 'array',
        ...presentation.get(value),
        items: value.slice(0, 80).map(item => describe(item, seen, depth + 1, budget)),
        omitted: Math.max(0, value.length - 80),
      };
      if (value instanceof Date || value instanceof Error) return { type: 'string', text: String(value) };
      const entries = Object.entries(value);
      return {
        type: 'object',
        entries: entries.slice(0, 30).map(([key, item]) => [key, describe(item, seen, depth + 1, budget)]),
        omitted: Math.max(0, entries.length - 30),
      };
    };

    globalThis.gcd = (first, second) => {
      let a = Math.abs(Number(first));
      let b = Math.abs(Number(second));
      if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) throw new Error('gcd expects two safe integers.');
      while (b) [a, b] = [b, a % b];
      return a;
    };

    globalThis.isPrime = (value) => {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 2) return false;
      if (!Number.isSafeInteger(number) || number > 1000000000000) throw new Error('isPrime accepts integers up to 1,000,000,000,000.');
      if (number % 2 === 0) return number === 2;
      for (let divisor = 3; divisor * divisor <= number; divisor += 2) {
        if (number % divisor === 0) return false;
      }
      return true;
    };

    const primeCache = [2];
    globalThis.primes = (...indices) => {
      if (indices.length < 1 || indices.length > 2) throw new Error('Use primes(index) or primes(start, end). Indices are one-based.');
      if (indices.length === 1) {
        const info = lookupPrime(indices[0]);
        presentation.set(info, { layout: 'prime' });
        return info;
      }
      if (!indices.every(index => Number.isSafeInteger(index) && index >= 1 && index <= 10000)) {
        throw new Error('Range prime indices must be integers from 1 to 10,000.');
      }
      const [start, end] = indices;
      if (end < start) throw new Error('The end index must be greater than or equal to the start index.');
      const total = end;
      for (let candidate = primeCache[primeCache.length - 1] + 1; primeCache.length < total; candidate += 1) {
        let prime = true;
        for (const divisor of primeCache) {
          if (divisor * divisor > candidate) break;
          if (candidate % divisor === 0) { prime = false; break; }
        }
        if (prime) primeCache.push(candidate);
      }
      const values = primeCache.slice(start - 1, end);
      presentation.set(values, { layout: 'sequence', startIndex: start, endIndex: end, label: 'PRIME INDICES / ' + start + ' TO ' + end });
      return values;
    };

    globalThis.factor = (value) => {
      let number = Math.abs(Number(value));
      if (!Number.isSafeInteger(number) || number < 1 || number > 1000000000000) throw new Error('factor expects a nonzero integer up to 1,000,000,000,000 in magnitude.');
      const factors = [];
      for (let divisor = 2; divisor * divisor <= number; divisor += 1) {
        while (number % divisor === 0) {
          factors.push(divisor);
          number /= divisor;
        }
      }
      if (number > 1) factors.push(number);
      presentation.set(factors, { layout: 'factors', label: 'FACTORS / ' + value });
      return factors;
    };

    globalThis.answer = (value) => {
      send({ type: 'submit', answer: String(value) });
      return 'Answer routed to the decoder.';
    };

    globalThis.clear = () => {
      send({ type: 'clear' });
      return undefined;
    };

    globalThis.tools = (name) => {
      const directory = ${JSON.stringify(relayToolDefinitions)};
      if (name === undefined) {
        presentation.set(directory, { layout: 'tools' });
        return directory;
      }
      if (typeof name !== 'string' || !directory.some(tool => tool.name === name)) throw new Error('Choose relay, bits, or glyphs.');
      send({ type: 'popout', tool: name });
      return 'Tool opened: ' + name;
    };

    globalThis.help = (command) => {
      if (command === undefined) {
        const directory = Object.fromEntries(commandHelp.map(entry => [entry.name, entry.summary]));
        presentation.set(directory, { layout: 'help' });
        return directory;
      }
      const name = typeof command === 'string'
        ? command.trim().split('(')[0].trim().toLowerCase()
        : commandHelp.find(entry => globalThis[entry.name] === command)?.name.toLowerCase();
      const reference = commandHelp.find(entry => entry.name.toLowerCase() === name);
      if (!reference) throw new Error('Unknown command. Available: ' + commandHelp.map(entry => entry.name).join(', ') + '.');
      const result = structuredClone(reference);
      presentation.set(result, { layout: 'help', command: reference.name });
      return result;
    };

    addEventListener('message', async (event) => {
      const message = event.data;
      if (!message || message.channel !== CHANNEL) return;

      if (message.type === 'init') {
        globalThis.puzzle = Object.freeze(message.puzzle);
        return;
      }

      if (message.type !== 'run') return;

      const logs = [];
      const started = performance.now();
      const original = {};
      for (const level of ['log', 'info', 'warn', 'error']) {
        original[level] = console[level];
        console[level] = (...values) => {
          if (logs.length < 50) logs.push({ level, values: values.slice(0, 20).map(value => describe(value)) });
        };
      }

      try {
        let result = (0, eval)(message.code);
        if (result && typeof result.then === 'function') result = await result;
        send({
          type: 'result',
          id: message.id,
          logs,
          result: typeof result === 'undefined' ? undefined : describe(result),
          duration: performance.now() - started,
        });
      } catch (error) {
        send({
          type: 'result',
          id: message.id,
          logs,
          error: error instanceof Error ? error.message : String(error),
          duration: performance.now() - started,
        });
      } finally {
        for (const level of Object.keys(original)) console[level] = original[level];
      }
    });

    send({ type: 'ready' });
  `
  return `<!doctype html><html><body><script>
    const url = URL.createObjectURL(new Blob([${JSON.stringify(source).replace(/</g, '\\u003c')}], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = (event) => parent.postMessage(event.data, '*');
    addEventListener('message', (event) => {
      if (event.source === parent) worker.postMessage(event.data);
    });
  <\/script></body></html>`
}

function readHistory(): string[] {
  try {
    const history = JSON.parse(localStorage.getItem(CONSOLE_HISTORY_KEY) ?? '[]')
    return Array.isArray(history) ? history.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeHistory(history: string[]): void {
  try {
    localStorage.setItem(CONSOLE_HISTORY_KEY, JSON.stringify(history.slice(-50)))
  } catch {
    // Command execution does not depend on persistence.
  }
}

export function initializeConsole(
  container: HTMLElement,
  { puzzle, onSubmit }: PuzzleConsoleOptions,
): { setPuzzle: (next: Puzzle) => void } {
  const output = container.querySelector<HTMLElement>('[data-console-output]')
  const input = container.querySelector<HTMLTextAreaElement>('[data-console-input]')
  const runButton = container.querySelector<HTMLButtonElement>('[data-console-run]')
  const toggleButton = container.querySelector<HTMLButtonElement>('[data-console-toggle]')

  if (!output || !input || !runButton || !toggleButton) {
    throw new Error('Console controls are incomplete.')
  }

  const sandbox = document.createElement('iframe')
  sandbox.className = 'console-sandbox'
  sandbox.sandbox.add('allow-scripts')
  sandbox.title = 'Isolated JavaScript runtime'
  sandbox.srcdoc = createSandboxSource()
  container.append(sandbox)

  let commandId = 0
  let history = readHistory()
  let historyIndex = history.length
  let draft = ''
  let running = false
  let ready = false
  let currentPuzzle = puzzle
  const openTool = initializeToolWindows(() => currentPuzzle)
  const setPuzzle = (next: Puzzle): void => {
    currentPuzzle = next
    if (!ready) return
    sandbox.contentWindow?.postMessage({ channel: CHANNEL, type: 'init', puzzle: {
      id: next.id, sequence: next.sequence, kind: next.kind, title: next.title,
      objective: next.objective, data: next.consoleData ?? {},
    } }, '*')
  }
  const editor = initializeConsoleEditor(input, () => history)
  const executions = new Map<number, { entry: HTMLElement; status: HTMLElement }>()
  runButton.disabled = true

  const scrollToLatest = (): void => { output.scrollTop = output.scrollHeight }

  const appendLine = (kind: string, value: string): void => {
    const line = document.createElement('div')
    line.className = `console-line console-line--${kind}`
    line.textContent = value
    output.append(line)
    output.scrollTop = output.scrollHeight
  }

  const run = (requestedCode?: string): void => {
    const code = requestedCode ?? input.value.trim()
    if (!code || !sandbox.contentWindow || running || !ready) {
      return
    }

    running = true
    runButton.disabled = true
    output.querySelectorAll<HTMLButtonElement>('[data-console-run-command]').forEach(button => { button.setAttribute('aria-disabled', 'true') })
    container.classList.add('console-panel--running')
    history = [...history.filter((entry) => entry !== code), code]
    historyIndex = history.length
    writeHistory(history)
    commandId += 1
    const entry = document.createElement('section')
    entry.className = 'console-execution'
    const heading = document.createElement('header')
    heading.className = 'console-execution__heading'
    const identifier = document.createElement('span')
    identifier.textContent = String(commandId).padStart(2, '0')
    const status = document.createElement('span')
    status.textContent = 'RUNNING'
    heading.append(identifier, status)
    const command = document.createElement('pre')
    command.className = 'console-command'
    command.innerHTML = highlightCommand(code)
    entry.append(heading, command)
    executions.set(commandId, { entry, status })
    output.append(entry)
    while (output.children.length > 60) output.firstElementChild?.remove()
    scrollToLatest()
    sandbox.contentWindow.postMessage(
      { channel: CHANNEL, type: 'run', id: commandId, code },
      '*',
    )
    if (requestedCode === undefined) {
      input.value = ''
      draft = ''
      input.style.height = ''
      editor.refresh()
    } else {
      draft = input.value
    }
  }

  window.addEventListener('message', (event: MessageEvent<ConsoleMessage>) => {
    if (event.source !== sandbox.contentWindow || !event.data || event.data.channel !== CHANNEL) {
      return
    }

    if (event.data.type === 'ready') {
      ready = true
      runButton.disabled = false
      setPuzzle(currentPuzzle)
      return
    }

    if (event.data.type === 'clear') {
      output.replaceChildren()
      return
    }

    if (event.data.type === 'popout' && event.data.tool) {
      openTool(event.data.tool)
      return
    }

    if (event.data.type === 'submit' && event.data.answer) {
      onSubmit(event.data.answer)
      return
    }

    if (event.data.type === 'result') {
      const execution = executions.get(event.data.id ?? -1)
      if (!execution) return
      running = false
      runButton.disabled = false
      container.classList.remove('console-panel--running')
      const duration = Math.max(0, event.data.duration ?? 0)
      execution.status.textContent = `${event.data.error ? 'ERROR' : 'COMPLETE'} / ${duration.toFixed(1)} ms`
      execution.entry.classList.add(event.data.error ? 'console-execution--error' : 'console-execution--complete')
      event.data.logs?.forEach((log) => {
        const row = document.createElement('div')
        row.className = `console-log console-line--${log.level}`
        const level = document.createElement('span')
        level.className = 'console-result-label'
        level.textContent = log.level.toUpperCase()
        row.append(level, ...log.values.map((value) => renderConsoleValue(value)))
        execution.entry.append(row)
      })
      if (event.data.result) execution.entry.append(renderConsoleValue(event.data.result))
      if (event.data.error) {
        const error = document.createElement('div')
        error.className = 'console-line console-line--error'
        error.textContent = event.data.error
        execution.entry.append(error)
      }
      executions.delete(event.data.id!)
      output.querySelectorAll<HTMLButtonElement>('[data-console-run-command]').forEach(button => { button.setAttribute('aria-disabled', 'false') })
      if (event.data.result?.type === 'help') {
        if (output.contains(document.activeElement)) {
          execution.entry.querySelector<HTMLButtonElement>('.console-help button')?.focus({ preventScroll: true })
        }
        output.scrollTop = execution.entry.offsetTop - output.offsetTop
      } else scrollToLatest()
    }
  })

  runButton.addEventListener('click', () => run())
  output.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-console-run-command], button[data-console-insert], button[data-console-popout]') : null
    if (!target || !output.contains(target)) return
    if (target.dataset.consolePopout !== undefined) {
      openTool(target.dataset.consolePopout)
    } else if (target.dataset.consoleRunCommand !== undefined) {
      run(target.dataset.consoleRunCommand)
    } else if (target.dataset.consoleInsert !== undefined) {
      input.setRangeText(target.dataset.consoleInsert, input.selectionStart, input.selectionEnd, 'end')
      draft = input.value
      historyIndex = history.length
      editor.refresh()
      input.focus()
    }
  })
  container.querySelector('[data-console-tools]')?.addEventListener('click', () => {
    if (container.classList.contains('console-panel--collapsed')) toggleButton.click()
    run('tools()')
  })
  toggleButton.addEventListener('click', () => {
    const collapsed = container.classList.toggle('console-panel--collapsed')
    toggleButton.setAttribute('aria-expanded', String(!collapsed))
    const label = collapsed ? 'Expand console' : 'Collapse console'
    toggleButton.setAttribute('aria-label', label)
    toggleButton.title = label
    if (!collapsed) {
      editor.refresh()
      scrollToLatest()
      input.focus()
    }
  })

  input.addEventListener('input', () => {
    historyIndex = history.length
    draft = input.value
  })

  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      run()
      return
    }

    if (event.key === 'ArrowUp' && !event.shiftKey &&
      (!input.value.includes('\n') || input.selectionStart === 0)) {
      event.preventDefault()
      historyIndex = Math.max(0, historyIndex - 1)
      input.value = history[historyIndex] ?? ''
      input.setSelectionRange(input.value.length, input.value.length)
      editor.refresh()
    }

    if (event.key === 'ArrowDown' && !event.shiftKey &&
      (!input.value.includes('\n') || input.selectionStart === input.value.length)) {
      event.preventDefault()
      historyIndex = Math.min(history.length, historyIndex + 1)
      input.value = history[historyIndex] ?? draft
      input.setSelectionRange(input.value.length, input.value.length)
      editor.refresh()
    }
  })

  appendLine('system', 'RUNTIME ONLINE / JS')
  return { setPuzzle }
}