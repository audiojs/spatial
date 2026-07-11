/** Stereo → 5.1 matrix upmix — simple documented matrix, not Dolby decoding. */
export interface SurroundOptions {
  /** sample rate, default 44100 */
  fs?: number
  /** Ls/Rs decorrelation delay, seconds, default 0.012 */
  surroundDelay?: number
  /** LFE lowpass cutoff, Hz, default 120 */
  lfeCut?: number
}

/** Returns a new [L, R, C, LFE, Ls, Rs] channel array. */
export default function surround(channels: [Float32Array, Float32Array], options?: SurroundOptions): [Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array]
