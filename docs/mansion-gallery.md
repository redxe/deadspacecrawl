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

The selected Strudel score continues in the space until Robin's performance begins. Distance from the ballroom center controls loudness, and facing direction controls master stereo pan. The normal volume slider is locked during the visit; mute remains available. Leaving restores the previous volume and centered master pan; a temporary Robin performance also restores the previously selected song and playback preference. Browser audio restrictions may require clicking the scene. Howler plays locally generated wood taps every 0.775 meters, alternating feet. Web Audio convolution is pre-rendered into short hall and longer ballroom reverb tails, blended along the stairs; mute stops the tails too. No external audio samples are needed.

## Add Pictures Locally

1. Run `npm run dev` and open the URL Vite prints with `?admin` appended.
2. Select **An Echo in Five**, then **Preview puzzle**. Solve it to enter without changing player progress.
3. Toggle **Edit pictures**. Approach a frame and click its `+`, or click an existing photo to replace it.
4. Choose a JPEG, PNG or WebP under 30 MB. The browser fits a copy within 1600 pixels, converts it to JPEG and removes source metadata. The original file remains untouched.
5. Wait for **Picture saved to source.** The frame updates immediately, and reopening loads the saved picture.
6. Review and include `public/mansion-gallery.json` and its referenced `public/mansion-images/` files when committing and deploying.

There are seven hall frames and ten ballroom frames. Pictures fit inside a mat rather than being cropped. To clear a frame, remove its entry from the manifest. Replaced image files are not automatically deleted; remove unreferenced files deliberately before publishing if they should no longer be distributed.

### Curated Photo Collection

The gallery contains all 20 images from the supplied Ferry collection, each used once across 17 frames. Personal portraits run along the hall, with a paired pet collage and a graduation/formal-photo diptych. The ballroom's far wall balances the commissioned artwork and glyph poster with two landscape images; the virtual-world messages are grouped on the side walls, including a stacked two-image collage. The formula image uses a wide, shallow frame rather than being cropped into a portrait.

Frames mix portrait, landscape, near-square and panoramic proportions, with brass, silver and dark surrounds and light or dark mats. Their outer bounds clear door trim, chair rails, columns, sconces and neighboring frames. The fitted canvas follows the actual frame ratio, so changing a frame's shape no longer stretches the image. Source images are fully retained, orientation-corrected and fitted without cropping; collages use narrow gutters and preserve each member's proportions.

`tooling/populate-gallery.mjs` stores the explicit frame assignment. To regenerate optimized WebP copies from the original directory, run `node tooling/populate-gallery.mjs "C:\path\to\Ferry"`. The tool uses Sharp, limits each output to 1600 pixels on its longest side, removes metadata, preserves PNG artwork/text losslessly after any resize, and never modifies the originals. Generated filenames are content-hashed; old unreferenced assets are not deleted automatically. `tooling/gallery-contact-sheet.mjs` creates a local inspection sheet under `test-results/`, outside the public assets.

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
| `src/mansion/robin-fountain.ts` | Ballroom countdown, fountain, gravity-driven jets and violet flames |
| `src/mansion/fountain-water.ts` | GPU shallow-water height field and water surface |
| `src/mansion/footsteps.ts` | Seeded waveform and Howler playback |
| `src/mansion/pictures.ts` | Manifest, image fitting and authoring client |
| `tooling/gallery-server.mjs` | Local image and manifest writes |

The Wordle adapter uses `@socnik/wordle-engine` with an occurrence-count correction for duplicate scoring. Scenery uses `seedrandom` with `robin-gallery-2026`. Changing that seed changes the scenery consistently across visits. No external image/model downloads are needed for the empty gallery.

