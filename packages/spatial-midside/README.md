# @audio/spatial-midside [![npm](https://img.shields.io/npm/v/@audio/spatial-midside)](https://www.npmjs.com/package/@audio/spatial-midside) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Mid/side encode-decode — L/R ↔ M/S matrix with width control

```
npm install @audio/spatial-midside
```

```js
import { encode, decode } from '@audio/spatial-midside'
```

The L/R ↔ M/S matrix: `mid = (L+R)/2`, `side = (L-R)/2`, and back. The substrate under [`spatial-widener`](https://github.com/audiojs/spatial/tree/main/packages/spatial-widener), [`@audio/vocals`](https://github.com/audiojs/vocals) isolate/remove, and any M/S-domain processing. Both directions modify their input pair in place.

```js
encode([L, R])                    // → [M, S], in place
decode([M, S], { width: 1.5 })    // → [L, R], in place; width scales side before recombining
```

| Export | Signature | |
|---|---|---|
| `encode` | `([left, right]) => [mid, side]` | in-place, `mid=(L+R)/2`, `side=(L-R)/2` |
| `decode` | `([mid, side], { width=1 }) => [left, right]` | in-place, `left=mid+side·width`, `right=mid-side·width` |

**Use when:** any effect that operates on mid/side rather than left/right — width control, vocal isolation, M/S EQ.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
