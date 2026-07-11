# @audio/spatial-crossfeed [![npm](https://img.shields.io/npm/v/@audio/spatial-crossfeed)](https://www.npmjs.com/package/@audio/spatial-crossfeed) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Headphone crossfeed filter

```
npm install @audio/spatial-crossfeed
```

```js
import crossfeed from '@audio/spatial-crossfeed'
```

Bauer stereophonic-to-binaural (BS2B) crossfeed: mixes a lowpassed copy of each channel into the other, reducing the hard L/R separation that reads as unnatural over headphones. `direct + cross` sums to unity, so mono/correlated content stays at ~unity gain. Modifies `left`/`right` in place; requires a `params` object (not optional — the coefficients cache there and rebuild on `fc`/`fs`/`level` change).

```js
crossfeed(left, right, { fc: 700, level: 0.3 })   // both modified in place
```

| Param | Default | |
|---|---|---|
| `fc` | `700` | Crossfeed lowpass cutoff, Hz |
| `level` | `0.3` | Mix amount, 0..1 |
| `fs` | `44100` | Sample rate |

**Use when:** headphone playback of stereo content mixed/mastered for speakers.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
