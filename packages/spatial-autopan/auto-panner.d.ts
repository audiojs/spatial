/** LFO auto-panner — sweeps mono-collapsed input between L/R, constant-power cos/sin law. */
export interface AutoPanParams {
  /** sweep speed, Hz, default 0.5 */
  rate?: number
  /** sweep excursion 0..1, default 1 */
  depth?: number
  /** sample rate, default 44100 */
  fs?: number
  /** internal — carried sweep phase across calls */
  _phase?: number
  [key: string]: unknown
}

/** Modifies left/right in place; returns [left, right]. */
export default function autoPanner<T extends Float32Array | Float64Array>(left: T, right: T, params: AutoPanParams): [T, T]
