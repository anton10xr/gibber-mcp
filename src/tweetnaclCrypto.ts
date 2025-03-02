// src/tweetnaclCrypto.ts
import nacl from 'tweetnacl';

export class TweetNaClCrypto {
  /**
   * Generates a new Curve25519 key pair for use with TweetNaCl.
   * @returns An object containing base64-encoded publicKey and privateKey (32 bytes each).
   */
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const keyPair = nacl.box.keyPair();
    // Encode keys as base64 strings for easy transmission (e.g., via SMS)
    const publicKey = Buffer.from(keyPair.publicKey).toString('base64');
    const privateKey = Buffer.from(keyPair.secretKey).toString('base64');
    return { publicKey, privateKey };
  }

  /**
   * Derives a shared secret (32-byte base64 string) using one's private key and the other party's public key.
   * This uses Curve25519 Diffie-Hellman via nacl.box.before().
   */
  static deriveSharedSecret(privateKey: string, otherPublicKey: string): string {
    // Decode keys from base64 to Uint8Array
    const privKeyBytes = new Uint8Array(Buffer.from(privateKey, 'base64'));
    const pubKeyBytes = new Uint8Array(Buffer.from(otherPublicKey, 'base64'));
    // Perform Diffie-Hellman to get shared secret
    const sharedSecret = nacl.box.before(pubKeyBytes, privKeyBytes); // 32-byte Uint8Array
    return Buffer.from(sharedSecret).toString('base64');
  }

  /**
   * Encrypts a text message using a shared secret. Returns an object with base64 ciphertext and nonce.
   * @param sharedSecret - base64 string (32-byte shared key derived from deriveSharedSecret).
   * @param message - Plaintext message to encrypt.
   */
  static encrypt(sharedSecret: string, message: string): { nonce: string; ciphertext: string } {
    const keyBytes = new Uint8Array(Buffer.from(sharedSecret, 'base64'));
    const messageBytes = Buffer.from(message, 'utf8');
    const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24-byte random nonce
    const cipherBytes = nacl.secretbox(messageBytes, nonce, keyBytes);
    return {
      nonce: Buffer.from(nonce).toString('base64'),
      ciphertext: Buffer.from(cipherBytes).toString('base64'),
    };
  }

  /**
   * Decrypts a ciphertext using a shared secret and nonce. Returns the original plaintext message.
   * @param sharedSecret - base64 string (shared key).
   * @param nonce - base64 string (the nonce used during encryption).
   * @param ciphertext - base64 string (the encrypted message).
   */
  static decrypt(sharedSecret: string, nonce: string, ciphertext: string): string {
    const keyBytes = new Uint8Array(Buffer.from(sharedSecret, 'base64'));
    const nonceBytes = new Uint8Array(Buffer.from(nonce, 'base64'));
    const cipherBytes = new Uint8Array(Buffer.from(ciphertext, 'base64'));
    const plainBytes = nacl.secretbox.open(cipherBytes, nonceBytes, keyBytes);
    if (!plainBytes) {
      throw new Error("Failed to decrypt message (invalid key or corrupted data).");
    }
    return Buffer.from(plainBytes).toString('utf8');
  }
}
