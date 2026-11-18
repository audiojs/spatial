/** Constant-power (cos/sin law) stereo panner. */
export interface PannerParams {
  /** -1 (full left) .. 0 (center) .. +1 (full right), default 0 */
  pan?: number
  [key: string]: unknown
}

/** Modifies left/right in place; returns [left, right]. */
export default function panner<T extends Float32Array | Float64Array>(left: T, right: T, params: PannerParams): [T, T]

/** The same in place, returning nothing (a host's block: allocates nothing). The pan is pans[i] for sample i while
 *  `moving` is 1, pans[0] throughout when it is 0. */
export function pan(left: Float32Array | Float64Array, right: Float32Array | Float64Array, pans: Float32Array | Float64Array, moving: 0 | 1): void
