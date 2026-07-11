/** Structural binaural panner — Brown-Duda spherical-head ITD + head-shadow ILD, azimuth-only. */
export interface BinauralParams {
  /** degrees, -180..180 (0 front, +right), default 0 */
  azimuth?: number
  /** meters, default 1 */
  distance?: number
  /** meters, default 0.0875 */
  headRadius?: number
  /** dry/wet 0..1, default 1 */
  mix?: number
  /** sample rate, default 44100 */
  fs?: number
  [key: string]: unknown
}

/** Modifies left/right in place; returns [left, right]. */
export default function binaural<T extends Float32Array | Float64Array>(left: T, right: T, params: BinauralParams): [T, T]
