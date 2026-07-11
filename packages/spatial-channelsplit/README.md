# @audio/spatial-channelsplit [![npm](https://img.shields.io/npm/v/@audio/spatial-channelsplit)](https://www.npmjs.com/package/@audio/spatial-channelsplit) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Channel split/combine — multichannel ↔ mono planes (FFmpeg channelsplit)

```
npm install @audio/spatial-channelsplit
```

```js
import { split, combine } from '@audio/spatial-channelsplit'
```

Converts between a multichannel buffer and its per-channel mono planes — the FFmpeg `channelsplit`/`amerge` pair. `split` copies each channel into a fresh `Float32Array`; `combine` is the identity (the array of planes already *is* the channel layout other spatial atoms expect).

```js
let planes = split(channels)   // Float32Array[] → Float32Array[] (copies)
let channels2 = combine(planes) // Float32Array[] → Float32Array[] (identity)
```

| Export | Signature | |
|---|---|---|
| `split` | `(channels) => Float32Array[]` | copies each plane |
| `combine` | `(planes) => Float32Array[]` | identity — planes already are the channel array |

**Use when:** normalizing a channel-layout boundary between atoms that read planes directly (`spatial-panner`, `spatial-midside`) and ones that read a `Float32Array[]` (`spatial-delay`, `spatial-surround`).

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
