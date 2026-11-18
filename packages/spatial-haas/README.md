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

For a host's block, `line(max)` makes one channel's line, a ring for up to `max` samples of delay, and `follow(line, x, y, want, moving)` runs `x` through it into `y`, its read moving toward the delay asked (`want[i]` samples for sample `i` while `moving` is 1, `want[0]` throughout when it is 0) at no more than half a frame farther or a frame nearer a frame, as a tape head runs between half and double speed: a move bends the echo by an octave at most and never stops or reverses the read. A whole delay reads one sample, a fractional one between two. It allocates nothing. The `audio.js` manifest runs both channels through such lines, so `time` and `channel` are live: `time` is glided sample by sample (the host's 20 ms ramp, 32 frames late, so a move is the same however the host cuts its calls, to the float32 rounding of the host's values) and held it reads whole samples, bit for bit as `haas` does; a move from 10 to 30 ms takes 40 ms at half speed, from 35 to 1 ms 34 ms at double speed. A new `channel` moves both reads at that bound from the call it comes with: the channel delayed now grows to the time at half speed, the other falls to 0 at double speed.

**Use when:** widening a mono source cheaply; reuse the same `params` object across calls — the delay buffer persists there.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
