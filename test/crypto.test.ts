// test/crypto.test.ts
import { TweetNaClCrypto } from '../src/tweetnaclCrypto.ts';
import { SJCLCrypto } from '../src/sjclCrypto.ts';

// Configuration to enable/disable test sections
const RUN_TESTS = {
  TWEETNACL: true,
  SJCL: true
};

// Helper to print a section header
const logHeader = (title: string) => {
  console.log(`\n=== ${title} ===`);
};

// Plaintext message for testing
const MESSAGE = "Hello, this is a secret message!";

// --- TweetNaCl Test Section ---
function testTweetNaCl() {
  logHeader("TweetNaCl (Curve25519 key exchange + XSalsa20-Poly1305 encryption)");

  // 1. Generate key pairs for Alice and Bob
  const aliceNaCl = TweetNaClCrypto.generateKeyPair();
  const bobNaCl = TweetNaClCrypto.generateKeyPair();
  console.log("Alice Key Pair:", aliceNaCl);
  console.log("Bob Key Pair:", bobNaCl);

  // 2. Derive shared secrets on both sides (they should be the same)
  const aliceSharedNaCl = TweetNaClCrypto.deriveSharedSecret(aliceNaCl.privateKey, bobNaCl.publicKey);
  const bobSharedNaCl = TweetNaClCrypto.deriveSharedSecret(bobNaCl.privateKey, aliceNaCl.publicKey);
  console.log("Shared secret (Alice's perspective):", aliceSharedNaCl);
  console.log("Shared secret (Bob's perspective):   ", bobSharedNaCl);
  console.log("Shared secrets match:", aliceSharedNaCl === bobSharedNaCl);

  // 3. Alice encrypts a message for Bob using the shared secret
  const encryptedNaCl = TweetNaClCrypto.encrypt(aliceSharedNaCl, MESSAGE);
  console.log("Encrypted message (base64):", encryptedNaCl.ciphertext);
  console.log("Nonce (base64):", encryptedNaCl.nonce);

  // 4. Bob decrypts the message using the shared secret and Alice's nonce
  const decryptedNaCl = TweetNaClCrypto.decrypt(bobSharedNaCl, encryptedNaCl.nonce, encryptedNaCl.ciphertext);
  console.log("Decrypted message:", decryptedNaCl);
  console.log("Decrypted matches original:", decryptedNaCl === MESSAGE);
}

// --- SJCL Test Section ---
function testSJCL() {
  logHeader("SJCL (P-256 key exchange + AES-CCM encryption)");

  // 1. Generate key pairs for Alice and Bob
  const aliceSJCL = SJCLCrypto.generateKeyPair();
  const bobSJCL = SJCLCrypto.generateKeyPair();
  console.log("Alice Key Pair:", aliceSJCL);
  console.log("Bob Key Pair:", bobSJCL);

  // 2. Derive shared secrets
  const aliceSharedSJCL = SJCLCrypto.deriveSharedSecret(aliceSJCL.privateKey, bobSJCL.publicKey);
  const bobSharedSJCL = SJCLCrypto.deriveSharedSecret(bobSJCL.privateKey, aliceSJCL.publicKey);
  console.log("Shared secret (Alice):", aliceSharedSJCL);
  console.log("Shared secret (Bob):   ", bobSharedSJCL);
  console.log("Shared secrets match:", aliceSharedSJCL === bobSharedSJCL);

  // 3. Alice encrypts message for Bob using SJCL (result is a JSON string)
  const encryptedSJCL = SJCLCrypto.encrypt(aliceSharedSJCL, MESSAGE);
  console.log("Encrypted message (SJCL output):", encryptedSJCL.ciphertext);

  // 4. Bob decrypts the message using SJCL
  const decryptedSJCL = SJCLCrypto.decrypt(bobSharedSJCL, encryptedSJCL.ciphertext);
  console.log("Decrypted message:", decryptedSJCL);
  console.log("Decrypted matches original:", decryptedSJCL === MESSAGE);
}

// Run enabled tests
console.log("Running crypto tests...");

if (RUN_TESTS.TWEETNACL) {
  testTweetNaCl();
}

if (RUN_TESTS.SJCL) {
  testSJCL();
}

console.log("\nTests completed!");
