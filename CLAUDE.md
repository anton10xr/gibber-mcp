# MCP Server Development Guidelines

## Build & Run Commands
- Build: `npm run build`
- Start: `npm run start`
- Dev mode (watch): `npm run dev`
- Clean build: `npm run clean`
- Rebuild: `npm run rebuild`
- Run single test: `node test/crypto.test.ts` (use RUN_TESTS config to run specific tests)

## Code Style
- **TypeScript**: ES2022 target, Node16 module system
- **Imports**: Use ES modules import syntax; .ts extension required in imports
- **Error Handling**: Handle promise rejections, check connection existence
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces
- **Types**: Types optional but recommended for function parameters and returns
- **Async**: Use async/await pattern for asynchronous operations
- **Comments**: Document complex logic, crypto operations need clear explanations
- **Structure**: Modular code with separate crypto implementations (TweetNaCl, SJCL)
- **Formatting**: 2-space indentation (inferred from codebase)

## Special Notes
- **Third-party Code**: Ignore `./src/sjcl.js` as it's a raw implementation of the crypto library