The world loads only after solving or revisiting. Trees and repeated architecture use instancing; window light is simulated instead of realtime shadow maps. Each door contains a small instanced 3D scene rendered through its window at 512 by 640 pixels. Three.js's off-axis camera projection keeps the opening fixed while furniture and distant surfaces show proper depth parallax as the player moves. Views render only when nearby, front-facing, onscreen and changed; an unchanged viewpoint and light state reuse the previous frame. The four indoor rooms remain dim, with aperture-limited sunlight/lamp patches and soft window spill on furniture, floors and walls. Illumination follows surface orientation and material color, fading with distance from the window; no translucent light sheets float across the view. The entrance porch remains sunlit. Its roof and side railings connect back to the building, with continuous ground fading into haze, twelve clustered trees and one instanced draw for 2,800 grass blades clear of the deck and path. Doors never open and no additional navigable rooms are built. Rendering is capped below 45 fps with a 1.6 pixel-ratio limit. Hidden tabs stop the world loop, and the underlying puzzle renderer is skipped while the gallery is open. Fitted photo textures bound GPU memory. Renderers, controls, footsteps, door scenes, render targets and loaded textures are disposed on exit.

Hall and door windows share a lightly tinted transparent glass shader. Reflection bands, a small glint and angle-dependent edge reflectivity move with the viewer, without realtime reflection captures or extra room geometry. The player's shadow suppresses these highlights instead of leaving glare visible through the silhouette. This lives in `src/mansion/window-glass.ts`; it leaves the view and depth buffer unobstructed.

There is no rendered player body. `src/mansion/player-shadow.ts` uses a soft capsule-and-head shadow calculation for the sun and nearest lamp, limited to receivers within 14 meters. It works on floors, walls, doors and glass without shadow-map passes or an avatar mesh. Door views transform the same player and light positions into their local coordinates, so the shadow also affects light entering those rooms. `src/mansion/room-light.ts` approximates the window aperture and diffuse spill onto solid surfaces rather than performing full ray tracing. Existing wallpaper and grass shaders remain active underneath the shadow effect.

The environment replaces the flat spectrum overlay during gallery visits. The existing Strudel analyser supplies 48 frequency bands, grouped into smoothed bass, middle and treble responses. These deform the floral upper/geometric lower wallpaper motifs while leaving border edges fixed. Continuous wallpaper runs share materials and pattern coordinates, including the entrance wall; lower borders stop at doorways. Lower ambient light lets stronger sun, ballroom and colored sconce changes show clearly, with smoothed bass accents rather than flashing. Twelve lightweight shader cloud planes drift and change shape with the music above the forest. Tree/grass wind and window-light patches also respond. Lamp and pillar positions clear picture-frame edges. Grass uses one instanced draw for 8,400 tapered blades on both sides of the road. Pausing or muting lets the music response settle; reduced motion disables it. Implementation lives in `src/mansion/environment.ts`, `src/mansion/clouds.ts`, `src/mansion/door-views.ts` and `src/mansion/music-response.ts`; Fairy's sequence and bounded randomized route live in `src/mansion/fairy.ts` and `src/mansion/fairy-route.ts`.

### Shared Entrance Exterior

The entrance porch now belongs to the main outdoor scene, not an independent door-view render target. Its roof, garden, chairs and railings share the hallway exterior's lights, fog, sky, sun, moon and stars. A real glazed opening through the entrance door and back wall reveals that geometry with natural parallax. The entrance remains closed to walking. During Robin's night, the porch darkens with the rest of the world and the same stars appear beyond its roof. Only the four indoor door rooms retain separate render targets and independent dim lighting. The porch lawn stays outside the building footprint.

### Robin's Night

Stay anywhere inside the ballroom for 194 continuous seconds (3 minutes, 14 seconds) to begin a 12-second fade into night. A gold arc fills around the ballroom's floor circle as the wait advances. When it finishes, a golden **R** from the existing glyph atlas fades onto the floor; it remains until the fountain takes its place. Leaving the ballroom before the trigger resets both the timer and arc. Hidden tabs and picture editing pause event timing. Movement within the ballroom does not reset the wait. After triggering, the night lasts until leaving or choosing **Start from beginning** after the performance.

The entire rendered world, including photos and door-room views, passes through a dark white/gold/violet treatment. Daytime clouds fade away, the sun is replaced by a procedural moon, and 1,800 stars twinkle around a faint galactic sky. A soft gold-white trail and floor thread point back along the stairs and hall without moving the camera. Existing music fades to zero through its spatial gain; quiet synthesized chimes take over. Mute, visibility changes and closing the gallery also silence the chimes, and leaving the gallery restores normal music volume behavior.

