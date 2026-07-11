# @audio/spatial-panner [![npm](https://img.shields.io/npm/v/@audio/spatial-panner)](https://www.npmjs.com/package/@audio/spatial-panner) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Stereo panner — constant-power panning

```
npm install @audio/spatial-panner
```

```js
import panner from '@audio/spatial-panner'
```

Constant-power (cos/sin law) stereo pan: collapses the input to mono, then splits it to `left`/`right` with equal-power gains so perceived loudness stays constant across the pan sweep. Modifies `left`/`right` in place.

```js
panner(left, right, { pan: -0.5 })   // both modified in place
```

| Param | Default | |
|---|---|---|
| `pan` | `0` | -1 (full left) .. 0 (center) .. +1 (full right) |

**Use when:** static or automated stereo placement; the LFO-driven sweep is [`spatial-autopan`](https://github.com/audiojs/spatial/tree/main/packages/spatial-autopan).

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
