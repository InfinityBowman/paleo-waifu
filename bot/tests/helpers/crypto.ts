import { etc, keygenAsync, signAsync } from '@noble/ed25519'

let privateKey: Uint8Array
let publicKeyHex: string

/**
 * Generate a new keypair and store both the private key hex
 * and public key hex in env vars so forked test processes can recover them.
 */
export async function generateAndShareKeypair() {
  const keys = await keygenAsync()
  privateKey = keys.secretKey
  publicKeyHex = etc.bytesToHex(keys.publicKey)

  // Share via env for forked processes
  process.env.__TEST_PRIVATE_KEY_HEX = etc.bytesToHex(privateKey)
  process.env.__TEST_PUBLIC_KEY_HEX = publicKeyHex
}

/**
 * Load the keypair from env vars (used in forked test processes).
 */
export function loadKeypairFromEnv() {
  const privHex = process.env.__TEST_PRIVATE_KEY_HEX
  const pubHex = process.env.__TEST_PUBLIC_KEY_HEX
  if (!privHex || !pubHex) {
    throw new Error(
      'Test keypair not found in env — globalSetup must run first',
    )
  }
  privateKey = etc.hexToBytes(privHex)
  publicKeyHex = pubHex
}

export function getPublicKeyHex(): string {
  return publicKeyHex
}

export async function signPayload(
  timestamp: string,
  body: string,
): Promise<string> {
  const message = new TextEncoder().encode(timestamp + body)
  const signature = await signAsync(message, privateKey)
  return etc.bytesToHex(signature)
}
