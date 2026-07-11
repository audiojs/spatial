/** Haas precedence-effect delay — widens mono/near-mono content into a phantom stereo image. */
export interface HaasParams {
  /** delay, seconds, default 0.02 (1-35ms is the precedence-effect range) */
  time?: number
  /** which channel is delayed, default 'right' */
  channel?: 'left' | 'right'
  /** sample rate, default 44100 */
  fs?: number
  /** internal — delay ring buffer, carried across calls */
  buffer?: Float64Array
  /** internal — ring buffer write pointer, carried across calls */
  ptr?: number
  [key: string]: unknown
}

/** Modifies left/right in place; returns [left, right]. */
export default function haas<T extends Float32Array | Float64Array>(left: T, right: T, params: HaasParams): [T, T]
