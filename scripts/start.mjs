#!/usr/bin/env node
/** Dev launcher: builds main/preload, then starts Electron against the built renderer (or a dev server URL). */
import { execSync, spawn } from 'node:child_process';

execSync('npx esbuild src/main/index.ts --bundle --platform=node --format=cjs --target=node20 --external:electron --outfile=build/main.js', { stdio: 'inherit' });
execSync('npx esbuild src/preload/index.ts --bundle --platform=node --format=cjs --target=node20 --external:electron --outfile=build/preload.js', { stdio: 'inherit' });

const env = { ...process.env };
if (process.env.CV_DEV_SERVER) env.CV_DEV_SERVER_URL = process.env.CV_DEV_SERVER;

const child = spawn('npx', ['electron', '.'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
child.on('close', (code) => process.exit(code ?? 0));
