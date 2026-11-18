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
| `distance` | `1` | Meters; the source's gain is 1/max(distance, 1) (below) |
| `headRadius` | `0.0875` | Meters — Brown-Duda head model radius |
| `mix` | `1` | Dry/wet, 0..1 |
| `fs` | `44100` | Sample rate |

`distance` follows the inverse distance law clamped at a reference distance of 1 m: the source's gain is 1/max(distance, 1), so 2 m is −6 dB, 10 m −20 dB, and anything nearer than 1 m (0 included) sounds as 1 m. This is OpenAL's Inverse Distance Clamped Model (OpenAL 1.1 Specification, §3.4.2: distance = max(distance, AL_REFERENCE_DISTANCE), gain = AL_REFERENCE_DISTANCE / (AL_REFERENCE_DISTANCE + AL_ROLLOFF_FACTOR · (distance − AL_REFERENCE_DISTANCE))) and the Web Audio API's "inverse" distance model (W3C Recommendation, 17 June 2021, §1.27, DistanceModelType: d_ref / (d_ref + f · (max(d, d_ref) − d_ref)), refDistance 1 by default), each with reference distance 1 m and rolloff 1. The clamp is what keeps the law finite: 1/distance alone gives 100 (+40 dB) at 1 cm and grows without bound toward 0. A move between two distances stays between their two levels.

For a host's block, `state(maxRadius, fs, rows)` makes the state once and `block(state, left, right, moving)` runs a block at the values in `state.v` (`[azimuth, distance, headRadius, mix, fs]`): a new `headRadius` glides across the block from where the last one ended, and nothing is allocated unless the radius passes `maxRadius`. While the distance or the mix moves (`moving` 1, 2, or 3 for both), they are read a sample at a time from `state.d` and `state.m`, `rows` frames each; the `audio.js` manifest glides a host's ramp of either into them. The ring grows in place for a larger head, every sample keeping its age. `tail(headRadius, fs)` is the seconds the output takes to fall 60 dB after the input stops: the farther ear's delay, then the head-shadow pole's decay.

**Use when:** headphone spatialization without HRIR assets; azimuth-only — elevation (pinna echoes, Brown-Duda eq. 8) is out of scope because the paper's own scaling factor is a per-listener fit, not a general physical constant.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
