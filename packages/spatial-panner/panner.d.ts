/** Constant-power (cos/sin law) stereo panner. */
export interface PannerParams {
  /** -1 (full left) .. 0 (center) .. +1 (full right), default 0 */
  pan?: number
  [key: string]: unknown
}

/** Modifies left/right in place; returns [left, right]. */
export default function panner<T extends Float32Array | Float64Array>(left: T, right: T, params: PannerParams): [T, T]
