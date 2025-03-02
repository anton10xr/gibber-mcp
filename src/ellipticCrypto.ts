// src/ellipticCrypto.ts
import * as elliptic  from 'elliptic';
import * as crypto from 'crypto';

const EC = elliptic.ec;

// Initialize the curve (Curve25519 for ECDH)
const ecCurve = new EC('curve25519');

export class EllipticCrypto {
  /**
   * Generates a new key pair on Curve25519.
   * @returns An object with base64-encoded publicKey and privateKey.
   */
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const key = ecCurve.genKeyPair();
    // Get private key as 32-byte hex string, public key as 32-byte (Montgomery U-coordinate) hex
    const privHex = key.getPrivate('hex');             // 64 hex chars (32 bytes)
    const pubHex = key.getPublic('hex');               // For curve25519, should be 64 hex chars
    // Convert hex to base64 for easy transmission
    const privateKey = Buffer.from(privHex, 'hex').toString('base64');
    const publicKey = Buffer.from(pubHex, 'hex').toString('base64');
    return { publicKey, privateKey };
  }

  /**
   * Derives a shared secret (32-byte, base64-encoded) from own private key and other party's public key.
   */
  static deriveSharedSecret(privateKey: string, otherPublicKey: string): string {
    // Decode keys from base64 to hex
    const privHex = Buffer.from(privateKey, 'base64').toString('hex');
    const pubHex = Buffer.from(otherPublicKey, 'base64').toString('hex');
    // Reconstruct key pair objects
    const myKey = ecCurve.keyFromPrivate(privHex, 'hex');
    const otherKey = ecCurve.keyFromPublic(pubHex, 'hex');
    // Compute shared secret (as BN, the x coordinate of the ECDH result)
    const sharedSecretBN = myKey.derive(otherKey.getPublic()); // BN (big number)
    // Convert BN to 32-byte hex string (pad with leading zeros if necessary)
    let sharedHex = sharedSecretBN.toString('hex');
    sharedHex = sharedHex.padStart(64, '0');
    return Buffer.from(sharedHex, 'hex').toString('base64');
  }

  /**
   * Encrypts a message with AES-256-CBC using the shared secret as key.
   * @returns An object with base64 ciphertext and base64 IV.
   */
  static encrypt(sharedSecret: string, message: string): { iv: string; ciphertext: string } {
    const key = Buffer.from(sharedSecret, 'base64'); // 32 bytes
    const iv = crypto.randomBytes(16);              // 16-byte IV for AES-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(message, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return {
      iv: iv.toString('base64'),
      ciphertext: encrypted
    };
  }

  /**
   * Decrypts an AES-256-CBC ciphertext using the shared secret and provided IV.
   */
  static decrypt(sharedSecret: string, iv: string, ciphertext: string): string {
    const key = Buffer.from(sharedSecret, 'base64');
    const ivBuf = Buffer.from(iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuf);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
