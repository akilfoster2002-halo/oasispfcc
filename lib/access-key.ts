// Access-key constants + helpers shared by the access-key route and the signup route.
// Keeping these in one place so TTL, alphabet, and normalization can't drift apart.

import { randomInt } from 'crypto'

// No ambiguous 0/O/1/I.
export const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const KEY_TTL_MS = 60 * 60 * 1000 // 1 hour
export const KEY_LENGTH = 8 // chars, not counting the dash
export const KEY_FORMAT = /^[A-Z2-9]{4}-?[A-Z2-9]{4}$/

/** Cryptographically random key, formatted XXXX-XXXX. Uses unbiased rejection sampling. */
export function generateAccessKey(): string {
  let key = ''
  for (let i = 0; i < KEY_LENGTH; i++) {
    if (i === 4) key += '-'
    key += KEY_ALPHABET[randomInt(0, KEY_ALPHABET.length)]
  }
  return key
}

/**
 * Normalize whatever the user typed into the canonical XXXX-XXXX form so that
 * `ABCDEFGH`, `abcd efgh`, `ABCD-EFGH` all match the value stored in the DB.
 * Returns null if the input doesn't have the right shape.
 */
export function normalizeAccessKey(input: string | null | undefined): string | null {
  if (!input) return null
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase()
  if (cleaned.length !== KEY_LENGTH) return null
  // Reject any chars outside the alphabet so we don't issue a needless DB query.
  for (const ch of cleaned) {
    if (!KEY_ALPHABET.includes(ch)) return null
  }
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`
}

/** How many whole minutes remain until `expiresAt`. Floored at 0. */
export function minutesLeftUntil(expiresAt: string | Date): number {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / 60000))
}
