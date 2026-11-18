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

/** The same sweep in place for a host's block (allocates nothing): `st` is [LFO phase, sample rate], kept across blocks;
 *  rate[0] Hz; the depth is depth[i] for sample i while `moving` is 1, depth[0] throughout when it is 0. */
export function sweep(st: Float64Array, left: Float32Array | Float64Array, right: Float32Array | Float64Array, rate: Float32Array | Float64Array, depth: Float32Array | Float64Array, moving: 0 | 1): void
