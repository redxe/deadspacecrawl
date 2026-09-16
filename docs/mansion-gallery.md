# Five-Glyph Signal And Gallery

This document contains the fifth puzzle's answer and surprise reveal.

## Play And Revisit

**An Echo in Five** is a six-guess glyph Wordle with the fixed answer `ROBIN`. Each tile uses one letter from the existing atlas. Exact positions are green, letters elsewhere are gold, and absent letters are gray; accessible cell labels also report the result. Any five-letter guess is accepted. Duplicate letters consume only the occurrences present in the answer.

After six unsuccessful guesses, **Another round** clears the board. Retries are unlimited. Solving records ordinary puzzle completion, then fades to black for Fairy's first meeting. Her glowing body, translucent flapping wings and trailing particles accompany two glyph messages, advanced with the pulsing right arrow. After the invitation, walking and looking controls return immediately. Fairy flies independently through the hall and down the stairs at a followable pace; the player can follow, explore, or stay at the entrance. The introduction never moves or rotates the player camera. Flight routes vary each visit while staying inside the mansion.

There is no gallery link before solving. Afterward, **Return to the gallery** reopens the space, including after reload. Completed introductions are remembered separately under `signal-archive.fairy-introduction.v1.<puzzle-id>`; revisits skip the meeting and start at the entrance. Closing before the introduction finishes leaves it available next time. Preview only remembers completion for the current page. Reduced motion keeps both messages and a brief stationary fairy appearance, without teleporting the player.

Guesses, round count and the solved word use `signal-archive.glyph-wordle.v1.<puzzle-id>`. Invalid saved data is discarded; a stored boolean alone cannot unlock the gallery. Storage failures allow play for the current visit. Editor previews neither load nor save this progress. Normal puzzle prerequisites still apply outside preview.

## Controls

| Control | Action |
| --- | --- |
| Arrow keys or WASD | Walk forward/backward and strafe |
| Click the world, then move the mouse | Capture the mouse for continuous looking |
| Touch drag, or mouse drag if capture is unavailable | Look around |
| Mouse-pointer button | Toggle mouse capture |
| Escape | Release mouse lock; leave picture-editing mode |
| On-screen arrows | Hold to walk, including on touch devices |
| Fullscreen button | Enter or leave fullscreen when supported |
| Footprints button | Toggle walking bounce and ambient motion |
| Speaker button | Mute/unmute music and footsteps |
| Close button | Return to the solved puzzle |

The hallway leads down a staircase to the ballroom. Five other doors stay closed, with glazed glimpses of a furnished porch and garden, a study, a conservatory, a music room and a tea room. The porch is behind the player at the entrance. Collision prevents leaving the hall/stair/ballroom route. Picture-editing mode keeps ordinary frame clicks instead of capturing the mouse. Reduced-motion preferences disable bounce, ambient movement and the entry fade by default. WebGL2 is required; a failed reveal leaves the solved puzzle and its retry link available.

The selected Strudel score continues in the space. Distance from the ballroom center controls loudness, and facing direction controls master stereo pan. The normal volume slider is locked during the visit; mute remains available. Leaving restores the previous volume and centered master pan without replacing the song. Browser audio restrictions may require clicking the scene. Howler plays locally generated wood taps every 0.775 meters, alternating feet. Web Audio convolution is pre-rendered into short hall and longer ballroom reverb tails, blended along the stairs; mute stops the tails too. No external audio samples are needed.

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

The world loads only after solving or revisiting. Trees and repeated architecture use instancing; window light is simulated instead of realtime shadow maps. Each door contains a small instanced 3D scene rendered through its window at 512 by 640 pixels. Three.js's off-axis camera projection keeps the opening fixed while furniture and distant surfaces show proper depth parallax as the player moves. Views render only when nearby, front-facing, onscreen and changed; an unchanged viewpoint and light state reuse the previous frame. The four indoor rooms remain dim, with aperture-limited sunlight/lamp patches and soft window spill on furniture, floors and walls. Illumination follows surface orientation and material color, fading with distance from the window; no translucent light sheets float across the view. The entrance porch remains sunlit. Its roof and side railings connect back to the building, with continuous ground fading into haze, twelve clustered trees and one instanced draw for 2,800 grass blades clear of the deck and path. Doors never open and no additional navigable rooms are built. Rendering is capped below 45 fps with a 1.6 pixel-ratio limit. Hidden tabs stop the world loop, and the underlying puzzle renderer is skipped while the gallery is open. Fitted photo textures bound GPU memory. Renderers, controls, footsteps, door scenes, render targets and loaded textures are disposed on exit.

Hall and door windows share a lightly tinted transparent glass shader. Reflection bands, a small glint and angle-dependent edge reflectivity move with the viewer, without realtime reflection captures or extra room geometry. The player's shadow suppresses these highlights instead of leaving glare visible through the silhouette. This lives in `src/mansion/window-glass.ts`; it leaves the view and depth buffer unobstructed.

There is no rendered player body. `src/mansion/player-shadow.ts` uses a soft capsule-and-head shadow calculation for the sun and nearest lamp, limited to receivers within 14 meters. It works on floors, walls, doors and glass without shadow-map passes or an avatar mesh. Door views transform the same player and light positions into their local coordinates, so the shadow also affects light entering those rooms. `src/mansion/room-light.ts` approximates the window aperture and diffuse spill onto solid surfaces rather than performing full ray tracing. Existing wallpaper and grass shaders remain active underneath the shadow effect.

The environment replaces the flat spectrum overlay during gallery visits. The existing Strudel analyser supplies 48 frequency bands, grouped into smoothed bass, middle and treble responses. These deform the floral upper/geometric lower wallpaper motifs while leaving border edges fixed. Continuous wallpaper runs share materials and pattern coordinates, including the entrance wall; lower borders stop at doorways. Lower ambient light lets stronger sun, ballroom and colored sconce changes show clearly, with smoothed bass accents rather than flashing. Twelve lightweight shader cloud planes drift and change shape with the music above the forest. Tree/grass wind and window-light patches also respond. Lamp and pillar positions clear picture-frame edges. Grass uses one instanced draw for 8,400 tapered blades on both sides of the road. Pausing or muting lets the music response settle; reduced motion disables it. Implementation lives in `src/mansion/environment.ts`, `src/mansion/clouds.ts`, `src/mansion/door-views.ts` and `src/mansion/music-response.ts`; Fairy's sequence and bounded randomized route live in `src/mansion/fairy.ts` and `src/mansion/fairy-route.ts`.

Keep `ROBIN` as the accepted answer when editing this fixed preset. Changing the catalog answer alone does not change the engine target. For another variant, change the state module and tests together or implement a configurable extension.

```powershell
node --test tests/*.test.mjs
npm run build
```

Browser checks should include retries, reveal/revisit, desktop/mobile canvas pixels, walking both ways on the stairs, frame uploads, fullscreen, mute, directional audio, moving shadows on solid surfaces and glass, dark-room light spill, and close porch views. Check the solid wall after the final left window and the porch railing returns. State tests do not replace WebGL or browser audio checks.