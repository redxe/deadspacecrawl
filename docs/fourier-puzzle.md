# Fourier Signal Puzzle

**What the Phases Remember** is archive puzzle 04, unlocked after **Across the Quantum Relay**. It combines a simulator-backed inverse quantum Fourier transform, glyph-only word entry, six-bit integer packing, prime factorization, and an educational RSA transmission.

## State Encoding

The received JSON contains 256 `{real, imaginary}` amplitudes in ascending eight-bit basis order. It is the positive-phase QFT of a normalized superposition with six equally weighted occupied states. The simulator is `jsqubits`; the inverse uses input conjugation, the library QFT, and output conjugation. Tests compare the forward transform against the Fourier equation to pin down phase sign and bit order.

In the recovered state, each basis label is `PPP GGGGG`: three high bits encode position 0-5; five low bits encode the zero-based alphabet index, A=0 through Z=25. The player selects the six corresponding glyphs from an accessible keypad; there is no ASCII word input. Slots give green/red feedback, can be selected or erased, and support keyboard activation and arrow navigation. A verified word unlocks downstream tools. Invalid saved verification flags are rechecked against the actual selected glyphs.

The field manual gives the QFT equation, bit convention, an unrelated example, and external resources. The workbench provides editable/downloadable input amplitudes, forward/inverse transforms, and a phase-circle grid. It never samples or measures the state. Known simulator amplitudes are an educational input, not something obtainable exactly by inspecting one unknown physical state.

## Amplitude Display

All 256 basis states occupy a fixed 16-by-16 grid, including zeros. The vertical Y axis is the first four (high) bits; the horizontal X axis is the last four (low) bits. Concatenating row and column labels recovers the full basis value. This 4+4 display layout is separate from the 3+5 position/glyph encoding: concatenate first, then decode as `PPP GGGGG`. For example, row `0010`, column `0011` gives `00100011`, which encodes position 1 and glyph index 3.

Filled radius is proportional to complex magnitude, so filled area is proportional to probability. A common scale fits the largest amplitude to the outer reference circle; the displayed `Radius |a| x ...` factor updates with each statevector. Phase is `atan2(imaginary, real)`: zero points right and positive phase rotates counterclockwise. Amplitudes below numerical precision (magnitude at most 1e-12) have empty circles and no phase line.

Hover, keyboard focus, or tap highlights one state and reveals its full binary basis, decimal index, complex amplitude, magnitude, probability, and phase. Arrow keys move between states; Home/End move within the row, Ctrl+Home/End across the grid, and Escape dismisses the tooltip. Tab enters/exits the grid as one stop. On phones, scrolling stays inside the matrix and binary row labels remain visible. Reduced-motion preferences disable the hover expansion.

## Integer and RSA

After glyph verification, the six indices are repacked into SIX-bit slots, first glyph most significant. This is deliberately distinguished from the statevector's FIVE-bit alphabet field. All arithmetic that can exceed bitwise JavaScript limits uses `BigInt`.

Authoring values (spoilers): the glyph word is VIOLET, with indices `[21,8,14,11,4,19]`. Packing gives `22686511379 = 7 * 3240930197`. Its largest prime factor is RSA prime `p`; the other prime is `65537`. Public modulus `n = 212400842320789`, exponent `e = 65537`. The worksheet derives `q`, Euler's totient, and `d` with `bigint-crypto-utils`, then decrypts one UTF-8 byte per ciphertext block. The factor tool is bounded to 36-bit inputs to keep its trial division responsive.

This is intentionally small, unpadded textbook RSA, not secure cryptography for real communications. Repeated bytes have repeated ciphertext. The exact requested message is revealed as glyphs, with shared live typing feedback and normal archived-solution submission. Editing the selected word or RSA inputs clears the decrypted state and blocks submission. The console submission path cannot skip this gate.

Work is stored under `signal-archive.fourier-work.v1`. Saved decrypted progress is restored only after validating the word, prime, and private exponent and repeating decryption. Clearing the archive removes this work.

## Verification

Run `node --test tests/amplitude-grid.test.mjs tests/qft-engine.test.mjs tests/fourier-rsa.test.mjs tests/glyph-feedback.test.mjs tests/letter-feedback.test.mjs` and `npm run build`.

Browser checks cover prerequisite gating, inverse-QFT support, wrong/correct glyphs, integer packing, wrong-prime rejection, RSA decryption, final feedback, persistence, invalid saved flags, and responsive layouts. Amplitude checks cover fixed coordinates after transforms, hover/focus details, zero phase, keyboard navigation, and bounded phone scrolling/tooltips.