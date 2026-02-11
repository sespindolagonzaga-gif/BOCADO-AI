#!/usr/bin/env bash
set -euo pipefail

# Workaround for noexec mounts where esbuild binary can't run during postinstall
export ESBUILD_SKIP_DOWNLOAD=1

npm ci
node scripts/ensure-esbuild-binary.cjs
