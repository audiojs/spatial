# @audio/spatial-widener [![npm](https://img.shields.io/npm/v/@audio/spatial-widener)](https://www.npmjs.com/package/@audio/spatial-widener) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Stereo widener — mid/side processing to adjust stereo width

```
npm install @audio/spatial-widener
```

```js
import stereoWidener from '@audio/spatial-widener'
```

Mid/side widener: splits `left`/`right` into mid/side, scales side by `width`, recombines. `width=0` collapses to mono, `width=1` is passthrough, `width>1` emphasizes the side (stereo) content. Modifies `left`/`right` in place.

```js
stereoWidener(left, right, { width: 1.5 })   // both modified in place
```

| Param | Default | |
|---|---|---|
| `width` | `1.5` | 0 (mono) .. 1 (original) .. 2 (full side emphasis) |

**Use when:** simple, cheap width control; `spatial-midside` is the matrix underneath if you need mid/side access directly.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
