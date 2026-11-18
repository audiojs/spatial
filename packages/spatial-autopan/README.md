# @audio/spatial-autopan [![npm](https://img.shields.io/npm/v/@audio/spatial-autopan)](https://www.npmjs.com/package/@audio/spatial-autopan) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Auto-panner — LFO-driven stereo panning. Constant-power cos/sin law

```
npm install @audio/spatial-autopan
```

```js
import autoPanner from '@audio/spatial-autopan'
```

Collapses the input to mono (mid) each sample, then sweeps it between speakers with a sine LFO through the same constant-power cos/sin law as [`spatial-panner`](https://github.com/audiojs/spatial/tree/main/packages/spatial-panner). Modifies `left`/`right` in place; sweep phase is carried on `params._phase` across calls.

```js
autoPanner(left, right, { rate: 0.5, depth: 1 })   // both modified in place
```

| Param | Default | |
|---|---|---|
| `rate` | `0.5` | Sweep speed, Hz (0.01–20) |
| `depth` | `1` | Sweep excursion, 0 (center) – 1 (full L/R) |
| `fs` | `44100` | Sample rate |

For a host's block, `sweep(st, left, right, rate, depth, moving)` runs the same sweep with its state in a typed array, `st = Float64Array.of(0, fs)` (the phase, then the sample rate), so nothing is allocated: `rate[0]` is read once a block (a new rate bends the sweep, the phase going on from where it is), the depth is `depth[i]` for sample `i` while `moving` is 1, `depth[0]` throughout when it is 0. The `audio.js` manifest glides a host's ramp of `depth` sample by sample into it (its `smoothing` is 10 ms).

**Use when:** tremolo-style auto-pan; the sweep is continuous across blocks — reuse the same `params` object per instance.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
