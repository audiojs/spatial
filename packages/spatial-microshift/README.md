# @audio/spatial-microshift [![npm](https://img.shields.io/npm/v/@audio/spatial-microshift)](https://www.npmjs.com/package/@audio/spatial-microshift) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Micro-pitch stereo widener — ±cents detuned copies (H3000 MicroShift class)

```
npm install @audio/spatial-microshift
```

```js
import microshift from '@audio/spatial-microshift'
```

Eventide H3000 MicroShift class: left is pitch-shifted up a few cents, right down, each via a 2-head varispeed ring reader, then blended with the dry signal. The pitch offset (rather than a delay) is what gives the width its shimmer. Takes `[left, right]` and an opts object; returns a new `[left, right]` pair.

```js
microshift([left, right], { cents: 9, mix: 0.5 })
```

| Param | Default | |
|---|---|---|
| `cents` | `9` | Detune amount, cents (L up, R down) |
| `mix` | `0.5` | Dry/wet, 0..1 |
| `fs` | `44100` | Sample rate |

**Use when:** subtle stereo widening with a pitch-modulation character, distinct from mid/side widening (`spatial-widener`) or delay-based widening (`spatial-haas`).

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