Once the fade finishes, stand within 0.7 meters of the original spawn point (`x: 0, z: 1.3`) for 3.14 continuous seconds. The ground aura fills during that hold. Stepping out resets it immediately. Completion emits a five-second expanding light ring and echo across the floors, doors and walls, using the scene depth buffer. This unlocks **Robin** in the music library and immediately starts its performance, shutting down the chimes. The sample-free Strudel electronic song is `robinSong` in `src/music-library.ts`; its score can also be opened and saved as a new composition in the music editor.

Normal play persists the unlock separately under `signal-archive.robin-unlocked.v1`. Editor preview unlocks last only for the current page and do not change player progress. Blocked storage retains the reward for the current page. Repeating the event does not duplicate the song. Reduced motion keeps the stars and trail still and replaces the traveling pulse with a gentle glow; timing and the unlock remain unchanged. The state machine, renderer and chimes live in `src/mansion/robin-state.ts`, `src/mansion/robin-night.ts` and `src/mansion/night-chimes.ts`.

### Robin's Performance

The trail reverses toward the ballroom without moving the player. Robin remains audible throughout the mansion at a fixed centered gain, and mute still applies. The wallpaper borders become gold/violet waveform traces; stars, trees, grass, lamps and fountain respond to the same smoothed music bands. A tiered stone-and-gold fountain rises from the ballroom circle over the first six seconds, surrounded by flickering violet flames. Its collision boundary activates immediately and keeps the player outside the basin and flame ring, including if the player is already inside its footprint.

Twelve jet heights and smaller outward splashes follow frequency groups from the actual audio. Bass and drum onsets add a restrained splash accent and broad, soft gold pulses originating at the fountain. The pulses use the existing depth reconstruction to travel over solid surfaces, at substantially lower intensity than the unlock pulse. Duplicate cues are suppressed and only three fading rings are retained. Reduced motion disables these traveling pulses.

During sung words, glyph karaoke appears above the walking controls. A gold fill follows each word's syllables; previous words stay filled and upcoming words remain dim. Timing and text come from the played vocal events, not a separate hard-coded lyric timeline. The louder lead wins over harmony, and rests, mute, pause and the song ending hide the display. It uses the existing Dead Space-style glyph atlas, with a plain-text accessible label.

The basin uses Three.js `GPUComputationRenderer` for a 64 by 64 damped shallow-water height field, with fixed 120 Hz simulation steps, bounded frame catch-up, jet forcing and slope-derived surface normals. This is a surface-wave approximation, not a full three-dimensional fluid solver. Separate gravity-driven particles form the arcing jets. Unsupported GPU computation falls back to a static basin surface. Reduced motion presents a fully raised fountain with still jets, flames and water; the countdown and song timing continue normally.

The show follows Strudel's playback clock for one 56-bar arrangement, about 129 seconds at 104 BPM, plus a short release tail. It does not loop. Hidden-page suspension preserves the current song position, and muted playback can still finish. A **Play Robin** recovery control appears if audio permission or loading prevents playback. The performance is temporary and does not overwrite the normal selected-track preference.

The old track is muted, paused and disposed before Robin is mounted. The performance transport is pinned to Robin, and callbacks from replaced players cannot overwrite its state, lyrics or spectrum. Retired players also reject delayed initialization and play requests. Closing or restarting the journey restores the previous track only after retiring Robin.

When the song ends, the fountain settles and three buttons appear in front of it when viewed from the ballroom: **Restart song** replays the performance, **Start from beginning** restores daylight, the entrance position and the full waiting/return sequence, and **Command center** leaves the gallery. Restarting the journey keeps the already earned library unlock. All fountain geometry, GPU targets, shaders and chime resources are released when leaving.

### Editing Robin

Robin is an original 56-bar, 104 BPM soft electronic arrangement in `robinSong`, with G, C, F and Am chords, rounded sub-bass, filtered wobble, gently gated pads, sine arpeggios, electronic kicks, half-time snares and bell answers. The two verses, repeated choruses, bridge, melody and G outro are retained. Both unlock notifications have a music-note icon.

