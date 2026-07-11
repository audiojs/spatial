# @audio/spatial-surround [![npm](https://img.shields.io/npm/v/@audio/spatial-surround)](https://www.npmjs.com/package/@audio/spatial-surround) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Stereo → 5.1 matrix upmix — C/LFE/Ls/Rs derivation (documented simple matrix)

```
npm install @audio/spatial-surround
```

```js
import surround from '@audio/spatial-surround'
```

Stereo → 5.1 matrix upmix: `C` is mid content, `L`/`R` pass through, `Ls`/`Rs` are the delayed/decorrelated side signal (±), `LFE` is a lowpassed mono sum. A simple, documented matrix upmix — not Dolby Pro Logic decoding. Returns a new `[L, R, C, LFE, Ls, Rs]` array.

```js
let [L, R, C, LFE, Ls, Rs] = surround([left, right], { surroundDelay: 0.012, lfeCut: 120 })
```

| Param | Default | |
|---|---|---|
| `fs` | `44100` | Sample rate |
| `surroundDelay` | `0.012` | Ls/Rs decorrelation delay, seconds |
| `lfeCut` | `120` | LFE lowpass cutoff, Hz |

**Use when:** a cheap, transparent upmix path is enough — not for decoding matrix-encoded (Dolby Surround/ProLogic) content, which needs an actual decoder.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
