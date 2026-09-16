# Puzzle Authoring

## Local Portal

Run `npm run dev` and open `http://localhost:5173/?admin` (use the port Vite prints if 5173 is occupied). The game also has a **Puzzle editor** link during development. The portal is excluded from production bundles, and `npm run preview` does not expose the write API.

1. Select an existing puzzle, or choose a template and click **New puzzle**. Copies get a new stable ID and independent workspace progress.
2. Edit the title, sequence label, category, summary and objective. Library order controls prerequisites; the sequence label is display text only.
3. Assemble ordered blocks in **Blocks**. Text, glyph transmissions, LaTeX, code display and dividers are data-driven. Code blocks display text; they never execute it.
4. Add accepted answers, input labels and ordered hints in **Answers**. Text matching ignores case, normalizes whitespace and strips trailing punctuation. Number mode also removes commas, underscores and spaces; it does not evaluate expressions.
5. Set structured values in **Console data**. Values can be strings, finite numbers, booleans, string arrays or number arrays. This is JSON data, not a JavaScript editor.
6. **Save draft** stores the entire working catalog on this browser. Incomplete puzzles can be saved. **Export draft** creates a portable JSON backup; **Import catalog** replaces the draft only after confirmation. Imports cannot load executable plugin code.
7. **Preview puzzle** opens the real gameplay renderer, bypasses entry prerequisites and disables puzzle-progress writes. Preset workspace state is neither loaded nor saved in preview. The normal shared music preferences still apply. **Back to editor** restores the saved draft.
8. **Publish to source** validates the catalog and writes `src/puzzles/catalog.json`. Reload the game to see local changes. Review the Git diff, run tests/build, and deploy through the existing website workflow to update the live site. Publishing does not commit, push or deploy anything.

**On website** controls inclusion in the player path. Hidden content is not secret: it is still shipped as catalog data. Deleting a built-in hides it without deleting its TypeScript file. **Restore source definition** replaces a built-in's draft with its current TypeScript definition. Custom puzzles can be deleted after confirmation. At least one valid puzzle must remain visible, and all catalog entries must be valid before publishing.

Publication is catalog-wide. Save unfinished work as a draft, or export it before reloading published content. A stale draft cannot overwrite a newer published file. On conflict, export the draft, reload published content, then reconcile the changes before publishing. Storage failures are reported; exporting remains available, and publishing does not depend on a successful browser backup.

## Ownership

| File | Responsibility |
| --- | --- |
| `src/puzzles/types.ts` | Puzzle and block contracts; final answer matching |
| `src/puzzles/catalog.ts` | Validation, merge, visibility, order, minimal overrides |
| `src/puzzles/catalog.json` | New puzzles and edited built-in overrides written by the portal |
| `src/puzzles/builtins.ts` | Code-authored puzzle registration |
| `src/puzzles/library.ts` | Published catalog resolution for gameplay |
| `src/puzzles/extension-schema.ts` | Node-safe custom-block definitions and settings validation |
| `src/puzzles/extensions.ts` | Browser custom-block contract and runtime mount registry |
| `src/admin/portal.ts` | Authoring controls generated from puzzle/extension definitions |
| `tooling/authoring-server.mjs` | Fixed-file local API, revision checks and atomic writes |

Unchanged built-ins are omitted from published overrides, so future edits to their source files still apply. An explicit catalog override wins over its built-in definition until restored. Keep IDs stable to preserve player progress. For substantially changed challenges, duplicate the puzzle to get a fresh ID rather than silently reusing previous solved records.

The entry seals, music library and Secret Messages are separate systems. Entry logic stays in `src/entry-gate.ts`; music and Secret Messages retain their existing editors and documentation. The portal is a puzzle-content editor, not a general source-file manager.

## Existing Interactive Presets

Playfair, quantum and Fourier/RSA blocks reuse the existing engines, workspaces and payloads. Only one of these preset workspaces can appear in a puzzle; custom blocks may be combined with it. Their puzzle titles, surrounding content, hints and final answer list are editable, but their cryptographic payloads and internal checks are code-defined. Changing the final answer field does not re-encrypt a preset's message.

