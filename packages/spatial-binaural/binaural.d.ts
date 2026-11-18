/** Structural binaural panner — Brown-Duda spherical-head ITD + head-shadow ILD, azimuth-only. */
export interface BinauralParams {
  /** degrees, -180..180 (0 front, +right), default 0 */
  azimuth?: number
  /** meters, default 1; the source's gain is 1/max(distance, 1): inverse distance clamped at 1 m */
  distance?: number
  /** meters, default 0.0875 */
  headRadius?: number
  /** dry/wet 0..1, default 1 */
  mix?: number
  /** sample rate, default 44100 */
  fs?: number
  [key: string]: unknown
}

/** A host's state for `block`: the ring (for up to `maxRadius`), [write position, smoothed azimuth, ring length in use,
 *  last head radius, left x1, y1, right x1, y1], the values a block reads, [azimuth, distance, headRadius, mix, fs], and
 *  `rows` frames of the distance (`d`) and the mix (`m`) for a block in which they move. */
export interface BinauralState { ring: Float64Array; st: Float64Array; v: Float64Array; d: Float64Array; m: Float64Array }
export function state(maxRadius: number, fs: number, rows?: number): BinauralState
/** One block in place at the values in `s.v`; a new head radius glides across it. `moving`: 1 while the distance moves
 *  (read from s.d a sample), 2 while the mix does (s.m), 3 while both do. Allocates nothing up to `maxRadius`. */
export function block(s: BinauralState, left: Float32Array | Float64Array, right: Float32Array | Float64Array, moving?: 0 | 1 | 2 | 3): void
/** Seconds to fall 60 dB after the input stops: the farther ear's delay, then the head-shadow pole's decay. */
export function tail(headRadius: number, fs: number): number

/** Modifies left/right in place; returns [left, right]. */
export default function binaural<T extends Float32Array | Float64Array>(left: T, right: T, params: BinauralParams): [T, T]
