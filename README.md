# Signal Archive

A static, interactive puzzle terminal built with Vite, TypeScript, Three.js, and KaTeX. Cipher glyphs are extracted in the browser from `public/assets/characters.png` using the same token rules as the Python code in the parent folder.

## Run locally

```powershell
npm install
npm run dev
```

Production check:

```powershell
npm run build
npm run preview
```

## Entry Gate

New visitors complete three access seals before the active puzzle and solution archive become available. Progress is stored separately from puzzle records under `signal-archive.entry.v1`. Reloading resumes the current seal; completing the last seal remembers access on that browser. When browser storage is blocked, the flow still works for the current page, but access cannot persist through reload.

The first visit opens an incoming transmission with paced typing and a corrected typo. Completing or skipping it sets `signal-archive.first-contact.v1`. Radio static plays throughout the access seals after the first click or keypress, subject to browser audio permissions. The speaker button toggles audio and remembers the choice under `signal-archive.radio-muted.v1`; hidden tabs suspend audio and pause sequence timing.

The final password opens an animated Three.js aperture, fades the static into a chord, and then crossfades into the active puzzle. The skip control or Escape finishes either sequence immediately. Reduced-motion preferences show the introduction in full and replace the camera flight with a short confirmation. Audio resources and the aperture renderer are released after the transition. Unlock is saved immediately, so reloading during the celebration resumes the main puzzle.

To replay the full first-contact experience locally, remove both `signal-archive.entry.v1` and `signal-archive.first-contact.v1` in browser developer tools, then reload. Do not clear all local storage: puzzle history uses separate records. Sequence presentation and audio live in `src/entry-experience.ts`, with the flight renderer in `src/unlock-scene.ts`.

This is a **client-side puzzle gate, not secure authentication**. The password, puzzle checks, and protected content are part of the downloaded static application. Do not use this to protect confidential content. Actual password security requires server-side authentication and access-controlled content hosting, which GitHub Pages alone does not provide.

Authoring chain (spoilers):

1. `PESTO` maps to glyph indices `[15, 4, 18, 19, 14]`, using the parent chart's order and zero-based positions.
2. Five six-bit slots, highest slot first, produce `N = 252781774`: `(15n << 24n) | (4n << 18n) | (18n << 12n) | (19n << 6n) | 14n`.
3. `F(N) = (N + 37)^2 + 19` produces `63898643972439740`. Players reverse the function, unpack the indices, and decode the glyphs in that order.

The gate definitions and progressive hints live in `src/entry-gate.ts`. Calculations use `BigInt`: the encoded function value exceeds JavaScript's exact `Number` range. Console helpers `relay`, `pack`, `unpack`, `bits`, and `glyphs` are available while locked. Each has a detailed `help(command)` reference. `answer(value)` submits to the current seal before unlock and to the active puzzle afterward.

The console wrench opens `tools()`. Popout icons launch Inverse Function, Bit Slots, and Glyph Chart windows; the same icons appear on related help references. `tools("relay")`, `tools("bits")`, and `tools("glyphs")` also open them. Windows support pointer/touch dragging, keyboard movement, minimize/restore, close, and result copying. They never submit answers automatically. Reloading closes tools; advancing a seal preserves open tools and their working values.

For local replay, remove only the gate flag with `localStorage.removeItem('signal-archive.entry.v1')` in browser developer tools, then reload. Saved puzzle records are unaffected. Test the entry chain with `node --test tests/entry-gate.test.mjs`.

## Typing Feedback

Typing in editable fields produces short, quiet, sample-free keyboard clicks. Cursor movement and non-text controls remain silent. The top-bar volume icon mutes both the active music and typing sounds. It shares the music panel's volume state, so the panel mute button and volume slider stay synchronized with it. Unmuting restores the last nonzero music volume for this visit without restarting the song; a muted reload uses 25% when first unmuted. Mute persists as zero volume under `signal-archive.music.v1`; the old typing-only preference is no longer used. Radio keeps its separate control. Typing audio starts only after an editing gesture, pauses on hidden pages, and releases its resources when the page closes. Delayed audio permission does not replay old keystrokes.

Glyph transmissions react to the recovered-text input: entered matches glow green, mismatches glow red, and changed symbols gently pulse. Untyped symbols stay neutral. The mapping handles TH, SS, doubled-letter markers, multiple lines, and deletion; a matching partial digraph stays green while its next character is pending. Extra decoded characters flag the final symbol. Numeric challenges do not receive glyph feedback.

**Transmit** lights green only when all glyphs match and the existing whole-answer validation succeeds. Partial or incorrect answers do not enable the ready glow, and deleting a required character removes it immediately. This is visual feedback only: typing never submits an answer or records an attempt. Reduced-motion preferences preserve the colors without the pulses.

