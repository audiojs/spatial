/** Micro-pitch stereo widener — L/R detuned ±cents via 2-head varispeed ring readers (H3000 MicroShift class). */
export interface MicroshiftOptions {
  /** detune, cents (L up, R down), default 9 */
  cents?: number
  /** dry/wet 0..1, default 0.5 */
  mix?: number
  /** sample rate, default 44100 */
  fs?: number
}

/** Builds a single varispeed pitch-shifter reader for one ring buffer. */
export function shifter(cents: number, size: number): (x: number) => number

/** One reader for a host's block: its ring and [write position, read position, rate, last sample]. */
export interface MicroshiftHead { ring: Float32Array; st: Float64Array }
export function head(cents: number, size: number): MicroshiftHead
/** x through the reader into y (may be the same memory), blended with x by mix[0], or by mix[i] for sample i while
 *  `moving` is 1. Allocates nothing. */
export function shift(h: MicroshiftHead, x: Float32Array | Float64Array, y: Float32Array | Float64Array, mix: ArrayLike<number>, moving?: 0 | 1): void

/** Returns a new [left, right] pair. */
export default function microshift(channels: [Float32Array, Float32Array], options?: MicroshiftOptions): [Float32Array, Float32Array]
