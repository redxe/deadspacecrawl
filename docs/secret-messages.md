# Secret Messages

The top-right envelope button opens a separate collection of glyph messages, independent of puzzle progress. Visitors can search titles and reload the collection. Each compact entry shows a title, date, and clipped glyph preview; selecting it opens a separate scrollable message dialog. Back, Close, or Escape returns to the list and restores focus to the selected entry. The collection behind the message remains inactive until the message closes.

Visitors decode directly over the glyphs. Each glyph has an inline text input; correct completed entries turn green and mistakes turn red. Combined TH/SS glyphs accept two characters, while a double-letter marker accepts the repeated letter. Partial matching input remains neutral until complete. Typing advances automatically, arrow keys move between glyphs, and Backspace on an empty input returns to and clears the previous glyph. Pasting a sentence distributes its letters across the glyphs, ignoring spaces and unsupported punctuation. Completion is automatic, with no separate answer field or submission button.

Partial and completed entries save automatically in browser local storage under `signal-archive.secret-progress.v1.<message-id>` and return after closing the collection or reloading the page. Progress is specific to this browser and site, not synced between devices. Each entry is tied to the message's `updatedAt` revision; an edited message starts fresh. Only entered letters and the revision are saved, not the answer text or a trusted completion flag. Restored letters are checked again against the current message. Clearing this site's browser storage removes the saved progress. If storage is blocked or full, decoding still works but persistence is unavailable.

Correct entries fade their background glyphs away, leaving the visitor's green letters readable. Editing or erasing an entry brings its glyph back when it no longer matches. Reduced-motion preferences make this change immediate. The underlying plaintext is not revealed automatically or placed in input labels or image alt text. Entered letters are stored unencrypted locally, but no decoding progress changes the encrypted message database. The archive puzzles retain their own answer/submission workflow.

Finishing a transmission during entry triggers a brief light sweep, a warm border glow, and a burst of 40 light particles inside the message dialog. The burst lasts less than four seconds, runs once per opening, and never replays on restored completion. It cannot intercept typing or navigation; closing the dialog, invalidating an entry, or enabling reduced motion cancels and removes it.

Completed letters have an iridescent mint, champagne, rose, and blue finish that shifts gradually on an 18-second alternating cycle. Small phase offsets across letters give the finish a pearlescent variation. The finish remains on restored messages, while editing an incorrect entry restores the ordinary red feedback immediately. The gradient is an aria-hidden visual copy of the entered text; the original inputs remain editable and accessible. Reduced-motion settings keep a static gradient and completion accents without particles, moving color, or a light sweep.

## Local Authoring

The local editor lives in `.local-tools/`, which is ignored by Git and denied by Vite's file server. It is not copied into the production build. It is available only on this workstation; keep a private backup of the folder if you need it after a fresh clone.

From the project root, using Node 24:

```powershell
node .local-tools/server.mjs --port 4181
```

Open **http://127.0.0.1:4181/**. The editor lists existing messages and supports adding, editing, deleting, and previewing their glyphs. Saving encrypts the database on disk. Reload reads the latest file. Unsaved edits require confirmation before switching messages or reloading. A stale revision from another editor tab is rejected rather than overwriting newer work.

Only A-Z, digits, spaces, line breaks, `?`, and `!` are valid message characters. Apostrophes and other unsupported punctuation are rejected, not silently discarded. Titles contain 1-80 characters; each body allows up to 4000 characters; the collection allows up to 100 messages.

The server binds to `127.0.0.1` only, validates the Host and Origin headers, requires a per-session anti-CSRF token for writes, restricts file routes, and sends no-cache headers. Saves use encrypted backups in `.local-tools/backups/` followed by replacement of the database file. Neither plaintext drafts nor API session tokens are written to disk. An unreadable or unauthenticated database is not silently replaced.

Use another port with `--port` if 4181 is occupied. Stop the server with Ctrl+C. The local regression test uses a temporary database and can be run with `node --test .local-tools/editor.test.mjs`.

## Publish Changes

Only the encrypted file `public/secret-messages.enc.json` is published. After saving in the editor:

```powershell
git add public/secret-messages.enc.json
git commit -m "Update secret messages"
git push
```

The existing Pages workflow rebuilds and deploys it. A running production preview uses the last build; run `npm run build` to refresh its database copy. The Vite development server reads the current public file directly.

## Encryption Boundary

As requested, visitors do not enter a passphrase. The AES-256-GCM key is included in the public client so messages can open directly as glyphs. **This is obfuscation and corruption detection, not confidentiality or author authentication against a determined visitor.** The titles and bodies are encrypted on disk, but a visitor can obtain the key and decode or forge a downloaded copy. Repository write access, not this key, controls which database is deployed.

Each save creates a fresh 12-byte IV. The JSON envelope contains version 1, base64 IV, and base64 ciphertext with its 128-bit GCM tag appended. There is no additional authenticated data. HTTPS or localhost is required for Web Crypto. No real credentials or confidential information belong in this collection.

The tracked database starts empty. Tests use temporary records and remove them afterward. Run `node --test tests/secret-database.test.mjs tests/secret-glyph-input.test.mjs tests/secret-progress.test.mjs tests/secret-celebration.test.mjs` for format, round-trip, tamper, character validation, glyph mapping, defensive progress storage, and particle lifecycle checks. Browser checks cover modal navigation, rapid reopening, typed corrections, multi-character glyphs, sentence paste, progress restoration, glyph fading, iridescence, particle rendering/cleanup, reduced motion, title filtering, and long-message scrolling at desktop and phone widths.