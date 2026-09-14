# Stockfish binaries (fetched at build time — never committed)

This directory receives the official, UNMODIFIED Stockfish binaries downloaded by
`scripts/fetch-engine.mjs` from the official releases:

  https://github.com/official-stockfish/Stockfish  (GPLv3)

Layout produced by the script:

    resources/engines/
      win32/stockfish-x86-64-avx2.exe     (preference 1)
      win32/stockfish-x86-64.exe          (preference 2 / baseline)
      linux/stockfish-x86-64-avx2
      linux/stockfish-x86-64
      COPYING.txt   <- full GPLv3 text (copied from assets/licenses/GPL-3.0.txt)
      NOTICE.txt    <- redistribution notice + source pointer
      manifest.json <- exact release tag + SHA-256 per binary

The `resources/engines/*` contents are gitignored (binaries are ~40-80 MB each);
CI downloads them fresh on every build. The app resolves binaries only from
these FIXED paths (never from user input) and spawns them as independent
subprocesses speaking UCI over stdin/stdout — see THIRD_PARTY_LICENSES.md.
