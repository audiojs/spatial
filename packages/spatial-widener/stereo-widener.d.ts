/** Mid/side stereo widener. */
export interface StereoWidenerParams {
  /** 0 (mono) .. 1 (original) .. 2 (full side emphasis), default 1.5 */
  width?: number
  [key: string]: unknown
}

/** Modifies left/right in place; returns [left, right]. */
export default function stereoWidener<T extends Float32Array | Float64Array>(left: T, right: T, params: StereoWidenerParams): [T, T]
