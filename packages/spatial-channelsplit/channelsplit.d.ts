/** Channel split/combine — multichannel buffer ↔ per-channel mono planes (FFmpeg channelsplit). */

/** Copies each channel into a fresh Float32Array. */
export function split(channels: ArrayLike<number>[]): Float32Array[]
/** Identity — the plane array already is the channel layout. */
export function combine(planes: Float32Array[]): Float32Array[]

export default split
