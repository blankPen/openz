#!/usr/bin/env node
import { startDaemon } from './daemon/server.js';
import { DEFAULT_PORT, getDaemonStatePath } from './daemon/types.js';
import { existsSync, readFileSync } from 'fs';
function getStatus() {
    const path = getDaemonStatePath();
    if (!existsSync(path)) {
        console.log('Daemon is not running');
        return;
    }
    try {
        const state = JSON.parse(readFileSync(path, 'utf-8'));
        console.log(`Daemon is running (PID: ${state.pid}, Port: ${state.port}, Started: ${new Date(state.startedAt).toISOString()})`);
    }
    catch {
        console.log('Daemon is not running');
    }
}
async function stopDaemon() {
    const path = getDaemonStatePath();
    if (!existsSync(path)) {
        console.log('Daemon is not running');
        return;
    }
    try {
        const state = JSON.parse(readFileSync(path, 'utf-8'));
        process.kill(state.pid, 'SIGTERM');
        console.log('Daemon stopped');
    }
    catch (err) {
        console.log(`Failed to stop daemon: ${err.message}`);
    }
}
async function main() {
    const args = process.argv.slice(2);
    const [command, ...subArgs] = args;
    if (!command || command === '--help' || command === '-h') {
        console.log(`
Uran CLI v0.1.0

Usage:
  uran <command> [options]

Commands:
  daemon start [--port <port>]   Start the daemon (default port: ${DEFAULT_PORT})
  daemon stop                    Stop the daemon
  daemon status                  Check daemon status
  sessions list                  List all sessions
  sessions delete <id>           Delete a session

Examples:
  uran daemon start
  uran daemon start --port 19999
  uran daemon status
  uran sessions list
    `.trim());
        process.exit(0);
    }
    if (command === 'daemon') {
        const action = subArgs[0];
        if (action === 'start' || action === 'restart') {
            // Stop existing daemon first
            await stopDaemon();
            // Small delay to ensure port is freed
            await new Promise(r => setTimeout(r, 500));
            const portArg = subArgs.find((arg, i) => arg === '--port' && subArgs[i + 1]);
            const port = portArg ? parseInt(subArgs[subArgs.indexOf(portArg) + 1], 10) : DEFAULT_PORT;
            await startDaemon(port);
        }
        else if (action === 'stop') {
            await stopDaemon();
        }
        else if (action === 'status') {
            getStatus();
        }
        else {
            console.log(`Unknown daemon action: ${action}`);
            process.exit(1);
        }
    }
    else if (command === 'sessions') {
        const action = subArgs[0];
        if (action === 'list') {
            console.log('Sessions list (via HTTP API)');
        }
        else if (action === 'delete' && subArgs[1]) {
            console.log(`Delete session: ${subArgs[1]}`);
        }
    }
    else {
        console.log(`Unknown command: ${command}`);
        process.exit(1);
    }
}
main().catch(console.error);
