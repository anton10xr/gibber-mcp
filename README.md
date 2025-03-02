# MCP Server

A Model Context Protocol server built with Express.js that provides cryptographic tools including key pair generation, shared secret derivation, and message encryption/decryption.

**Now available at: http://104.248.174.57/sse**

**Powered by [Stanford Javascript Crypto Library (SJCL)](https://www.npmjs.com/package/sjcl)**

## What is MCP?

The [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) is an open standard that defines how AI models and tools communicate. It enables seamless interoperability between language models and external capabilities, allowing AI systems to use tools more effectively. MCP standardizes the way models request information and actions, making it easier to build complex AI applications with multiple components.

## Features

- Generate SJCL P-256 key pairs
- Derive shared secrets for secure communication
- Encrypt messages using SJCL AES-CCM
- Decrypt encrypted messages
- Server-sent events (SSE) for real-time communication

## Installation

```bash
# Clone the repository
git clone <your-repository-url>
cd mcp-server

# Install dependencies
npm install
```

## Environment Variables

The server uses the following environment variables:

- `PORT`: The port on which the server will run (default: 3006)

## Development

```bash
# Start the development server
npm run dev
```

## Production

```bash
# Build the project
npm run build

# Start the production server
npm start
```

## API Endpoints

- `GET /sse`: Connect to the server using server-sent events
- `POST /messages/:id`: Send messages to a specific connection

## Tools

The server provides the following cryptographic tools:

1. **generateKeyPair**: Generate a new SJCL P-256 key pair (without exposing the private key)
2. **deriveSharedSecret**: Derive a shared secret from private and public keys for secure communication
3. **encrypt**: Encrypt messages using SJCL AES-CCM encryption with the derived shared secret
4. **decrypt**: Decrypt messages using SJCL AES-CCM with the shared secret

## License

[MIT](LICENSE)
