# @audio/spatial-haas [![npm](https://img.shields.io/npm/v/@audio/spatial-haas)](https://www.npmjs.com/package/@audio/spatial-haas) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Haas effect — delays one channel by 1–35 ms to create phantom stereo image

```
npm install @audio/spatial-haas
```

```js
import haas from '@audio/spatial-haas'
```

Delays one channel by a short interval (precedence effect range, 1–35 ms) to widen a mono or near-mono source into a phantom stereo image without changing tonal balance. Modifies `left`/`right` in place; the delay buffer/pointer are carried on `params`.

```js
haas(left, right, { time: 0.02, channel: 'right' })   // both modified in place
```

| Param | Default | |
|---|---|---|
| `time` | `0.02` | Delay, seconds (1–35 ms is the precedence-effect range) |
| `channel` | `'right'` | Which channel is delayed: `'left'` or `'right'` |
| `fs` | `44100` | Sample rate |

**Use when:** widening a mono source cheaply; reuse the same `params` object across calls — the delay buffer persists there.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
