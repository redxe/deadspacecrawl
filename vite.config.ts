import { defineConfig } from 'vite'
import { authoringServer } from './tooling/authoring-server.mjs'
import { parseCatalog, resolveCatalog } from './src/puzzles/catalog'
import { builtinPuzzles } from './src/puzzles/builtins'
import { validateExtensions } from './src/puzzles/extension-schema'
import { galleryServer } from './tooling/gallery-server.mjs'

export default defineConfig({
  base: './',
  plugins: [authoringServer((value: unknown) => {
    const catalog = parseCatalog(value)
    const puzzles = resolveCatalog(builtinPuzzles, catalog)
    if (!puzzles.length) throw new Error('At least one puzzle must be included in the website.')
    resolveCatalog(builtinPuzzles, catalog, true).forEach(validateExtensions)
    return catalog
  }), galleryServer()],
  server: {
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local-tools/**'] },
  },
})
