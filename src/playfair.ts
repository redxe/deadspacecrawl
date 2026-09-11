import engine from 'crypto-classic-playfair'

export const playfairAlphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'
export const playfairKey = 'LANTERN'
export const playfairCiphertext = 'MF CV DV EN AL OD LN NV TV RS RQ UF LD ZF RS TE AK TZ'

export function buildPlayfairSquare(key: string): string {
  return [...new Set((key.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '') + playfairAlphabet).split(''))].join('')
}

export function decryptPlayfair(text: string, key: string): string {
  const normalized = text.toUpperCase().replace(/\s/g, '')
  if (!normalized.length || normalized.length % 2 || /[^A-IK-Z]/.test(normalized)) throw new Error('Use complete pairs from the 25-letter I/J alphabet.')
  return engine.decipher(normalized.toLowerCase(), buildPlayfairSquare(key).toLowerCase()).replace(/\s/g, '').toUpperCase()
}

export function playfairSquareMatches(square: readonly string[]): boolean {
  return square.length === 25 && square.join('') === buildPlayfairSquare(playfairKey)
}

export function playfairPairsMatch(pairs: readonly string[]): boolean {
  return pairs.length === 18 && pairs.every(pair => /^[A-IK-Z]{2}$/.test(pair)) && pairs.join('') === decryptPlayfair(playfairCiphertext, playfairKey)
}