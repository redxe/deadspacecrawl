# Quantum Relay Puzzle

**Across the Quantum Relay** is the third archive puzzle, unlocked after **A Light Between Pairs**. The player builds a measurement-free circuit mapping every input `|x00>` to `|00x>`, recovers an AES key, decrypts a glyph transmission, and submits its text.

## Circuit Rules

The top wire is qubit 1 and the leftmost ket bit. The bottom wire is qubit 3 and the rightmost bit. The simulator adapter maps these wires to jsqubits bits 2, 1, and 0 respectively. The MIT-licensed `jsqubits` package provides state evolution; no measurement or sampling is used.

Twelve columns run left to right. Each column supports independent H/X/Z gates on separate wires, or exactly one control paired with one X/Z target. Empty columns do nothing. Gates and controls support mouse/touch dragging, tap placement, keyboard selection, moving, erasing, undo, and redo. The field manual explains the operations and coherent corrections without supplying a complete circuit.

The input is `cos(theta/2)|0> + exp(i phi) sin(theta/2)|1>`, with angles entered in degrees. Presets and a column scrubber expose all eight complex amplitudes and probabilities. Preview fidelity is for the selected state only, not a proof of universal transfer.

Verification checks both basis inputs, including reset sending wires and matching target amplitudes up to one common global phase. By linearity, that verifies every superposition. Independent phases on the two basis outputs are rejected. Equivalent correct circuits are accepted, including parallel final cleanup Hadamards. This is coherent state transfer with interacting wires, not faster-than-light communication.

## Encrypted Transmission

Successful verification reveals a 32-byte key as 64 hexadecimal characters. The built-in decryptor uses Web Crypto AES-256-GCM, a 12-byte hexadecimal IV, a 128-bit authentication tag appended to the base64 ciphertext, and no additional authenticated data. Authentication failures reveal no plaintext. Web Crypto requires HTTPS or localhost.

The decrypted text appears as individual atlas glyphs grouped into words. Correct input glows green, incorrect input red, and untyped glyphs remain neutral. The exclamation mark is represented explicitly; there are no apostrophes in the answer. Final submission remains blocked until authenticated decryption succeeds.

Editing the circuit invalidates its verification, hides the key, clears decoded glyphs, and blocks final submission. In-flight decryptions cannot restore stale results. Work is saved under `signal-archive.quantum-work.v1`; restored verification is checked against the actual circuit before re-decryption. Clearing the archive removes this work too.

This is a static client-side puzzle, not confidential storage. The key, ciphertext, and answer validation are shipped in the application. Do not use the puzzle gate to protect private information.

## Checks

`node --test tests/quantum.test.mjs tests/letter-feedback.test.mjs tests/glyph-feedback.test.mjs tests/playfair.test.mjs tests/puzzle-path.test.mjs`

`npm run build`

Tests cover basis and complex states, relative-phase errors, dirty sender wires, malformed controls, parallel gates, scrubber behavior, the exact AES payload, and rejection of wrong keys or modified ciphertext. Browser checks cover mouse/touch dragging, keyboard placement, history, persistence, proof gating, AES decryption, glyph feedback, and phone layouts.