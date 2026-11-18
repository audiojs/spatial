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

/** A line for a host: a ring for up to `max` samples of delay, and its state [write position, the read's delay in
 *  samples (NaN until the first call)]. */
export interface HaasLine { ring: Float64Array; st: Float64Array }
export function line(max: number): HaasLine
/** x through the line into y (may be the same memory), the read moving toward the delay asked, want[i] samples for
 *  sample i while `moving` is 1, want[0] throughout when it is 0, by at most half a frame farther or a frame nearer a
 *  frame (a tape head between half and double speed); a whole delay reads one sample, a fractional one between two, 0
 *  passes x as it is. The first call starts on its delay. Allocates nothing. */
export function follow(l: HaasLine, x: Float32Array | Float64Array, y: Float32Array | Float64Array, want: Float32Array | Float64Array, moving: 0 | 1): void
