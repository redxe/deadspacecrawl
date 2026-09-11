export interface SecretMessage { id: string; title: string; text: string; updatedAt: string }
export interface SecretEnvelope { version: 1; iv: string; ciphertext: string }

export const secretDatabaseKey = '247ac06e185a9e4db24e437286d1d769f4097324d12c8a6d7f8b1a60e951d357'
export const secretDatabaseLimit = 1_000_000

export function validateSecretMessages(value: unknown): asserts value is SecretMessage[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('The database supports at most 100 messages.')
  const ids = new Set<string>()
  for (const message of value) {
    if (!message || typeof message.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(message.id) || ids.has(message.id)) throw new Error('Each message needs a unique valid ID.')
    if (typeof message.title !== 'string' || !message.title.trim() || message.title.length > 80) throw new Error('Message titles must contain 1-80 characters.')
    if (typeof message.text !== 'string' || !message.text.trim() || message.text.length > 4000 || !/^[A-Za-z0-9?! \n]+$/.test(message.text)) throw new Error('Messages support only A-Z, digits, spaces, line breaks, ? and ! (maximum 4000 characters).')
    if (typeof message.updatedAt !== 'string' || !Number.isFinite(Date.parse(message.updatedAt))) throw new Error('Invalid message timestamp.')
    ids.add(message.id)
  }
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
function decodeBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Invalid base64 data.')
  return Uint8Array.from(atob(value), character => character.charCodeAt(0))
}
async function importKey() {
  if (!globalThis.crypto?.subtle) throw new Error('Encrypted messages require HTTPS or localhost.')
  const bytes = Uint8Array.from(secretDatabaseKey.match(/../g)!, pair => parseInt(pair, 16))
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
export async function encryptSecretMessages(messages: SecretMessage[]): Promise<SecretEnvelope> {
  validateSecretMessages(messages)
  const plaintext = new TextEncoder().encode(JSON.stringify(messages))
  if (plaintext.length > 600_000) throw new Error('Message database is too large.')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, await importKey(), plaintext)
  return { version: 1, iv: encodeBytes(iv), ciphertext: encodeBytes(new Uint8Array(encrypted)) }
}
export async function decryptSecretMessages(value: unknown): Promise<SecretMessage[]> {
  const envelope = value as Partial<SecretEnvelope> | null
  if (!envelope || envelope.version !== 1 || typeof envelope.iv !== 'string' || envelope.iv.length !== 16 || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > secretDatabaseLimit) throw new Error('Unsupported or oversized message database.')
  const iv = decodeBytes(envelope.iv)
  const ciphertext = decodeBytes(envelope.ciphertext)
  if (iv.length !== 12 || ciphertext.length < 16) throw new Error('Invalid encrypted message data.')
  const key = await importKey()
  let decoded: unknown
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ciphertext)
    decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext))
  } catch { throw new Error('Message database authentication failed.') }
  validateSecretMessages(decoded)
  return decoded
}