# MCP Server

A Model Context Protocol server built with Express.js that provides cryptographic tools including key pair generation, shared secret derivation, and message encryption/decryption.

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

The server provides the following tools:

1. **generateKeyPair**: Generate a new SJCL P-256 key pair
2. **deriveSharedSecret**: Derive a shared secret from private and public keys
3. **encrypt**: Encrypt a message using a shared secret
4. **decrypt**: Decrypt a message using a shared secret

## License

[MIT](LICENSE)
