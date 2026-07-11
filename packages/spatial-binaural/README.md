# @audio/spatial-binaural [![npm](https://img.shields.io/npm/v/@audio/spatial-binaural)](https://www.npmjs.com/package/@audio/spatial-binaural) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Structural binaural panner — Brown-Duda spherical-head ITD + head-shadow ILD (no HRIR data)

```
npm install @audio/spatial-binaural
```

```js
import binaural from '@audio/spatial-binaural'
```

Places mono-collapsed input in space by azimuth: interaural time delay (Woodworth/Brown-Duda eq. 2) plus a one-pole-one-zero head-shadow filter (eq. 3-5), per C. P. Brown & R. O. Duda, "A Structural Model for Binaural Sound Synthesis," IEEE Trans. Speech and Audio Processing, 6(5), 1998. No HRIR/measured-response data — azimuth cues only, no elevation (see rationale below). Modifies `left`/`right` in place.

```js
binaural(left, right, { azimuth: -30 })   // both modified in place
```

| Param | Default | |
|---|---|---|
| `azimuth` | `0` | Degrees, -180..180 (0 front, +right) |
| `distance` | `1` | Meters — 1/distance gain falloff |
| `headRadius` | `0.0875` | Meters — Brown-Duda head model radius |
| `mix` | `1` | Dry/wet, 0..1 |
| `fs` | `44100` | Sample rate |

**Use when:** headphone spatialization without HRIR assets; azimuth-only — elevation (pinna echoes, Brown-Duda eq. 8) is out of scope because the paper's own scaling factor is a per-listener fit, not a general physical constant.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
