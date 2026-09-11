import { mathjax } from '@mathjax/src/js/mathjax.js'
import { TeX } from '@mathjax/src/js/input/tex.js'
import { SVG } from '@mathjax/src/js/output/svg.js'
import { browserAdaptor } from '@mathjax/src/js/adaptors/browserAdaptor.js'
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js'
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js'

mathjax.asyncLoad = async (name: string) => {
  if (name.endsWith('/double-struck.js')) {
    return import('@mathjax/mathjax-newcm-font/js/svg/dynamic/double-struck.js')
  }
  throw new Error(`Unbundled MathJax font resource: ${name}`)
}

const adaptor = browserAdaptor()
RegisterHTMLHandler(adaptor)
const output = new SVG({ fontCache: 'none' })
const mathDocument = mathjax.document(document, {
  InputJax: new TeX({ packages: ['base', 'ams'] }),
  OutputJax: output,
})
document.head.append(output.styleSheet(mathDocument) as HTMLElement)

let pending = Promise.resolve()

export function renderMath(target: HTMLElement, latex: string): Promise<void> {
  const task = pending.then(async () => {
    const node = await mathjax.handleRetriesFor(() => mathDocument.convert(latex, {
      display: false,
      em: 16,
      ex: 8,
      containerWidth: 440,
    })) as HTMLElement
    node.setAttribute('aria-hidden', 'true')
    target.replaceChildren(node)
  })
  pending = task.catch(() => {})
  return task
}