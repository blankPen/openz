#!/usr/bin/env node

import { startServer } from './server.js';

const DEFAULT_PORT = 19998;

async function main() {
  const args = process.argv.slice(2);

  if (!args[0] || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Openz Server v0.1.0

Usage:
  openz-server start [options]

Options:
  --port <port>    Port to listen on (default: ${DEFAULT_PORT})

Examples:
  openz-server start
  openz-server start --port 19998
    `.trim());
    process.exit(0);
  }

  if (args[0] === 'start') {
    const portArg = args.findIndex((arg, i) => arg === '--port' && args[i + 1]);
    const port = portArg !== -1 ? parseInt(args[portArg + 1], 10) : DEFAULT_PORT;
    await startServer(port);
  } else {
    console.log(`Unknown command: ${args[0]}`);
    process.exit(1);
  }
}

main().catch(console.error);
