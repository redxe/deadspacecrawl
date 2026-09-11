# Playfair Puzzle

The second archive puzzle, **A Light Between Pairs**, unlocks after **A Door in the Dark**. Open it through Puzzle path. Open/Review now navigates between configured archive puzzles, restores their console context, and checks all earlier prerequisites. The selected puzzle and worksheet progress are saved locally. Clearing the archive resets that selection and worksheet as well.

## Player Flow

1. Recover the keyword from the seven-line acrostic log and arrange a 5 by 5 glyph square. Only first occurrences of keyword letters are retained; unused letters follow alphabetically. I/J share a cell.
2. Decipher 18 fixed glyph pairs using the verified square. Place recovered glyphs from the reusable tray, then check the complete worksheet. Checks never insert missing letters or expose decoded answers.
3. Remove inserted separators and restore spaces and the question mark, then submit the sentence. The answer uses `dont` without an apostrophe because apostrophes have no glyph. The final input and console submission remain gated until the worksheet is verified.

The field manual includes row, column, rectangle, wrapping, and text-preparation rules; an unrelated worked example; the single-letter glyph chart; and an external history/rules resource. Playfair uses individual atlas letters, never TH/SS/double-letter shorthand. It inserts X within repeated-letter pairs and Z for a final unpaired letter, matching the chosen engine. Deciphering preserves fillers until the restoration stage.

Tiles support captured pointer dragging with a ghost image, mouse/touch selection followed by destination selection, and Enter/Space keyboard activation. Escape cancels selection. Delete/Backspace or double-click clears a recovered slot. Reset requires confirmation and does not delete an archived final solution.

Recovered worksheet glyphs turn green or red as they are placed. The final transmission also responds to typing: matching letters glow green, mismatches red, and untyped letters stay neutral. Its two inserted X separators remain neutral and do not consume input; the final question mark has its own glyph. The complete correct sentence enables the Transmit readiness glow.

## Implementation

- `src/puzzles/paired-signal.ts`: puzzle metadata, accepted final sentence, and non-solution hints.
- `src/playfair.ts`: fixed ciphertext and validation adapter around the ISC-licensed `crypto-classic-playfair` package. The published PLAYFAIR EXAMPLE vector is tested, including filler preservation.
- `src/playfair-workspace.ts`: stage controls, tile interactions, references, and validated restoration of saved work.
- `src/main.ts`: prerequisite-aware navigation, final submission gating, and archive integration.

Storage keys: `signal-archive.playfair-work.v1` and `signal-archive.selected-puzzle.v1`. Invalid saved stage flags cannot unlock work without a valid square and complete valid pairs. Storage failures leave the current in-page worksheet usable. This is a client-side puzzle, not a security boundary: source inspection can reveal validation data. No automatic decrypt command is exposed in the puzzle's console data.

Run `node --test tests/playfair.test.mjs tests/puzzle-path.test.mjs tests/entry-gate.test.mjs tests/glyph-feedback.test.mjs` and `npm run build`.