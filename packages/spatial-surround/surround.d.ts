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

/** A host's state for `block`: the side signal's ring (for up to `maxDelay` samples) and [write position, frames
 *  written, read delay, remainder, last delay, LFE memory, its cutoff, its pole, fs, the divisor taking a delay to
 *  seconds (`per`, 1000 for ms), the remainder's step]. */
export interface SurroundState { ring: Float64Array; st: Float64Array }
export function state(maxDelay: number, fs: number, per?: number): SurroundState
/** L and R (R may be L) into out = [L, R, C, LFE, Ls, Rs], a call at a time, as `surround` makes them over the whole
 *  signal. The delay (in seconds × `per`) is delay[i] for frame i while `moving` is 1, delay[0] throughout when it is 0;
 *  while it moves the Ls/Rs read is between samples at no more than half or double speed. lfeCut[0] Hz retunes the
 *  LFE pole when it changes. Allocates nothing. */
export function block(s: SurroundState, L: Float32Array | Float64Array, R: Float32Array | Float64Array, out: Float32Array[], delay: Float32Array | Float64Array, lfeCut: Float32Array | Float64Array, moving: 0 | 1): void
