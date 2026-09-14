THIRD-PARTY LICENSES — Chess Vanguard
Copyright © 2026 Malek Hassan Ashour — All Rights Reserved (this notice file).

This file documents third-party components redistributed with Chess Vanguard.
The application code itself is proprietary ("All Rights Reserved"); nothing in
this file or the project's architecture places third-party copyleft licenses
onto the application code:

  * Chess Vanguard's own rules engine (src/chess) is an independent
    implementation with no code derived from Stockfish.
  * Stockfish runs as a SEPARATE PROCESS communicating over the text-based
    UCI protocol (stdin/stdout). There is NO static or dynamic linking.

────────────────────────────────────────────────────────────────────────────
1) Stockfish chess engine — GNU General Public License v3.0 (GPLv3)
────────────────────────────────────────────────────────────────────────────
  Copyright (C) 2004-2026 the Stockfish developers (see AUTHORS file).
  Homepage / source: https://github.com/official-stockfish/Stockfish
  License: GNU GPL v3 — full text included at:
      * assets/licenses/GPL-3.0.txt (repository)
      * resources/engines/COPYING.txt (bundled next to the binaries)

  Distribution details:
  * The UNMODIFIED official release binaries (e.g. stockfish-windows-x86-64-*.exe,
    stockfish-ubuntu-x86-64-*) are downloaded at build time from the official
    GitHub releases by scripts/fetch-engine.mjs and bundled OUTSIDE the app asar
    archive, as independent executables.
  * SHA-256 checksums and the exact release tag are recorded in
    resources/engines/manifest.json and printed by the build workflow.
  * Corresponding source code for the exact binaries is publicly available at
    the official repository above (releases page), satisfying GPL v3
    section 6.
  * Stockfish's trademarks belong to their respective owners; Chess Vanguard
    is not affiliated with or endorsed by the Stockfish project.

────────────────────────────────────────────────────────────────────────────
2) Electron / Chromium / Node.js / V8
────────────────────────────────────────────────────────────────────────────
  Electron: MIT — https://electronjs.org
  Chromium & V8: BSD 3-Clause, LGPL, MPL 2.0 and others — full notices are
  automatically bundled inside every distribution as LICENSES.chromium.html
  and LICENSE.electron.txt.
  Node.js: MIT (OpenJS Foundation).

────────────────────────────────────────────────────────────────────────────
3) Development-time tooling (NOT distributed inside the app binaries)
────────────────────────────────────────────────────────────────────────────
  TypeScript ........ Apache-2.0   https://typescriptlang.org
  Vite .............. MIT          https://vitejs.dev
  esbuild ........... MIT          https://esbuild.github.io
  electron-builder .. MIT          https://www.electron.build
  Vitest ............ MIT          https://vitest.dev
  ESLint ............ MIT          https://eslint.org
  typescript-eslint . MIT          https://typescript-eslint.io

  These tools are used to build Chess Vanguard. Their mention here is
  technical information only and does not attribute ownership of this
  project to them or their authors.

────────────────────────────────────────────────────────────────────────────
4) Runtime dependencies
────────────────────────────────────────────────────────────────────────────
  Chess Vanguard has ZERO npm runtime dependencies. Sounds are synthesized
  at runtime via the Web Audio API; fonts are operating-system fonts; UI
  icons are Unicode chess glyphs. No third-party assets are embedded.