The implementation lives in `src/glyph-feedback.ts` and `src/typing-sounds.ts`, with integration in `src/main.ts`. Check it with `node --test tests/glyph-feedback.test.mjs tests/typing-sounds.test.mjs tests/entry-gate.test.mjs`.

Shared mute regression checks: `node --test tests/music-mute.test.mjs tests/music-player.test.mjs tests/typing-sounds.test.mjs`. These cover the top-right control reaching the active player, panel/slider synchronization, volume restoration, muting during engine loading, track changes, restored mute state, and listener cleanup.

## Music

The top-right music button becomes available after the PESTO entry celebration finishes. It is available immediately on returning visits with an unlocked gate, independently of whether the main cipher has been solved. Radio static stops before music starts. Playback is attempted automatically unless the player previously paused it; browsers that block autoplay require a click on Play in the music panel.

Five original, sample-free Strudel scores are included: Orbital Bloom, Night Transit, Glass Engine, Soft Return, and Signal Dawn. Select a track to switch songs. The panel includes play/pause, master volume, mute, and a player restart control. Closing the panel leaves playback running. Hidden tabs pause playback; returning resumes music only if it was playing before the tab was hidden.

Music also drives a translucent background visualizer: segmented cyan spectrum bars, amber peak markers, side meters, and a thin waveform trace. The full-screen canvas sits above the background atmosphere and below the puzzle at 48% opacity, with pointer events disabled. It samples the actual post-volume Strudel master output, not simulated beats, through 48 logarithmic frequency bands and 64 waveform points. The sandbox sends bounded, source-checked data using the parent page's 30fps clock, so it works with the music panel closed and alongside score highlighting. Muting, pausing, hidden tabs, and track replacement clear it; reduced-motion mode disables it. It does not add a second audible connection or change the music mix.

The renderer and styling live in `src/music-visualizer.ts` and `src/music-visualizer.css`; audio analysis stays in `src/music-player.ts`. Run `node --test tests/music-visualizer.test.mjs tests/music-player.test.mjs tests/music-mute.test.mjs` for analyser reuse, data validation, parent-clock updates, mute/pause behavior, and cleanup checks.

Each built-in score has a repeating **96-cycle arrangement** (384 beats, roughly 3-5.2 minutes depending on tempo), divided into six 16-cycle sections: a restrained opening, developing theme, variation, contrasting interlude, fuller reprise, and quieter return. These are not three copies of the old loop. Melodic phrases, accompaniment, percussion, and section levels change over the form. Orbital Bloom adds open voicings, drifting bell tones, and a low-register interlude. Night Transit develops a longer arpeggio melody around a beatless middle, then returns with answering voices. Glass Engine pairs rotating motifs with stereo percussion and a softer broken-chord passage. Signal Dawn builds through wider upper layers, drops to pads and sub-bass, and finishes with a reduced arrangement.

Soft Return is now **74 BPM in D minor**, with open minor triads and inversions, descending chord-tone melodies, subdued brush-like percussion, and more space between phrases. Melody, counterlines, accompaniment, and bass follow the same two-cycle harmonic changes. The old E/F clash and independent melodic progressions are removed. Shorter releases, reduced echo, and clipped accompaniment reduce notes spilling across chord changes. The quiet middle and ending contrast with a fuller but still gentle reprise.

The scores use Strudel's documented [conditional modifiers](https://strudel.cc/learn/conditional-modifiers/) (`arp` for harmony-aware lines, `lastOf` for phrase-ending reversals/fills, and `mask` for layer entrances), [time modifiers](https://strudel.cc/learn/time-modifiers/) (`iter`, `ply`, `euclidRot`, `swingBy`, and `ribbon`), and [continuous signals](https://strudel.cc/learn/signals/) (`sine.range(...).slow(...)` for periodic filter/pan/gain motion). Each score combines phrase-level gain movement with stronger section-level dynamics. Bass and kicks stay centered; complementary upper voices occupy opposing sides, while selected melodies, percussion, and ambience move slowly through the stereo field. `ribbon(0,96)` repeats the event arrangement and control values; synthesizer noise and lingering reverb/delay tails are not promised to be sample-identical. Updates affect built-ins only, not locally saved copies or custom songs.

Expand **Strudel score** to view or edit a composition. The plus button starts a new score; Play code auditions edits; Save stores the current custom song or creates a copy of a built-in track. Delete removes a custom song after confirmation. Unsaved edits are protected when switching tracks. Syntax failures appear in the player without modifying the puzzle.

