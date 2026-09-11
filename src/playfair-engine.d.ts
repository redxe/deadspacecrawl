declare module 'crypto-classic-playfair' {
  const playfair: {
    encipher(text: string, key: string): string
    decipher(text: string, key: string): string
  }
  export default playfair
}