export interface CommandHelp {
  name: string
  summary: string
  signatures: string[]
  parameters: Array<[string, string]>
  returns: string
  details: string[]
  examples: Array<{ code: string; result: string; runnable?: boolean }>
}

export const commandHelp: CommandHelp[] = [
  {
    name: 'relay', summary: 'Evaluate or invert the relay function exactly.',
    signatures: ['relay(value)', 'relay(value, true)'],
    parameters: [['value', 'Nonnegative integer, BigInt, or integer string, up to 256 bits. Large integers must be strings or BigInts.'], ['reverse', 'Optional boolean. true computes the exact nonnegative inverse; false evaluates forward.']],
    returns: 'A BigInt. F(N) = (N + 37)^2 + 19. The inverse subtracts 19, takes an exact integer square root, then subtracts 37.',
    details: ['The inverse rejects values without an exact nonnegative integer solution.', 'Use the Inverse Function popout for decimal input without JavaScript precision loss. Its field starts with the current seal data when available.'],
    examples: [{ code: 'relay(42n)', result: '6260n' }, { code: 'relay("6260", true)', result: '42n' }],
  },
  {
    name: 'pack', summary: 'Combine glyph indices into ordered 6-bit slots.',
    signatures: ['pack(indices)'], parameters: [['indices', 'Array of 1 to 32 integers from 0 to 40, in reading order.']],
    returns: 'A BigInt formed by shifting left six bits and OR-ing each index into the low slot.',
    details: ['The first index occupies the highest slot. Glyph indices are zero-based, unlike prime indices.', 'Every slot holds six bits; the 41-character chart uses values 0 through 40.'],
    examples: [{ code: 'pack([0, 1, 2])', result: '66n' }],
  },
  {
    name: 'unpack', summary: 'Extract ordered indices from a packed integer.',
    signatures: ['unpack(value, count = 5)'], parameters: [['value', 'Nonnegative integer, BigInt, or integer string.'], ['count', 'Number of 6-bit slots, from 1 to 32. Defaults to 5.']],
    returns: 'An array of integer slot values, highest slot first. Leading zero slots are preserved.',
    details: ['The mask 63n isolates the lowest six bits; shifting right by 6n reveals the next slot.', 'The value must fit into count slots. Slots can contain 0 through 63, but only 0 through 40 have glyph mappings.'],
    examples: [{ code: 'unpack(66n, 3)', result: '[0, 1, 2]' }],
  },
  {
    name: 'bits', summary: 'Inspect an integer as labeled binary groups.',
    signatures: ['bits(value, count = 5)'], parameters: [['value, count', 'The same integer and slot count accepted by unpack.']],
    returns: 'An object with decimal text, binary text grouped into six-bit slots, and the extracted indices.',
    details: ['Use the Bit Slots popout for an interactive view with both packing and unpacking.', 'Bitwise operations on JavaScript Numbers use 32 bits. These helpers use BigInt shifts and masks to retain all bits.'],
    examples: [{ code: 'bits(66n, 3)', result: '000000 000001 000010; indices [0, 1, 2]' }],
  },
  {
    name: 'glyphs', summary: 'Look up the original cipher chart by index.',
    signatures: ['glyphs()', 'glyphs(indices)'], parameters: [['indices', 'Optional array of 1 to 32 indices from 0 to 40.']],
    returns: 'With no arguments, the indexed character table. With indices, the corresponding character labels joined in order.',
    details: ['Chart order: A-Z, 1-9, 0, ss, th, dbl-letter, ?, !. A is index 0.', 'The Glyph Chart popout displays the actual symbols beside their labels. Selecting a chart cell appends its index to the input.'],
    examples: [{ code: 'glyphs()', result: '41 indexed character labels' }, { code: 'glyphs([0, 1, 2])', result: 'ABC' }],
  },
  {
    name: 'tools', summary: 'Open draggable relay workbenches.',
    signatures: ['tools()', 'tools(name)'], parameters: [['name', 'Optional tool name: "relay", "bits", or "glyphs".']],
    returns: 'Without arguments, an interactive tool directory. With a name, opens or focuses that tool window.',
    details: ['Popout icons also appear on the related command references. Each tool has independent inputs and results.', 'Windows can be dragged by their header, moved with arrow keys while the header is focused, minimized, restored, and closed. Escape closes the focused tool.', 'Tools do not submit puzzle answers automatically. Copy a result or submit it explicitly through answer(value).'],
    examples: [{ code: 'tools()', result: 'Tool directory' }, { code: 'tools("bits")', result: 'Opens Bit Slots' }],
  },
  {
    name: 'primes',
    summary: 'Inspect one prime or enumerate an index range.',
    signatures: ['primes(index)', 'primes(start, end)'],
    parameters: [
      ['index', 'Integer from 1 to 10,000,000,000. Indices start at 1, where the prime is 2.'],
      ['start, end', 'Integers from 1 to 10,000. Both endpoints are included; end must be at least start.'],
    ],
    returns: 'One argument returns a frozen record: { index, value, previous, next }. Two arguments return a normal array of prime values.',
    details: [
      'The argument is a position in the prime sequence, not a maximum prime value. The first prime has previous: null.',
      'Use .value when computing with an inspected prime. Range arrays support map, filter, reduce, and ordinary indexing.',
      'Large lookups use exact prime counting and a segmented sieve in a worker. They do not block the page. Execution time depends on the device.',
      'At most 80 range tiles are previewed; the returned array still contains the entire requested range.',
    ],
    examples: [
      { code: 'primes(17)', result: 'p_17 = 59; previous 53; next 61' },
      { code: 'primes(17, 20)', result: '[59, 61, 67, 71]' },
      { code: 'primes(17).value * 2', result: '118' },
      { code: 'primes(10000000000)', result: 'p_10000000000 = 252097800623' },
    ],
  },
  {
    name: 'factor',
    summary: 'Resolve an integer into its prime factors.',
    signatures: ['factor(number)'],
    parameters: [['number', 'A nonzero integer with absolute value at most 1,000,000,000,000. Numeric strings are converted to numbers.']],
    returns: 'An array of prime factors in ascending order, with repeated factors retained. The console displays a multiplication chain.',
    details: ['Negative inputs are factored by magnitude; the sign is not included in the result.', 'Both 1 and -1 return an empty array. Zero, fractions, and values outside the limit throw an error.'],
    examples: [{ code: 'factor(360)', result: '[2, 2, 2, 3, 3, 5]' }, { code: 'factor(-84)', result: '[2, 2, 3, 7]' }, { code: 'factor(1)', result: '[]' }],
  },
  {
    name: 'isPrime',
    summary: 'Test whether a number is prime.',
    signatures: ['isPrime(number)'],
    parameters: [['number', 'A number or numeric string. Integer inputs of 2 or greater must not exceed 1,000,000,000,000.']],
    returns: 'A boolean: true for a prime, false for a composite or a value that is not an integer of at least 2.',
    details: ['2 is the only even prime. Negative numbers, 0, and 1 are not prime.', 'The helper converts its input with Number(). Integer values above the supported limit throw an error.'],
    examples: [{ code: 'isPrime(97)', result: 'true' }, { code: 'isPrime(91)', result: 'false' }, { code: 'isPrime(primes(17).value)', result: 'true' }],
  },
  {
    name: 'gcd',
    summary: 'Find the greatest common divisor of two integers.',
    signatures: ['gcd(first, second)'],
    parameters: [['first, second', 'Safe integers from -9,007,199,254,740,991 to 9,007,199,254,740,991. Numeric strings are converted to numbers.']],
    returns: 'A nonnegative integer: the largest positive divisor shared by both magnitudes, or 0 when both inputs are 0.',
    details: ['Signs do not affect the result. The calculation uses the Euclidean algorithm.', 'gcd(number, 0) equals the absolute value of number. Fractions and unsafe integers throw an error.'],
    examples: [{ code: 'gcd(84, 126)', result: '42' }, { code: 'gcd(-18, 24)', result: '6' }, { code: 'gcd(0, 0)', result: '0' }],
  },
  {
    name: 'puzzle',
    summary: 'Read the active puzzle and its public data.',
    signatures: ['puzzle', 'puzzle.data'],
    parameters: [],
    returns: 'A public metadata object containing id, sequence, kind, title, objective, and data. This is an object, not a function.',
    details: ['The top-level object is frozen. No accepted answers are exposed through this helper.', 'The data field contains the consoleData supplied by the puzzle author. Its structure varies between puzzles.'],
    examples: [{ code: 'puzzle', result: 'Current puzzle metadata' }, { code: 'puzzle.data', result: 'Author-provided public data' }],
  },
  {
    name: 'answer',
    summary: 'Submit a value to the active puzzle.',
    signatures: ['answer(value)'],
    parameters: [['value', 'The candidate answer. It is converted to a string before being sent to the decoder.']],
    returns: 'The message "Answer routed to the decoder." Verification is reported by the puzzle, not by this return value.',
    details: ['Submitting an answer can record an attempt and update local solution history.', 'The active puzzle determines answer normalization and accepted values. An empty string is not submitted.', 'The example is insert-only because submitting changes puzzle state.'],
    examples: [{ code: 'answer("your answer")', result: 'Submits an attempt to the active puzzle', runnable: false }],
  },
  {
    name: 'clear',
    summary: 'Clear the visible console transcript.',
    signatures: ['clear()'],
    parameters: [],
    returns: 'undefined. The current transcript is removed.',
    details: ['Command history, variables in the running worker, and saved puzzle attempts are preserved.', 'A page reload resets the worker and its variables. clear() does not reset the runtime.', 'The example is insert-only because it removes the current transcript.'],
    examples: [{ code: 'clear()', result: 'Clears visible console output', runnable: false }],
  },
  {
    name: 'help',
    summary: 'Browse commands or open a detailed reference.',
    signatures: ['help()', 'help(command)'],
    parameters: [['command', 'Optional command name, signature string, or built-in function reference. For puzzle, use its name or the puzzle object.']],
    returns: 'Without an argument, a command directory. With an argument, the matching command reference.',
    details: ['Command names are case-insensitive when supplied as strings. A signature such as "primes(index)" resolves to primes.', 'An unknown name throws an error listing available commands. Help does not execute the command being described.', 'References remain ordinary JavaScript objects when assigned to a variable.'],
    examples: [{ code: 'help("primes")', result: 'Prime lookup reference' }, { code: 'help(factor)', result: 'Factorization reference' }, { code: 'help()', result: 'Command directory' }],
  },
]