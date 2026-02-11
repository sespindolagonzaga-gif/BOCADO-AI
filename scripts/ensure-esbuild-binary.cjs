#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, '.esbuild-binary-path');

const platform = process.platform;
const arch = process.arch;

const pkgByPlatformArch = {
  'linux:x64': '@esbuild/linux-x64',
  'linux:arm64': '@esbuild/linux-arm64',
  'darwin:x64': '@esbuild/darwin-x64',
  'darwin:arm64': '@esbuild/darwin-arm64',
  'win32:x64': '@esbuild/win32-x64',
  'win32:arm64': '@esbuild/win32-arm64',
  'win32:ia32': '@esbuild/win32-ia32',
};

const key = `${platform}:${arch}`;
const pkgName = pkgByPlatformArch[key];
if (!pkgName) {
  console.warn(`[esbuild] Unsupported platform/arch: ${key}. Skipping workaround.`);
  process.exit(0);
}

let pkgJsonPath;
try {
  pkgJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [ROOT] });
} catch (err) {
  console.warn(`[esbuild] Could not resolve ${pkgName}. Skipping workaround.`);
  process.exit(0);
}

const pkgDir = path.dirname(pkgJsonPath);
const binName = platform === 'win32' ? 'esbuild.exe' : 'esbuild';
const binPath = path.join(pkgDir, 'bin', binName);

const tryRun = (p) => {
  const res = spawnSync(p, ['--version'], { stdio: 'pipe' });
  if (res.error) return res.error;
  return null;
};

const err = tryRun(binPath);
if (!err) {
  if (fs.existsSync(OUT_FILE)) {
    fs.unlinkSync(OUT_FILE);
  }
  process.exit(0);
}

if (err.code !== 'EPERM') {
  console.warn(`[esbuild] Binary check failed: ${err.message}`);
  process.exit(0);
}

const tmpBin = path.join(os.tmpdir(), `esbuild-${platform}-${arch}${platform === 'win32' ? '.exe' : ''}`);
try {
  fs.copyFileSync(binPath, tmpBin);
  fs.chmodSync(tmpBin, 0o755);
  const err2 = tryRun(tmpBin);
  if (err2) {
    console.warn(`[esbuild] Copied binary still failing: ${err2.message}`);
    process.exit(1);
  }
  fs.writeFileSync(OUT_FILE, tmpBin, 'utf8');
  console.log(`[esbuild] Workaround active. Using binary: ${tmpBin}`);
} catch (copyErr) {
  console.warn(`[esbuild] Workaround failed: ${copyErr.message}`);
  process.exit(1);
}
