#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, '.esbuild-binary-path');

let cmdArgs = process.argv.slice(2);
if (cmdArgs[0] === '--') cmdArgs = cmdArgs.slice(1);
if (cmdArgs.length === 0) {
  console.error('[with-esbuild] Missing command');
  process.exit(1);
}

if (fs.existsSync(OUT_FILE)) {
  const p = fs.readFileSync(OUT_FILE, 'utf8').trim();
  if (p) {
    process.env.ESBUILD_BINARY_PATH = p;
  }
}

const cmd = cmdArgs[0];
const args = cmdArgs.slice(1);
const child = spawn(cmd, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
