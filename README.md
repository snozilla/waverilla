# Wave Rilla

A 3D jet ski racing game built with Three.js. Race against 5 AI opponents across water-based tracks with dynamic waves, power-ups, and physics-based collisions.

## Features

- **4 Tracks** — Tropical Loop (Easy), Shark Bay (Medium), Typhoon Run (Hard), Dragon's Wake (Expert)
- **Dynamic Water** — Gerstner wave simulation with buoyancy physics
- **Power-Ups** — Turbo, Laser, Electric Shield, Giant mode
- **AI Opponents** — 5 rubber-band AI racers with pathfinding
- **Boost Pads** — Scattered across tracks for speed bursts
- **Tackle System** — Stun opponents with well-timed collisions
- **HUD & Minimap** — Real-time position tracking and race info
- **Procedural Audio** — Dynamic engine sounds and per-track music

## Controls

| Key | Action |
|---|---|
| W / Arrow Up | Accelerate |
| S / Arrow Down | Reverse |
| A/D / Arrow Left/Right | Steer |
| Shift | Boost |
| Space | Jump |
| X | Tackle |
| Esc | Pause |

## Getting Started

Requires a local web server (ES modules don't load via `file://`).

```bash
# Python
python -m http.server 8000

# Node.js
npx http-server
```

Then open `http://localhost:8000` in your browser.

## Tech Stack

- **Three.js** — 3D rendering, scene management, post-processing (Bloom, FXAA)
- **GLSL Shaders** — Water surface wave simulation
- **Web Audio API** — Procedural engine sounds and music
- **HTML5 Canvas** — HUD, minimap, track preview
- **Vanilla JS** — ES6 modules, no frameworks or build tools
