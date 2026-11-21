# SOLARA BAY — an open-world crime story

[![make.fun bounty gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Fliztone/makefun-gta6-01-fg2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Fliztone/makefun-gta6-01-fg2/reward.svg)](https://make.fun/bounty/gta6-01)

A complete, original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Sun-soaked coastal city,
carjacking, wanted levels, police chases, gunplay, a five-mission story, minimap,
procedural WebAudio soundtrack — all from static files, offline, in desktop Chrome.

**Everything is original**: the city of Solara Bay, Dante Cruz, Lola Reyes, the cars
(Sunray GT, Marlin, Dorado, Brisa, Furgón), the signage and the synth soundtrack.
No assets, names or art from Rockstar Games or any commercial game.

## Play

Serve the `game/` folder with any static server, then open it in desktop Chrome:

```
node serve.ts          # http://localhost:8080
```

No build step, no network requests — three.js is vendored as `game/vendor/three.min.js`.

### Controls

| Input | Action |
| --- | --- |
| W A S D | move on foot / drive |
| Mouse | look (click to lock) |
| LMB / RMB | shoot / aim |
| E or F | enter car · carjack · exit |
| Shift | sprint |
| Space | jump / handbrake |
| R | reload |
| Esc | pause (save / resume / restart) |
| M | mute |

## The story

You are **Dante Cruz**, fresh off the bus in Solara Bay with empty pockets.
Fixer **Lola Reyes** has five jobs:

1. **New in Town** — meet Lola at Plaza del Sol.
2. **Wheels of Fortune** — steal the pink Sunray GT from the marina.
3. **Hot Cargo** — a watched drop at the docks, a delivery across town.
4. **Neon Circuit** — an eight-checkpoint street race against the clock.
5. **The Big Score** — rob Banco Solara and vanish into the sunset.

## Systems

- Procedural city: street grid, pastel towers, neon signage, palms, parks, beach, pier
- Third-person on-foot movement + arcade driving with drift and skid marks
- AI traffic in right-hand lanes, pedestrians who flee gunfire and speeding cars
- Carjacking any vehicle, wanted stars, police pursuit / ramming / arrests
- Pistol combat with tracers, muzzle flash, impacts
- HUD: minimap, stars, cash, health, objectives, speedometer, ammo
- Sunset sky shader, animated ocean with sun glitter, shadows, particles
- Procedural WebAudio: engine, sirens, gunfire, skids, ocean, synth pad
- Save / continue via localStorage

## Entry plumbing

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR`
(default `/output`) and writes `dossier.json` with the kit's `buildDossier`.

## License

MIT — see [LICENSE](LICENSE).