The score box includes JavaScript syntax coloring and gold playback highlights for active Strudel mini-notation tokens, including simultaneous voices. Highlights use source locations from the evaluated pattern and the actual Strudel scheduler clock. They clear on pause, rests, or edits that differ from the playing score; **Play code** starts tracking the edited version. Normal text selection, wrapping, scrolling, and resizing are preserved. Arbitrary JavaScript statements without Strudel source locations are not highlighted as execution steps.

The parent page requests visual updates at up to 30 frames per second only while the score editor is open, the page is visible, and its code matches playback. This keeps highlights moving even when the playback iframe scrolls completely out of view. Pattern evaluation and source-range queries stay inside the sandbox; messages are source-checked and ranges are bounded. The overlay implementation lives in `src/music-editor.ts` and reuses the console's Highlight.js coloring.

Songs, selected track, volume, and playback preference are stored separately from puzzle history under `signal-archive.music.v1`. The library supports 30 custom songs, 80-character titles, and 20,000-character scores. If storage is blocked or full, changes remain available for the current page and a warning is shown. Erasing the puzzle archive does not erase music.

The locally bundled `@strudel/web` engine runs in a sandboxed iframe without same-origin access to the page or its local storage. Only run Strudel code you trust: custom JavaScript can still make network requests or consume CPU/audio resources. The built-ins require no external samples; custom `samples(...)` sources require network access and suitable CORS permissions. Music data lives in `src/music-library.ts`, the picker in `src/music-panel.ts`, and the isolated player in `src/music-player.ts`.

**Publication licensing:** `@strudel/web` is licensed **AGPL-3.0-or-later**. Strudel's [integration guidance](https://strudel.cc/technical-manual/project-start/#respect-the-license) describes source-distribution and compatible-license obligations for published applications that integrate it. Review and satisfy those requirements before deploying this application publicly. Adding the dependency does not establish a license for this project's original code or for its image assets.

Music regression checks: `node --test tests/music-library.test.mjs tests/music-player.test.mjs tests/music-editor.test.mjs tests/music-compositions.test.mjs`. The composition tests evaluate all 96 cycles with Strudel, check changing density, gain contrast, stereo spread and finite parameters, reject an unchanged 32-cycle repeat, and compare section boundaries across the full loop. A separate harmony test checks every pitched event in Soft Return against its current chord. Highlight tests cover timed source locations through rests and repeats, range merging and validation, source-checked messages, the parent-driven visual clock, and pause/close cleanup. They require Node 22.15+ (or Node 24) for the test-only ESM resolution hook used with Strudel's browser dependencies.

## Add a Puzzle

The second archive puzzle is **A Light Between Pairs**, a three-stage glyph-based Playfair cipher unlocked after **A Door in the Dark**. Its draggable square, pair worksheet, teaching resources, saved work, and validation conventions are documented in [docs/playfair-puzzle.md](docs/playfair-puzzle.md).

The third is **Across the Quantum Relay**, a measurement-free three-qubit circuit puzzle with draggable gates and controls, complex amplitude previews, universal state-transfer verification, and an AES-encrypted glyph transmission. Circuit conventions, the `jsqubits` simulator, AES format, persistence, and tests are documented in [docs/quantum-puzzle.md](docs/quantum-puzzle.md). Both interactive puzzles use live red/green glyph feedback.

The fourth is **What the Phases Remember**: decode an eight-qubit statevector with an inverse QFT, enter the recovered word using glyphs, pack its indices into an integer, and use the largest prime factor to decipher an RSA transmission. Tools, bit ordering, and authoring values are documented in [docs/fourier-puzzle.md](docs/fourier-puzzle.md).

The top-right **Secret Messages** collection is separate from puzzle solutions. Its local-only editor supports viewing, adding, editing, and deleting messages with glyph previews. Start it with `node .local-tools/server.mjs --port 4181`; publish only `public/secret-messages.enc.json`. The editor and encrypted backups are Git-ignored. See [docs/secret-messages.md](docs/secret-messages.md) for the workflow and the public-key obfuscation caveat.

1. Add one TypeScript file under `src/puzzles/` that default-exports a `Puzzle`.
2. Import it in `src/main.ts` and append it to `archivePuzzles` in prerequisite order. Replace the corresponding future placeholder in the path. `src/puzzles/active.ts` still identifies the first archive puzzle; changing it replaces that first puzzle rather than adding a stage.

Example puzzle:

```ts
import type { Puzzle } from './types'

const puzzle: Puzzle = {
  id: 'unique-file-safe-id',
  sequence: '03',
  kind: 'logic', // 'cipher', 'logic', or 'math'
  title: 'Puzzle title',
  summary: 'Short atmospheric setup.',
  objective: 'A direct instruction for the player.',
  blocks: [
    { type: 'divider', label: 'Recovered data' },
    { type: 'text', text: 'Normal readable text.' },
    { type: 'cipher', text: 'TEXT TO ENCODE' },
    { type: 'formula', latex: String.raw`n = \mathbb{P}[17]` },
    { type: 'code', code: 'const clue = 17' },
  ],
  answer: {
    accepted: ['answer', 'alternate answer'],
    label: 'Decoded value',
    placeholder: 'Enter the result',
    mode: 'text', // use 'number' to ignore commas and spaces
  },
  hints: ['First hint.', 'Second hint.'],
  consoleData: { clue: 17 },
}

export default puzzle
```

