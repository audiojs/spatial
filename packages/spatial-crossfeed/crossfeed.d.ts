type Buf = Float32Array | Float64Array | number[]
interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }
type SOS = BiquadCoef[]

export interface CrossfeedParams {
  fc?: number        // crossfeed cutoff Hz (default 700)
  level?: number     // mix 0–1 (default 0.3)
  fs?: number
  [key: string]: unknown
}

/** Bauer stereophonic-to-binaural crossfeed, in-place on both channels. direct+cross mix sums to unity (mono/correlated content stays at ~unity gain). Returns the same buffers for convenience. */
declare function crossfeed(left: Buf, right: Buf, params: CrossfeedParams): { left: Buf, right: Buf }
export default crossfeed
