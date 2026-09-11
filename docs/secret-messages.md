# Secret Messages

The top-right envelope button opens a separate, read-only collection of glyph messages. It is independent of puzzle progress. Visitors can search titles, reload the collection, and read the message bodies in the existing Dead Space glyph alphabet. Plain message bodies are not shown as visible text or image alt text.

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

The tracked database starts empty. Tests use temporary records and remove them afterward. Run `node --test tests/secret-database.test.mjs` for format, round-trip, tamper, and character validation checks.