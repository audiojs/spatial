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

/** Returns a new [left, right] pair. */
export default function microshift(channels: [Float32Array, Float32Array], options?: MicroshiftOptions): [Float32Array, Float32Array]
