# @audio/spatial-delay [![npm](https://img.shields.io/npm/v/@audio/spatial-delay)](https://www.npmjs.com/package/@audio/spatial-delay) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Per-channel delay in ms/samples (FFmpeg adelay)

```
npm install @audio/spatial-delay
```

```js
import delay from '@audio/spatial-delay'
```

Per-channel integer-sample delay, zero-filled at the head (or tail, for negative shifts) — the FFmpeg `adelay` filter. Modifies each channel in place via `copyWithin`.

```js
delay(channels, { delays: [0, 15] })   // right channel delayed 15ms, both modified in place
```

| Param | Default | |
|---|---|---|
| `delays` | `[]` | Per-channel delay, milliseconds |
| `samples` | — | Per-channel delay, samples — overrides `delays` when given |
| `fs` | `44100` | Sample rate |

**Use when:** aligning channels for Haas/decorrelation effects, or as the delay primitive under `spatial-surround`'s Ls/Rs decorrelation.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