For a different preset payload, follow `docs/playfair-puzzle.md`, `docs/quantum-puzzle.md` or `docs/fourier-puzzle.md`. For a reusable configurable variation, implement a registered custom block with typed settings. Do not fork `src/main.ts` for each new puzzle.

## Add Custom Functionality

Add the plugin's ID, title and settings to `extensionDefinitions` in `src/puzzles/extension-schema.ts`. Create a browser module under `src/puzzles/`, export a `PuzzleExtension`, then import it and add it to `puzzleExtensions` in `src/puzzles/extensions.ts`. Spread the shared definition into the runtime extension to avoid duplicating settings. The block picker and configuration form discover it automatically. The included `number-lock` / **Frequency lock** extension is a working example.

For a configurable acknowledgement block, first add this definition to the schema array:

```ts
{
  id: 'acknowledgement',
  title: 'Acknowledgement',
  fields: [
    { key: 'label', label: 'Label', type: 'text', default: 'Receiver calibrated' },
  ],
}
```

Then register this browser extension:

```ts
import { extensionDefinitions } from './extension-schema'
import type { PuzzleExtension } from './extensions'

export const acknowledgement: PuzzleExtension = {
  ...extensionDefinitions.find(extension => extension.id === 'acknowledgement')!,
  mount(config, context) {
    const element = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    const label = document.createElement('span')
    label.textContent = String(config.label)
    const update = () => context.setReady(input.checked)
    input.addEventListener('change', update)
    element.append(input, label)
    update()
    return {
      element,
      destroy() {
        input.removeEventListener('change', update)
        element.remove()
      },
    }
  },
}
```

Settings support `text`, `number` and `boolean`; number settings can declare `min` and `max`. Every field needs a stable `key`, label and typed default. Block config values are JSON scalars. New field types or nested configuration require a deliberate contract and form update, not injected HTML or scripts.

`mount` runs in the browser and returns an element plus cleanup. Only the schema is imported by publishing/build validation: it must contain plain data and pure validation, with no browser modules or CSS imports. The browser registry can lazily import heavier workspaces and their scoped styles; the glyph Wordle is an example. Put DOM creation and rendering work inside `mount`, not at module scope.

Call `context.setReady(false)` while an interaction is incomplete and `true` only when it passes your custom checks. Every interactive block must be ready before final answer submission, including submissions from the console. The normal accepted-answer matcher still checks the final answer. For a purely interactive puzzle, use a fixed completion word as the final answer and reveal it after your block succeeds.

An interactive block may call `context.complete?.(answer)` after setting itself ready to submit through the normal matcher. Optional `context.audio` methods provide shared mute/resume controls and a distance gain/pan override; restore `setSpatial(null)` when leaving an immersive view.

The **Five-glyph signal** is a fixed custom preset: retain `ROBIN` as its accepted answer. Its retries, surprise gallery and local photo editing are documented in [mansion-gallery.md](mansion-gallery.md).

`context.puzzle.id` is a stable namespace for optional custom persistence. Never read or write player progress when `context.preview` is true. Dispose listeners, timers, renderers and subscriptions in `destroy`; puzzle switches invoke it. Use a proven engine for domain logic when one exists. Add behavior tests under `tests/` for your engine and workspace state.

Plugin code is trusted application code, not sandboxed user input. Catalogs name already-registered plugins; they cannot import URLs or execute strings. Unknown plugins or invalid settings block publishing, fail the build and render a blocked state if encountered at runtime.

## Validation And Security

```powershell
node --test tests/*.test.mjs
npm run build
```

The build validates the same catalog and extension settings as publishing. The dev API accepts only loopback connections with a local Host header, rejects foreign browser origins and cross-site requests, and requires a per-process token for writes. It writes one fixed catalog path, caps requests at 2 MB, checks a content revision and uses an atomic replacement. This is a local authoring boundary, not remote administrator authentication. Do not expose or reverse-proxy the Vite server to the public internet.

Answers and plugin checks remain client-side and inspectable. Remote multi-user authoring would require a separate authenticated service, authorization, durable storage and a deployment integration; the static website alone cannot provide that.