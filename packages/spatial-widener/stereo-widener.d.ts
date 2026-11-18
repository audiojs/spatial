/** Mid/side stereo widener. */
export interface StereoWidenerParams {
  /** 0 (mono) .. 1 (original) .. 2 (full side emphasis), default 1.5 */
  width?: number
  [key: string]: unknown
}

/** Modifies left/right in place; returns [left, right]. */
export default function stereoWidener<T extends Float32Array | Float64Array>(left: T, right: T, params: StereoWidenerParams): [T, T]

/** The same in place, returning nothing (a host's block: allocates nothing). The width is width[i] for sample i while
 *  `moving` is 1, width[0] throughout when it is 0. */
export function widen(left: Float32Array | Float64Array, right: Float32Array | Float64Array, width: Float32Array | Float64Array, moving: 0 | 1): void
