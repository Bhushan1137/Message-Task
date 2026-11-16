const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function main() {
  const isRunning = await checkPort(5432);
  if (isRunning) {
    console.log('[DB] PostgreSQL is already running on port 5432.');
    return;
  }

  console.log('[DB] Starting local PostgreSQL...');
  const rootDir = path.resolve(__dirname, '..');
  const pgdataDir = path.join(rootDir, '.pgdata');
  const binDir = path.join(rootDir, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');
  const postgresExe = path.join(binDir, 'postgres.exe');

  if (!fs.existsSync(postgresExe)) {
    console.error('[DB] PostgreSQL executable not found at:', postgresExe);
    process.exit(1);
  }

  const child = spawn(postgresExe, ['-D', pgdataDir], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  // Wait for it to become ready
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkPort(5432)) {
      console.log('[DB] PostgreSQL started successfully on port 5432.');
      return;
    }
  }

  console.error('[DB] Timed out waiting for PostgreSQL to start.');
  process.exit(1);
}

main().catch(console.error);
