/** Per-channel integer-sample delay, zero-filled (FFmpeg adelay). */
export interface DelayOptions {
  /** per-channel delay, milliseconds */
  delays?: number[]
  /** per-channel delay, samples — overrides delays when given */
  samples?: number[]
  /** sample rate, default 44100 */
  fs?: number
}

/** Modifies channels in place; returns the same array. */
export default function delay<T extends Float32Array | Float64Array>(channels: T[], options?: DelayOptions): T[]
