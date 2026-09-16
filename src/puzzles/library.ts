import { builtinPuzzles } from './builtins'
import catalog from './catalog.json'
import { parseCatalog, resolveCatalog } from './catalog'

export { builtinPuzzles } from './builtins'
export const publishedCatalog = parseCatalog(catalog)
export const publishedPuzzles = resolveCatalog(builtinPuzzles, publishedCatalog)