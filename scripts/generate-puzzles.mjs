#!/usr/bin/env node
/** Wrapper: bundles scripts/gen-puzzles.ts with esbuild, runs it. Deterministic output. */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(here, '.cache', 'gen-puzzles.mjs');
mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [join(here, 'gen-puzzles.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent'
});

await import(outfile);
