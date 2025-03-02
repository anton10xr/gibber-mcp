// src/sjclCrypto.ts
import sjcl from './sjcl.js';


// Use a 384-bit elliptic curve for stronger security
const curve = sjcl.ecc.curves.c192;

export class SJCLCrypto {
  /**
   * Generates a new elliptic curve key pair (P-384).
   * @returns An object with the key pair objects and their base64-encoded string representations.
   */
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const keys = sjcl.ecc.elGamal.generateKeys(curve);
    
    // Convert keys to base64 strings for storage/transmission
    const privBits = keys.sec.get();
    const privateKey = sjcl.codec.base64.fromBits(privBits);
    
    // For public key, we need to serialize the point
    const pubPoint = keys.pub.get();
    const pubBits = sjcl.bitArray.concat(pubPoint.x, pubPoint.y);
    const publicKey = sjcl.codec.base64.fromBits(pubBits);
    
    return { publicKey, privateKey };
  }

  /**
   * Derives a shared secret (base64 string) using one's private key and the other's public key.
   */
  static deriveSharedSecret(privateKey: string, otherPublicKey: string): string {
    // Reconstruct the private key object
    const privBits = sjcl.codec.base64.toBits(privateKey);
    const secKey = new sjcl.ecc.elGamal.secretKey(curve, sjcl.bn.fromBits(privBits));
    
    // Reconstruct the public key object
    const pubBits = sjcl.codec.base64.toBits(otherPublicKey);
    const xBits = sjcl.bitArray.bitSlice(pubBits, 0, 192);
    const yBits = sjcl.bitArray.bitSlice(pubBits, 192);
    const point = new sjcl.ecc.point(curve, 
                                  sjcl.bn.fromBits(xBits), 
                                  sjcl.bn.fromBits(yBits));
    const pubKey = new sjcl.ecc.elGamal.publicKey(curve, point);
    
    // Compute shared secret through ECDH
    const sharedBits = secKey.dh(pubKey);
    return sjcl.codec.base64.fromBits(sharedBits);
  }

  /**
   * Encrypts a message using SJCL's high-level encryption with the shared key.
   * @returns An object with the ciphertext (JSON string) that includes IV, salt, etc.
   */
  static encrypt(sharedSecret: string, message: string): { ciphertext: string } {
    const keyBits = sjcl.codec.base64.toBits(sharedSecret);
    // Use SJCL's built-in encryption (defaults to AES-CCM with a random IV and salt)
    const ciphertext = sjcl.encrypt(keyBits, message);
    return { ciphertext }; // ciphertext is a JSON string containing all encryption parameters and the data
  }

  /**
   * Decrypts a message using SJCL's high-level decryption with the shared key.
   */
  static decrypt(sharedSecret: string, ciphertext: string): string {
    const keyBits = sjcl.codec.base64.toBits(sharedSecret);
    try {
      return sjcl.decrypt(keyBits, ciphertext);
    } catch (e: any) {
      throw new Error("Failed to decrypt message: " + e.message);
    }
  }
}
