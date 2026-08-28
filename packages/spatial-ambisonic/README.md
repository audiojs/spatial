# @audio/spatial-ambisonic [![npm](https://img.shields.io/npm/v/@audio/spatial-ambisonic)](https://www.npmjs.com/package/@audio/spatial-ambisonic) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Ambisonics — encode/rotate/decode, 1st-3rd order (HOA), ACN/SN3D (AmbiX), FuMa conversion

```
npm install @audio/spatial-ambisonic
```

```js
import { encode, decode, rotate } from '@audio/spatial-ambisonic'
```

Encodes mono sources into ambisonic B-format (real spherical harmonics up to order 3, ACN channel order, SN3D normalization — the AmbiX convention), rotates the encoded field by yaw/pitch/roll, and decodes it to a speaker layout or to binaural. SH definitions and SN3D/N3D normalization follow F. Zotter & M. Frank, *Ambisonics* (Springer Open, 2019) and J. Daniel's 2001 PhD thesis; ACN/SN3D and FuMa conversion follow Nachbar, Zotter, Deleflie & Sontacchi, "AMBIX — A Suggested Ambisonics Format" (Ambisonics Symposium 2011); max-rE weighting follows Gerzon's energy-vector criterion (1973/1985) as formalized by Daniel; the DirAC-style `direction()` analysis follows Merimaa & Pulkki (2005). For headphone output it decodes to a virtual speaker set and reuses [`@audio/spatial-binaural`](https://github.com/audiojs/spatial/tree/main/packages/spatial-binaural)'s structural (Brown-Duda) binaural panner per speaker.

**Convention:** azimuth in degrees, counter-clockwise from front (0° = front, +90° = left, -90° = right); elevation in degrees, positive up. This is the opposite sign of `spatial-binaural`'s azimuth (0° front, +right) — `decode(..., {layout:'binaural'})` converts explicitly at the boundary; nothing else in this package touches binaural's convention.

```js
let mono = new Float32Array(44100)   // ...fill with a source signal
let bformat = encode(mono, { order: 1, az: 30, el: 0 })   // 4 channels, ACN/SN3D

let rotated = rotate(bformat, { yaw: 90 })                 // new arrays

let [L, R] = decode(rotated, { layout: 'stereo' })          // ±30° stereo
let [l, r] = decode(rotated, { layout: 'binaural' })        // headphones
let speakers = decode(rotated, { layout: 'octagon', weighting: 'maxre' })
```

### `encode(input, options)`

| Option | Default | |
|---|---|---|
| `order` | `1` | Ambisonic order, 0-3 → `(order+1)²` output channels |
| `az`, `el` | `0`, `0` | Degrees; ignored when `input` is an array of sources |
| `gain` | `1` | Linear; ignored when `input` is an array of sources |
| `norm` | `'sn3d'` | `'sn3d'` \| `'n3d'` |

`input` is either a mono `Float32Array` (uses the options above) or an array of `{ data, az, el, gain }` sources, each with its own static direction, summed into the same output. No distance/near-field compensation — encode has no `distance` option (see Limits).

### `decode(channels, options)`

| Option | Default | |
|---|---|---|
| `layout` | `'stereo'` | `'stereo'` (±30°) \| `'quad'` \| `'5.1'` \| `'7.1'` \| `'cube'` \| `'octagon'` \| `'binaural'` \| custom `[{az, el}]` |
| `method` | `'sampling'` | `'sampling'` (projection decoder) \| `'basic'` (mode-matching / pseudo-inverse) |
| `weighting` | `'maxre'` | `'basic'` \| `'maxre'` \| `'inphase'` — per-degree decoder weighting |
| `fs` | `44100` | Sample rate, used by `layout: 'binaural'` |
| `headRadius` | `0.0875` m | Forwarded to `spatial-binaural`, used by `layout: 'binaural'` |

`'5.1'`/`'7.1'` follow the `@audio/compile` CONTRACT's canonical order (`L R C LFE Ls Rs[ Lrs Rrs]`) with the LFE channel forced silent — ambisonics carries no LFE content, and decoding one from spatial channels would be fabricated, not derived. `method: 'basic'` needs the layout to have real angular spread across all `(order+1)²` dimensions the order requires: a horizontal-only layout (`quad`/`5.1`/`7.1`/`octagon`/`stereo`) can never mode-match-decode an order ≥ 1 elevation component (`Z` is identically zero at every point on the horizon) and throws rather than silently dropping it; use `'sampling'` for those, or a genuinely 3-D layout (`'cube'`, or enough custom points spread over the sphere).

### `rotate(channels, { yaw, pitch, roll })`

Degrees. `yaw` is about the up axis with azimuth's own sign (positive yaw increases a source's azimuth — `rotate(encode(az:30), {yaw:-30})` equals `encode(az:0)`, exact to Float32 precision). `pitch` is about the left axis, positive = nose up. `roll` is about the front axis. Composition order is fixed: roll, then pitch, then yaw. Built by projecting a dense (≥4×channel-count) spherical-Fibonacci sample of directions through the target rotation and solving the resulting linear map by least squares — exact for band-limited SH (a rotation never mixes SH degrees), not an approximation; equivalent by construction to the Ivanic & Ruedenberg (1996) recursive block method.

