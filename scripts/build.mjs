#!/usr/bin/env node
/**
 * Chess Vanguard — build orchestrator.
 * 1) Renderer (Vite)  -> build/renderer
 * 2) Main process (esbuild, CJS bundle) -> build/main.js
 * 3) Preload (esbuild, CJS bundle, sandbox-safe) -> build/preload.js
 * Exits non-zero on the first failure. Prints explicit evidence lines.
 */
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

function run(label, cmd) {
  console.log(`\n[build] ${label}: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  console.log(`[build] ${label} EXIT=0`);
}

try {
  run('renderer (vite)', 'npx vite build');
  run('main (esbuild)', 'npx esbuild src/main/index.ts --bundle --platform=node --format=cjs --target=node20 --external:electron --outfile=build/main.js');
  run('preload (esbuild)', 'npx esbuild src/preload/index.ts --bundle --platform=node --format=cjs --target=node20 --external:electron --outfile=build/preload.js');

  const artifacts = ['build/renderer/index.html', 'build/main.js', 'build/preload.js'];
  for (const a of artifacts) {
    if (!existsSync(a)) throw new Error(`Missing build artifact: ${a}`);
    const kb = (statSync(a).size / 1024).toFixed(1);
    console.log(`[build] artifact OK: ${a} (${kb} KB)`);
  }
  console.log('\n[build] BUILD SUCCESS');
  process.exit(0);
} catch (e) {
  console.error(`\n[build] BUILD FAILED: ${e.message}`);
  process.exit(1);
}
