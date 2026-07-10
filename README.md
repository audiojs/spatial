# @audio/spatial

> Spatial & channel tools — stereo imaging, panning, headphone crossfeed.

| Package | Status | What |
|---|---|---|
| `@audio/spatial-panner` | ✔ | equal-power stereo panner |
| `@audio/spatial-widener` | ✔ | mid/side stereo widener |
| `@audio/spatial-haas` | ✔ | Haas precedence effect |
| `@audio/spatial-autopan` | ✔ | LFO-driven auto-panner |
| `@audio/spatial-crossfeed` | ✔ | headphone crossfeed |
| `@audio/spatial-binaural` | ✔ | structural binaural panner (Brown-Duda ITD + head-shadow ILD, no HRIR) |
| `@audio/spatial-midside` | planned | M/S encode-decode |
| `@audio/spatial-channelsplit` | planned | channel split/combine (FFmpeg channelsplit) |
| `@audio/spatial-delay` | planned | per-channel delay (FFmpeg adelay) |
| `@audio/spatial-surround` | planned | stereo → 5.1 upmix |

Extracted from [effect](https://github.com/audiojs/effect) (`spatial/`) and [filter](https://github.com/audiojs/filter) (`eq/crossfeed`). FFmpeg-parity targets: stereotools, stereowiden, extrastereo, bs2b.

`spatial-binaural` is azimuth-only (ITD + head-shadow ILD, per Brown & Duda 1998 eq. 2-5). Elevation is not implemented: the paper's pinna-echo model (eq. 8, Table I) has a per-listener-fitted scaling factor, not a general physical constant, and the paper itself flags it as unvalidated near 90° elevation — using someone's individual calibration as a fake default would misrepresent it as physics, so this atom omits it rather than invent generic coefficients.
