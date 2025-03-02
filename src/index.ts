import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { SJCLCrypto } from './sjclCrypto.js';

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});

// Generate a new SJCL key pair
server.tool(
  "generateKeyPair",
  "Generate a new SJCL P-256 key pair (don't print the private key)",
  {},
  async () => {
    console.log("Executing generateKeyPair tool");
    const keyPair = SJCLCrypto.generateKeyPair();
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(keyPair, null, 2)
        }
      ]
    };
  }
);

// Derive a shared secret from private and public keys
server.tool(
  "deriveSharedSecret",
  "Derive a shared secret. Call this only once, when you have TWO input strings: user's public key and your private key",
  {
    userPublicKey: z.string().max(200).describe("User's public key (required)"),
    myPrivateKey: z.string().describe("Your private key (required)"),
  },
  async ({ myPrivateKey, userPublicKey }: { myPrivateKey: string; userPublicKey: string }) => {
    console.log("Executing deriveSharedSecret tool");
    const sharedSecret = SJCLCrypto.deriveSharedSecret(myPrivateKey, userPublicKey);
    
    return {
      content: [
        {
          type: "text",
          text: "You got the shared secret: " + sharedSecret
        }
      ]
    };
  }
);

// Encrypt a message using a shared secret
server.tool(
  "encrypt",
  "Encrypt a message using SJCL AES-CCM and return only the IV and ciphertext",
  {
    sharedSecret: z.string().describe("Shared secret derived from key exchange (required)"),
    plaintext: z.string().describe("Text message to encrypt (required)")
  },
  async ({ sharedSecret, plaintext }: { sharedSecret: string; plaintext: string }) => {
    console.log("Executing encrypt tool");
    // Cut first 50 characters of plaintext if longer than 50 chars
    const truncatedPlaintext = plaintext.length > 66 ? 
      plaintext.substring(0, 66) + "..." : plaintext;
    const result = SJCLCrypto.encrypt(sharedSecret, truncatedPlaintext);
    
    // Parse the result and extract only iv and ct for optimization
    const encryptedData = JSON.parse(result.ciphertext);
    const optimizedResult = {
      iv: encryptedData.iv,
      ct: encryptedData.ct
    };
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(optimizedResult)
        }
      ]
    };
  }
);

// Decrypt a message using a shared secret
server.tool(
  "decrypt",
  "Decrypt a message using SJCL AES-CCM with just IV and ciphertext",
  {
    sharedSecret: z.string().describe("Shared secret derived from key exchange"),
    iv: z.string().describe("Initialization vector (IV) from encryption"),
    ct: z.string().describe("Ciphertext (CT) from encryption")
  },
  async ({ sharedSecret, iv, ct }: { sharedSecret: string; iv: string; ct: string }) => {
    console.log("Executing decrypt tool");
    
    // Reconstruct the full SJCL format with hardcoded parameters
    const fullCiphertext = JSON.stringify({
      iv: iv,
      v: 1,
      iter: 10000,
      ks: 128,
      ts: 64,
      mode: "ccm",
      adata: "",
      cipher: "aes",
      ct: ct
    });
    
    const plaintext = SJCLCrypto.decrypt(sharedSecret, fullCiphertext);
    console.log("Decrypted message:", plaintext);
    
    return {
      content: [
        {
          type: "text",
          text: plaintext
        }
      ]
    };
  }
);

const app = express();

// Store transports by unique identifier
const transports = new Map();

app.get("/sse", async (req, res) => {
  // Create a unique ID for this connection
  const id = Date.now().toString();
  
  // Create the SSE transport, with the message path that matches
  // what we'll use in our POST handler
  const transport = new SSEServerTransport(`/messages/${id}`, res);
  
  // Store the transport by ID
  transports.set(id, transport);
  
  // Connect the server to this transport
  await server.connect(transport);
  
  // Remove transport when connection closes
  req.on("close", () => {
    transports.delete(id);
    console.log(`Connection ${id} closed. Active: ${transports.size}`);
  });
  
  console.log(`New connection ${id}. Active: ${transports.size}`);
});

// Handle messages with a path parameter for the connection ID
// @ts-ignore
app.post("/messages/:id", async (req, res) => {
  const id = req.params.id;
  const transport = transports.get(id);
  
  if (!transport) {
    return res.status(404).json({ error: "Connection not found" });
  }
  
  await transport.handlePostMessage(req, res);
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3006;
app.listen(port, () => {
  console.log(`MCP Server listening on port ${port}`);
});