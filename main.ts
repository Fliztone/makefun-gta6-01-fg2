// Solara Bay — a make.fun gta6-01 entry (Node 22, standard library only).
// The game lives in game/: plain static files that desktop Chrome plays offline
// (index.html + ES modules + vendored three.min.js, no network request).
// This program hands the entry in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json with buildDossier from the
// kit's vendored library, exactly as the starter's main.ts does.
//
// Serve locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: dossier text <= 160 KiB, at most 4 screenshots of <= 256 KiB,
// game/ at most 993 entries / 48 MiB, every path <= 1000 UTF-8 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
// build marker