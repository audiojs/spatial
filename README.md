# @audio/spatial

> Spatial & channel tools — stereo imaging, panning, headphone crossfeed.

| Package | Status | What |
|---|---|---|
| `@audio/spatial-panner` | ✔ | equal-power stereo panner |
| `@audio/spatial-widener` | ✔ | mid/side stereo widener |
| `@audio/spatial-haas` | ✔ | Haas precedence effect |
| `@audio/spatial-autopan` | ✔ | LFO-driven auto-panner |
| `@audio/spatial-crossfeed` | ✔ | headphone crossfeed |
| `@audio/spatial-midside` | planned | M/S encode-decode |
| `@audio/spatial-surround` | planned | stereo → 5.1 upmix |

Extracted from [audio-effect](https://github.com/audiojs/audio-effect) (`spatial/`) and [audio-filter](https://github.com/audiojs/audio-filter) (`eq/crossfeed`). FFmpeg-parity targets: stereotools, stereowiden, extrastereo, bs2b.
