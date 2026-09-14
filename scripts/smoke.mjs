#!/usr/bin/env node
/**
 * Headless smoke test: builds the app, then runs Electron under Xvfb with
 * --smoke. Main process exits 0 with SMOKE_OK only after the window opened
 * AND the renderer signalled readiness. This verifies boot integrity, not
 * interactive behavior (see FINAL_REPORT Known Limitations).
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
execSync('node scripts/build.mjs', { stdio: 'inherit' });

// Prefer xvfb-run (needs xauth); fall back to managing a bare Xvfb display.
let xvfbProc = null;
let env = { ...process.env };
if (process.platform === 'linux' && existsSync('/usr/bin/Xvfb')) {
  if (existsSync('/usr/bin/xauth')) {
    const child = spawn('xvfb-run', ['-a', 'npx', 'electron', '.', '--smoke', '--no-sandbox'], { stdio: 'inherit' });
    await waitFor(child);
    process.exit(child.exitCode ?? 1);
  }
  xvfbProc = spawn('/usr/bin/Xvfb', [':99', '-screen', '0', '1280x840x24'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  env.DISPLAY = ':99';
}

console.log('[smoke] launching electron (headless-safe)');
const playMode = args.includes('--play');
const electronArgs = playMode
  ? ['electron', '.', '--smoke-play', '--no-sandbox']
  : ['electron', '.', '--smoke', '--no-sandbox'];
const child = spawn('npx', electronArgs, { stdio: 'inherit', env, shell: process.platform === 'win32' });
await waitFor(child);
if (xvfbProc) xvfbProc.kill('SIGTERM');
process.exit(child.exitCode ?? 1);

function waitFor(child) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      console.error('[smoke] TIMEOUT after 120s');
      child.kill('SIGKILL');
      process.exitCode = 1;
      resolve();
    }, 120000);
    child.on('close', code => {
      clearTimeout(timer);
      const ok = code === 0;
      console.log(`[smoke] exit=${code} ${ok ? 'SMOKE_PASS' : 'SMOKE_FAIL'}`);
      process.exitCode = ok ? 0 : 1;
      resolve();
    });
  });
}
