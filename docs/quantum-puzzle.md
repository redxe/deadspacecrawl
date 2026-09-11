# Quantum Relay Puzzle

**Across the Quantum Relay** is the third archive puzzle, unlocked after **A Light Between Pairs**. The player builds a measurement-free circuit mapping every input `|x00>` to `|00x>`, recovers an AES key, decrypts a glyph transmission, and submits its text.

## Circuit Rules

The top wire is qubit 1 and the leftmost ket bit. The bottom wire is qubit 3 and the rightmost bit. The simulator adapter maps these wires to jsqubits bits 2, 1, and 0 respectively. The MIT-licensed `jsqubits` package provides state evolution; no measurement or sampling is used.

Twelve columns run left to right. Each column supports independent H/X/Z gates on separate wires, or exactly one control paired with one X/Z target. Empty columns do nothing. Gates and controls support mouse/touch dragging, tap placement, keyboard selection, moving, erasing, undo, and redo. The field manual explains the operations and coherent corrections without supplying a complete circuit.

The input is `cos(theta/2)|0> + exp(i phi) sin(theta/2)|1>`, with angles entered in degrees. Presets and a column scrubber update a phase-circle grid of all eight amplitudes. Preview fidelity is for the selected state only, not a proof of universal transfer.

The grid has two rows and four columns: Y is the first bit (`q1`), X is the last two (`q2 q3`), and concatenating row and column labels gives the basis state. Filled radius is proportional to amplitude magnitude on one common scale, shown above the grid; filled area is proportional to probability. The largest magnitude fills its reference circle. A radial line points right for phase zero and rotates counterclockwise for positive phase (`+i` points up). Numerically zero amplitudes remain empty at their fixed positions, with undefined phase. Invalid circuit edits clear the display rather than retaining stale results.

Hover, focus, or tap reveals the full basis, decimal index, complex amplitude, magnitude, probability, and phase, highlighting only that state. Arrow keys navigate; Home/End select row endpoints, Ctrl+Home/End select grid endpoints, and Escape dismisses details. The grid is a single Tab stop. Tooltips stay within the viewport, scrolling is contained on phones, and reduced-motion preferences disable hover expansion. The same display is used by the Fourier puzzle, with a four-bit split on each axis.

Verification checks both basis inputs, including reset sending wires and matching target amplitudes up to one common global phase. By linearity, that verifies every superposition. Independent phases on the two basis outputs are rejected. Equivalent correct circuits are accepted, including parallel final cleanup Hadamards. This is coherent state transfer with interacting wires, not faster-than-light communication.

## Encrypted Transmission

Successful verification reveals a 32-byte key as 64 hexadecimal characters. The built-in decryptor uses Web Crypto AES-256-GCM, a 12-byte hexadecimal IV, a 128-bit authentication tag appended to the base64 ciphertext, and no additional authenticated data. Authentication failures reveal no plaintext. Web Crypto requires HTTPS or localhost.

The decrypted text appears as individual atlas glyphs grouped into words. Correct input glows green, incorrect input red, and untyped glyphs remain neutral. The exclamation mark is represented explicitly; there are no apostrophes in the answer. Final submission remains blocked until authenticated decryption succeeds.

Editing the circuit invalidates its verification, hides the key, clears decoded glyphs, and blocks final submission. In-flight decryptions cannot restore stale results. Work is saved under `signal-archive.quantum-work.v1`; restored verification is checked against the actual circuit before re-decryption. Clearing the archive removes this work too.

This is a static client-side puzzle, not confidential storage. The key, ciphertext, and answer validation are shipped in the application. Do not use the puzzle gate to protect private information.

## Checks

`node --test tests/amplitude-grid.test.mjs tests/quantum.test.mjs tests/letter-feedback.test.mjs tests/glyph-feedback.test.mjs tests/playfair.test.mjs tests/puzzle-path.test.mjs`

`npm run build`

Tests cover basis and complex states, relative-phase errors, dirty sender wires, malformed controls, parallel gates, scrubber behavior, the exact AES payload, and rejection of wrong keys or modified ciphertext. Browser checks cover mouse/touch dragging, keyboard placement, history, persistence, proof gating, AES decryption, glyph feedback, and phone layouts.