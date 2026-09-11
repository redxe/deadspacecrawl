export const recoveredAesKey = 'a8d579f07052ca9a07e7b6f9c7eaef27bfaedfce46aceb08c5fb9708c0e85366'
export const messageIv = '999fcd913bb07416eacb98c8'
export const encryptedMessage = 'ZD3KjZxIU4qSqJw/RyXmvWM/SwOuUNXgLjnA6V6qBbo9SFZlXF+GctTao5au9Kx/yJBhPW+e10d5rNJ4k7lQvWYMbBc4Yl6wqBYa4OT/oZQ28kPg4Qf7K9F/h0dDoUHdVsrSyXQ4uQNRiNSe7QfS7nLQxA=='

export async function decryptQuantumMessage(keyHex: string, ciphertext = encryptedMessage, ivHex = messageIv): Promise<string> {
  if (!/^[a-f0-9]{64}$/i.test(keyHex.trim())) throw new Error('Enter a 64-character hexadecimal AES-256 key.')
  if (!/^[a-f0-9]{24}$/i.test(ivHex.trim())) throw new Error('The IV must contain 24 hexadecimal characters.')
  if (!globalThis.crypto?.subtle) throw new Error('AES needs HTTPS or localhost in a browser with Web Crypto support.')
  const bytes = (hex: string) => Uint8Array.from(hex.trim().match(/../g)!, value => parseInt(value, 16))
  try {
    const key = await crypto.subtle.importKey('raw', bytes(keyHex), 'AES-GCM', false, ['decrypt'])
    const data = Uint8Array.from(atob(ciphertext.replace(/\s/g, '')), character => character.charCodeAt(0))
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(ivHex), tagLength: 128 }, key, data)
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } catch { throw new Error('Authentication failed. Check the key, IV, and ciphertext; no message was recovered.') }
}