Edit the single-quoted strings in `lyrics` to change the words. Each line automatically occupies two bars with a held final syllable and a breath; `~` inserts an extra rest. The shipped lines have eight syllables each. `tune` contains MIDI pitches for each line, `pronunciation` accepts ARPABET overrides for names or unusual words, and `formant` changes the vocal resonance independently of pitch. `mix` sets individual instrument, lead and harmony levels. The default voice has a softened feminine register, gently shifting formants, breath, consonant noise and restrained vibrato. It is intentionally retro synthetic singing, not a recording, voice clone or natural-speech engine; pronunciation clarity varies with word length and pitch. Unknown words report a pronunciation error instead of silently substituting syllables.

The revised words draw on the direct affection, vulnerability and relief in the archived poems **Accidentally In Love** and **Driving at Night**, plus the opening-door and "ferry tales" puzzle answers. Robin/robbing is an audible name pun: the override gives "robbing" a gentle dropped-G pronunciation. Nest imagery, armor/arms and the early-bird bridge keep the wordplay affectionate. The source poems and encrypted database are unchanged.

### Robin Mix Notes

The vocal uses selective consonant-level reduction (about 5 dB less S/SH noise), a gentler harmonic slope, broader formant bands with less upper-band gain, a -4 dB shelf at 3.2 kHz and a low-pass at 7.6 kHz. A 25 ms onset, smoother phoneme transitions and a 35 ms release extension reduce abrupt edges. This is phoneme-aware gain scheduling and static tone shaping, not a threshold-detecting de-esser or a compressor. The score lowers the formant multiplier to 1.04 and caps the lead at G5, retaining the feminine range without the former A5 peaks.

The lead is lowered from 0.62 to 0.54 (about 1.2 dB), with harmony at 0.08. Backing gain still drops 20% in sung sections; the bridge is quieter and the final chorus grows only slightly. A 150-850 Hz wobble filter and restrained sub-bass support the synthetic voice without bright distortion. Pads and arpeggios stay filtered, and bell answers enter after the held word. Vocal reverb remains short and low. The backing has a subtle 0.02 swing; vocals remain unswung because swinging irregular syllable durations can split an onset and double-trigger a word. Generated notes and gain accents use numeric `fastcat` patterns rather than runtime strings, which Strudel does not automatically parse as mini-notation.

Engineering references consulted:

- [RaneNote 155, Dynamics Processors: Technology & Applications](https://www.ranecommercial.com/legacy/note155.html), especially chapters 4 and 8: preserve sibilant-to-vowel balance at different levels, leave the vocal audible against accompaniment, and avoid heavy compression that hardens the sound or pumps. Since phonemes and section boundaries are known in this synth, the score controls their gains directly instead of adding a broadband compressor.
- [De-essing overview](https://en.wikipedia.org/wiki/De-essing): target brief sibilant energy while avoiding excessive reduction that damages consonant articulation. The shelf is a separate timbral choice, not the de-essing mechanism.

Regression checks cover exact syllable counts, the Robin/robbing pronunciation, numeric bass and picking events, instrumental answers after breath gaps, section gains, note range, a repeatable 56-bar loop, and synth cleanup. Browser audio checks measure finite output and clipping; they do not establish subjective beauty or human lyric intelligibility.

The score uses this application's `robinVoice` helper, installed by `src/robin-voice.ts` inside the isolated Strudel player. The CMU pronunciation dictionary is a separate lazy-loaded dependency used only by scores that call that helper; only the words present in the score are sent to the player. Ordinary instrumental songs do not load it. Editing and playing the score reloads the necessary pronunciations. The synth uses a periodic carrier, three formant bands, shaped noise and scheduled envelopes without external audio samples. Pause, mute, track changes and player disposal use the existing transport and audio-context lifecycle.

Keep `ROBIN` as the accepted answer when editing this fixed preset. Changing the catalog answer alone does not change the engine target. For another variant, change the state module and tests together or implement a configurable extension.

```powershell
node --test tests/*.test.mjs
npm run build
```

Browser checks should include retries, reveal/revisit, desktop/mobile canvas pixels, walking both ways on the stairs, frame uploads, fullscreen, mute, directional audio, moving shadows on solid surfaces and glass, dark-room light spill, and close porch views. Check the solid wall after the final left window and the porch railing returns. State tests do not replace WebGL or browser audio checks.