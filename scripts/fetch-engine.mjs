#!/usr/bin/env node
/**
 * Downloads the OFFICIAL, UNMODIFIED Stockfish binary (GPLv3) from the
 * official Stockfish GitHub releases into resources/engines/<os>/.
 * No linking, no modification — pure redistribution of the upstream binary,
 * accompanied by its license (GPL-3.0) and source pointer (NOTICE).
 *
 * Usage: node scripts/fetch-engine.mjs [--os win32|linux|darwin] [--tag latest|sf_18]
 * Env:   STOCKFISH_TAG (pin), GITHUB_TOKEN (optional, avoids API rate limits)
 */
import { mkdir, readdir, stat, writeFile, copyFile, chmod, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINES_DIR = path.join(ROOT, 'resources', 'engines');
const API = 'https://api.github.com/repos/official-stockfish/Stockfish/releases';

const args = process.argv.slice(2);
function arg(name, def) { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; }
const osName = arg('os', process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux');
const tag = arg('tag', process.env.STOCKFISH_TAG || 'latest');

const PREFS = {
  win32: ['stockfish-windows-x86-64-avx2.zip', 'stockfish-windows-x86-64.zip'],
  linux: ['stockfish-ubuntu-x86-64-avx2.tar', 'stockfish-ubuntu-x86-64.tar'],
  darwin: ['stockfish-macos-x86-64-avx2.tar', 'stockfish-macos-x86_64.tar']
};

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function githubJson(url) {
  const headers = { 'User-Agent': 'ChessVanguard-Build', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return res.json();
}

async function download(url, dest) {
  const headers = { 'User-Agent': 'ChessVanguard-Build' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`download failed ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function main() {
  let release;
  try {
    release = await githubJson(tag === 'latest' ? `${API}/latest` : `${API}/tags/${tag}`);
  } catch (e) {
    // API rate-limited/unreachable: fall back to the pinned official release
    // using DIRECT download URLs (these bypass the REST API entirely).
    const pinned = 'sf_18';
    console.log(`[engine] GitHub API unavailable (${e.message}) — falling back to pinned official release ${pinned} (direct URLs)`);
    const names = PREFS[osName] || [];
    release = {
      tag_name: pinned,
      assets: names.map(n => ({ name: n, browser_download_url: `https://github.com/official-stockfish/Stockfish/releases/download/${pinned}/${n}` }))
    };
  }
  console.log(`[engine] release: ${release.tag_name} (os=${osName})`);
  const assets = release.assets || [];
  const chosen = [];
  for (const pref of PREFS[osName] || []) {
    const a = assets.find(x => x.name === pref);
    if (a) chosen.push(a);
  }
  if (!chosen.length) throw new Error(`no stockfish assets found for os=${osName}`);

  const osDir = path.join(ENGINES_DIR, osName);
  const tmpDir = path.join(ENGINES_DIR, '.tmp');
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(osDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  const manifest = [];
  let idx = 0;
  for (const asset of chosen) {
    idx++;
    const isZip = asset.name.endsWith('.zip');
    const isTar = asset.name.endsWith('.tar');
    if (!isZip && !isTar) continue;
    const variant = asset.name
      .replace('stockfish-windows-', '').replace('stockfish-ubuntu-', '').replace('stockfish-macos-', '')
      .replace(/\.zip$|\.tar$/, '');
    const archive = path.join(tmpDir, asset.name);
    const size = await download(asset.browser_download_url, archive);
    console.log(`[engine] downloaded ${asset.name} (${(size / 1e6).toFixed(1)} MB)`);
    const extractDir = path.join(tmpDir, `x${idx}`);
    await mkdir(extractDir, { recursive: true });
    if (isTar) {
      execFileSync('tar', ['-xf', archive, '-C', extractDir], { stdio: 'inherit' });
    } else {
      // Windows runners ship bsdtar which reads zip; fall back to python otherwise.
      try { execFileSync('tar', ['-xf', archive, '-C', extractDir], { stdio: 'inherit' }); }
      catch { execFileSync('python3', ['-m', 'zipfile', '-e', archive, extractDir], { stdio: 'inherit' }); }
    }
    // locate the stockfish binary (largest executable-looking file named stockfish*)
    let binary = null, best = 0;
    for await (const f of walk(extractDir)) {
      const base = path.basename(f).toLowerCase();
      if (!base.startsWith('stockfish')) continue;
      if (osName === 'win32' && !base.endsWith('.exe')) continue;
      const s = (await stat(f)).size;
      if (s > best) { best = s; binary = f; }
    }
    if (!binary) throw new Error(`no binary found inside ${asset.name}`);
    const outName = osName === 'win32' ? `stockfish-${variant}.exe` : `stockfish-${variant}`;
    const outPath = path.join(osDir, outName);
    await copyFile(binary, outPath);
    if (osName !== 'win32') await chmod(outPath, 0o755);
    const hash = sha256(outPath);
    manifest.push({ name: outName, bytes: (await stat(outPath)).size, sha256: hash, sourceAsset: asset.name, source: 'https://github.com/official-stockfish/Stockfish' });
    console.log(`[engine] installed ${outPath}`);
    console.log(`[engine] sha256(${outName}) = ${hash}`);
  }

  await rm(tmpDir, { recursive: true, force: true });

  // license + notice travel WITH the binaries
  const gpl = path.join(ROOT, 'assets', 'licenses', 'GPL-3.0.txt');
  await copyFile(gpl, path.join(ENGINES_DIR, 'COPYING.txt'));
  const notice =
    'Chess Vanguard bundles the UNMODIFIED Stockfish chess engine binary (GPLv3)\n' +
    'as an independent external process communicating over the UCI protocol.\n' +
    'Stockfish is NOT linked (statically or dynamically) into Chess Vanguard code.\n\n' +
    `Bundled release: ${release.tag_name}\n` +
    'Official source code: https://github.com/official-stockfish/Stockfish\n' +
    'License: GNU General Public License v3 — see COPYING.txt next to this file.\n';
  await writeFile(path.join(ENGINES_DIR, 'NOTICE.txt'), notice, 'utf-8');

  await writeFile(path.join(ENGINES_DIR, 'manifest.json'), JSON.stringify({
    version: release.tag_name,
    os: osName,
    preference: manifest.map(m => m.name),
    files: manifest
  }, null, 2));
  console.log(`[engine] manifest.json written (${manifest.length} binaries, preference order: ${manifest.map(m => m.name).join(', ')})`);
  console.log('[engine] DONE');
}

main().catch(e => { console.error(`[engine] FAILED: ${e.message}`); process.exit(1); });