### Other exports

| Export | |
|---|---|
| `sh(az, el, order, norm)` | The `(order+1)²`-length encoding vector for one direction |
| `decoderMatrix(order, layout, opts)` | The decode matrix `decode()` uses — one `Float32Array` row per speaker, LFE slots as an all-zero row |
| `rotationMatrix(order, yaw, pitch, roll)` | The rotation matrix `rotate()` uses |
| `fumaToAmbix(channels)` / `ambixToFuma(channels)` | FuMa (`WXYZ`.../maxN) ↔ ACN/SN3D. 1/4/9/16 channels (order 0-3). `W` carries FuMa's legacy -3 dB (`1/√2`) correction; `X`,`Y`,`Z` are a bare permutation; 2nd/3rd-order channels rescale per the AmbiX paper's conversion table |
| `n3dToSn3d(channels)` / `sn3dToN3d(channels)` | Per-channel `1/√(2l+1)` / `√(2l+1)` |
| `direction(channels, { fs, frame })` | DirAC-style direction-of-arrival + diffuseness from first-order B-format — see below |

`direction()` returns `{ az, el, diffuseness, frames: [{t, az, el, diff}] }`. It needs the first four (W, Y, Z, X) channels: the active-intensity vector `I = ⟨W·[X,Y,Z]⟩` (frame-averaged) gives direction, and `diffuseness = 1 - |I| / ⟨(W²+X²+Y²+Z²)/2⟩` — 0 for one coherent plane wave, rising toward 1 as sound arrives from many uncorrelated directions at once. Useful for tests and as a "where is the sound" meter; it is not a full DirAC synthesis stage.

### Limits

- **Sampling/mode-matching decoders only** — no AllRAD for irregular layouts. The named layouts (`stereo`/`quad`/`5.1`/`7.1`/`cube`/`octagon`) are all regular enough for `'sampling'`; check a custom layout's coverage yourself before relying on `'basic'`.
- **No near-field compensation** — `encode()` has no distance/NFC-filter option; sources are always encoded as far-field plane waves.
- **Binaural decode drops elevation** — it decodes to a virtual speaker set and feeds each through `spatial-binaural`, which is azimuth-only (see that package's README); a virtual speaker's elevation only decides which ambisonic channels feed it, not its final binaural cue.
- **Binaural virtual speaker sets are not exact spherical designs** — order 1 uses an 8-point horizon ring (`octagon`); orders 2/3 use a 14/20-point spherical-Fibonacci lattice, inside the usual 12-20-point range but not an optimal t-design.

**Use when:** spatializing multiple sources into a rotatable, format-agnostic soundfield — game/VR audio, 360° video, or any pipeline that needs to encode once and decode later to whatever speaker layout (or headphones) is actually available.

---

Part of [@audio/spatial](https://github.com/audiojs/spatial) — the spatial family umbrella.

MIT © [audiojs](https://github.com/audiojs)