Cipher text automatically converts `TH`, `SS`, repeated letters, digits, `?`, and `!` to the provided glyphs. Use `[DBLLTR]` to insert the double-letter glyph explicitly.

The console exposes `puzzle`, `primes(k)`, `primes(start, end)`, `factor(number)`, `isPrime(number)`, `gcd(a, b)`, `answer(value)`, `clear()`, and `help()`. It runs in a dedicated worker behind a sandboxed iframe, keeping calculations off the page's UI thread. Helpers still return synchronous values within console commands; browser DOM APIs are not available in the worker.

Prime indices are one-based, following the parent notebook's definitions: `P[k] = p_k` and `pi(p_k) = k`. `primes(17)` inspects the 17th prime (59), displaying its index, prime-counting identity, neighboring primes, and sequence definition with locally bundled MathJax. It returns a record with `index`, `value`, `previous`, and `next`; use `primes(17).value` in calculations. The first prime has `previous: null`. `primes(17, 20)` returns `[59, 61, 67, 71]`, an inclusive range of **indices**, displayed as adjacent tiles labeled `p_17` through `p_20`. Range results remain ordinary arrays for further calculations.

The input includes JavaScript syntax colors and animated ghost examples that never execute automatically. While typing, Tab accepts a matching helper or history completion and Escape dismisses it. Enter runs the command; Shift+Enter inserts a newline. Up/Down navigates command history and restores the unfinished draft. Reduced-motion preferences disable ghost animation.

`help()` opens a clickable command directory. `help("primes")`, `help(primes)`, and `help("primes(index)")` open the same detailed reference, including arguments, return values, limits, examples, and mathematical notation where applicable. String command names are case-insensitive. Unknown names report the available commands.

Reference examples have separate insert and run controls. Inserting writes at the current selection and focuses the editor; running an example or opening a reference preserves the unfinished draft. Examples for `answer` and `clear` are insert-only to avoid changing puzzle state or removing output unexpectedly. Prime-range tiles open an inspection of that prime; numeric array and factor tiles insert their value into the editor. All output controls support keyboard navigation and have named tooltips. References gain additional reading space within the console.

Results retain their JavaScript types: factors appear as multiplication chains, prime ranges as indexed number tiles, scalars as values or boolean indicators, and objects as labeled rows. Commands display completion state and execution time. Previews show at most 80 array items or 30 object properties per level, with an overall depth and size limit; this does not truncate the actual runtime values. Single-argument `primes(k)` accepts integer indices from 1 through **10,000,000,000**. Two-argument `primes(start, end)` remains limited to indices from 1 through **10,000**, with the end index at least the start index. `factor` / `isPrime` accept magnitudes up to 1,000,000,000,000 to keep helper calculations responsive.

Large single-index lookups use exact Lehmer prime counting followed by a segmented sieve, without storing all preceding primes. `primes(10000000000).value` returns `252097800623`. The estimate only selects where to begin searching; the returned prime and its neighbors are exact. Runtime depends on the device. Run the engine regression tests with `node --test tests/prime-engine.test.mjs`.

Run command-reference and worker integration checks with `node --test tests/console-runtime.test.mjs`.

Solutions and attempts are stored in the player's browser with `localStorage`. Because this is a static site, accepted answers are present in the shipped JavaScript and are not tamper-proof.

## Deploy

1. Open [redxe/deadspacecrawl](https://github.com/redxe/deadspacecrawl) and go to **Settings > Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source. Do not select a branch or a `docs` folder.
3. Open **Actions > Deploy to GitHub Pages > Run workflow**, select `main`, and run it. If the initial push failed before Pages was enabled, rerun that workflow after changing the setting.
4. Wait for the deployment to succeed, then open **https://redxe.github.io/deadspacecrawl/**. Later pushes to `main` deploy automatically.

The workflow uses Node 24, installs locked dependencies with `npm ci`, runs the tests, builds the site, and uploads only `dist/`. Build output and `node_modules/` stay out of Git. Vite's relative asset base supports the repository subpath without further configuration. No deployment token or application secrets need to be added.

For a private repository, Pages availability depends on the GitHub plan. On GitHub Free, use a public repository after reviewing the source, assets, and publication licensing notes above. A public Pages site exposes its downloaded puzzle answers and keys regardless of repository visibility.
