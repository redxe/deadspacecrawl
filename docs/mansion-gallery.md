# Five-Glyph Signal And Gallery

This document contains the fifth puzzle's answer and surprise reveal.

## Play And Revisit

**An Echo in Five** is a six-guess glyph Wordle with the fixed answer `ROBIN`. Each tile uses one letter from the existing atlas. Exact positions are green, letters elsewhere are gold, and absent letters are gray; accessible cell labels also report the result. Any five-letter guess is accepted. Duplicate letters consume only the occurrences present in the answer.

After six unsuccessful guesses, **Another round** clears the board. Retries are unlimited. Solving records ordinary puzzle completion, then fades into the gallery. There is no gallery link before solving. Afterward, **Return to the gallery** reopens the space, including after reload. Each visit starts at the entrance.

Guesses, round count and the solved word use `signal-archive.glyph-wordle.v1.<puzzle-id>`. Invalid saved data is discarded; a stored boolean alone cannot unlock the gallery. Storage failures allow play for the current visit. Editor previews neither load nor save this progress. Normal puzzle prerequisites still apply outside preview.

## Controls

| Control | Action |
| --- | --- |
| Arrow keys or WASD | Walk forward/backward and strafe |
| Mouse drag or touch drag | Look around |
| Mouse-pointer button | Lock the mouse for continuous looking |
| Escape | Release mouse lock; leave picture-editing mode |
| On-screen arrows | Hold to walk, including on touch devices |
| Fullscreen button | Enter or leave fullscreen when supported |
| Footprints button | Toggle walking bounce and ambient motion |
| Speaker button | Mute/unmute music and footsteps |
| Close button | Return to the solved puzzle |

The hallway leads down a staircase to the ballroom. Other doors are intentionally closed scenery. Collision prevents leaving this route. Reduced-motion preferences disable bounce, ambient movement and the entry fade by default. WebGL2 is required; a failed reveal leaves the solved puzzle and its retry link available.

The selected Strudel score continues in the space. Distance from the ballroom center controls loudness, and facing direction controls master stereo pan. The normal volume slider is locked during the visit; mute remains available. Leaving restores the previous volume and centered master pan without replacing the song. Browser audio restrictions may require clicking the scene. Footsteps are generated locally and played through Howler, with no external audio samples.

## Add Pictures Locally

1. Run `npm run dev` and open the URL Vite prints with `?admin` appended.
2. Select **An Echo in Five**, then **Preview puzzle**. Solve it to enter without changing player progress.
3. Toggle **Edit pictures**. Approach a frame and click its `+`, or click an existing photo to replace it.
4. Choose a JPEG, PNG or WebP under 30 MB. The browser fits a copy within 1600 pixels, converts it to JPEG and removes source metadata. The original file remains untouched.
5. Wait for **Picture saved to source.** The frame updates immediately, and reopening loads the saved picture.
6. Review and include `public/mansion-gallery.json` and its referenced `public/mansion-images/` files when committing and deploying.

There are seven hall frames and ten ballroom frames. Pictures fit inside a mat rather than being cropped. To clear a frame, remove its entry from the manifest. Replaced image files are not automatically deleted; remove unreferenced files deliberately before publishing if they should no longer be distributed.

**Published photos are public assets.** The puzzle gate is not access control, and even unreferenced files under `public/` are deployed. Only publish photos you have permission to share. The picture editor is development-only; production and `npm run preview` have no write API.

The local API checks loopback origin/host, requires a process token, limits file types and sizes, restricts frame IDs, and checks manifest revisions before atomic writes. Conflicting edits are rejected; toggle editing off and on to reload the latest revision. Do not expose the development server to the internet.

## Implementation

| Module | Responsibility |
| --- | --- |
| `src/puzzles/five-glyph-signal.ts` | Metadata and fixed completion answer |
| `src/puzzles/glyph-wordle-state.ts` | Scoring, retries and saved-state validation |
| `src/puzzles/glyph-wordle.ts` | Glyph board, reveal and revisit lifecycle |
| `src/mansion/layout.ts` | Collision, stair elevation, frame IDs, seed and audio geometry |
| `src/mansion/scenery.ts` | Architecture, textures, seeded forest, road and yard |
| `src/mansion/world.ts` | Camera, input, fullscreen, pictures and cleanup |
| `src/mansion/footsteps.ts` | Seeded waveform and Howler playback |
| `src/mansion/pictures.ts` | Manifest, image fitting and authoring client |
| `tooling/gallery-server.mjs` | Local image and manifest writes |

The Wordle adapter uses `@socnik/wordle-engine` with an occurrence-count correction for duplicate scoring. Scenery uses `seedrandom` with `robin-gallery-2026`. Changing that seed changes the scenery consistently across visits. No external image/model downloads are needed for the empty gallery.

The world loads only after solving or revisiting. Trees and repeated architecture use instancing; window light is simulated instead of realtime shadow maps. Rendering is capped below 45 fps with a 1.6 pixel-ratio limit. Hidden tabs stop the world loop, and the underlying puzzle renderer is skipped while the gallery is open. Fitted photo textures bound GPU memory. Renderers, controls, footsteps and loaded textures are disposed on exit.

Keep `ROBIN` as the accepted answer when editing this fixed preset. Changing the catalog answer alone does not change the engine target. For another variant, change the state module and tests together or implement a configurable extension.

```powershell
node --test tests/glyph-wordle.test.mjs tests/mansion-layout.test.mjs tests/gallery-server.test.mjs tests/music-mute.test.mjs tests/music-player.test.mjs
npm run build
```

Browser checks should include retries, reveal/revisit, desktop/mobile canvas pixels, walking both ways on the stairs, frame uploads, fullscreen, mute, and directional audio. State tests do not replace WebGL or browser audio checks.