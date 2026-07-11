/** Mid/side matrix — L/R ↔ M/S, in place. */
export interface DecodeOptions {
  /** side scale before recombining, default 1 (0=mono, >1 widened) */
  width?: number
}

/** [left, right] → [mid, side], in place. */
export function encode<T extends Float32Array | Float64Array>(channels: [T, T]): [T, T]
/** [mid, side] → [left, right], in place. */
export function decode<T extends Float32Array | Float64Array>(channels: [T, T], options?: DecodeOptions): [T, T]

declare const midside: { encode: typeof encode, decode: typeof decode }
export default midside
