/**
 * Ambisonics — encode/rotate/decode, 1st-3rd order (HOA), ACN ordering, SN3D
 * normalization (AmbiX), FuMa conversion. Azimuth: degrees, CCW from front
 * (0=front, +90=left, -90=right). Elevation: degrees, positive up.
 */

/** One source for multi-source encode(): a static direction for the whole buffer. */
export interface AmbisonicSource {
	data: Float32Array
	/** degrees, CCW from front, default 0 */
	az?: number
	/** degrees, up, default 0 */
	el?: number
	/** default 1 */
	gain?: number
}
export interface EncodeOptions {
	/** ambisonic order 0-3, default 1 */
	order?: number
	/** degrees, ignored when input is an array of sources, default 0 */
	az?: number
	/** degrees, ignored when input is an array of sources, default 0 */
	el?: number
	/** ignored when input is an array of sources, default 1 */
	gain?: number
	/** default 'sn3d' */
	norm?: 'sn3d' | 'n3d'
}
/** Encode mono source(s) into ambisonic B-format. Returns (order+1)² new Float32Array channels, ACN order. */
export function encode(input: Float32Array | AmbisonicSource[], options?: EncodeOptions): Float32Array[]

export interface RotateOptions {
	/** degrees, about the up axis, default 0 */
	yaw?: number
	/** degrees, about the left axis (positive = nose up), default 0 */
	pitch?: number
	/** degrees, about the front axis, default 0 */
	roll?: number
}
/** Rotate an ambisonic signal by yaw/pitch/roll. Returns new channels, same order/count. */
export function rotate(channels: Float32Array[], options?: RotateOptions): Float32Array[]

/** Named speaker layout, or a custom list of directions. */
export type AmbisonicLayout =
	| 'stereo' | 'quad' | '5.1' | '7.1' | 'cube' | 'octagon' | 'binaural'
	| { az: number, el: number }[]

export interface DecodeOptions {
	/** default 'stereo' */
	layout?: AmbisonicLayout
	/** default 'sampling' */
	method?: 'sampling' | 'basic'
	/** default 'maxre' */
	weighting?: 'basic' | 'maxre' | 'inphase'
	/** sample rate, used by layout:'binaural', default 44100 */
	fs?: number
	/** meters, forwarded to @audio/spatial-binaural, used by layout:'binaural' */
	headRadius?: number
}
/** Decode ambisonic B-format to a speaker layout or to binaural. Returns new channels, in the layout's canonical order. */
export function decode(channels: Float32Array[], options?: DecodeOptions): Float32Array[]

/** The encoding vector Y for a source at (az, el): (order+1)² gains, ACN order. */
export function sh(az: number, el: number, order?: number, norm?: 'sn3d' | 'n3d'): Float32Array

/** The decode matrix for one order/layout — one row per speaker, in the layout's canonical order (LFE slots are all-zero rows). */
export function decoderMatrix(order: number, layout: AmbisonicLayout, options?: { method?: 'sampling' | 'basic', weighting?: 'basic' | 'maxre' | 'inphase' }): Float32Array[]

/** The (order+1)²×(order+1)² SH rotation matrix for a yaw/pitch/roll rotation — one row per output channel. */
export function rotationMatrix(order: number, yaw?: number, pitch?: number, roll?: number): Float32Array[]

/** sh(v[0], v[1], order) (SN3D, order 0 to 3) written into `out` from index `at`: sh's values to the bit in a Float32Array. Allocates nothing. */
export function shAt(out: Float32Array | Float64Array, at: number, v: ArrayLike<number>, order: number): void
/** What a host rotates with, for one order (0 to 3): `v` [yaw, pitch, roll] in, `R` the matrix out (C×C row-major, float32,
 *  rotationMatrix's to the bit), `Rt` its transpose before rounding, and the scratch and fixed matrices the two calls
 *  below use. */
export interface AmbisonicRotator { order: number; C: number; v: Float64Array; R: Float32Array; Rt: Float64Array; [k: string]: unknown }
export function rotator(order: number): AmbisonicRotator
/** rotationMatrix(order, ...rot.v) into rot.R. Allocates nothing. */
export function rotationInto(rot: AmbisonicRotator): void
/** `n` frames of `inp` rotated into `out` (may be the same) by angles that move, frame i by yaw[i], pitch[i], roll[i]
 *  degrees, a frame at a time; at angles held, rotationMatrix's rotation within its rounding. Allocates nothing. */
export function rotateRun(rot: AmbisonicRotator, inp: Float32Array[], out: Float32Array[], n: number, yaw: ArrayLike<number>, pitch: ArrayLike<number>, roll: ArrayLike<number>): void

/** FuMa (WXYZ.../maxN) → ACN/SN3D (AmbiX). 1/4/9/16 channels in, same count out. */
export function fumaToAmbix(channels: Float32Array[]): Float32Array[]
/** ACN/SN3D (AmbiX) → FuMa (WXYZ.../maxN). Inverse of fumaToAmbix. */
export function ambixToFuma(channels: Float32Array[]): Float32Array[]
/** N3D → SN3D, per-channel factor 1/√(2l+1). */
export function n3dToSn3d(channels: Float32Array[]): Float32Array[]
/** SN3D → N3D, per-channel factor √(2l+1). */
export function sn3dToN3d(channels: Float32Array[]): Float32Array[]

export interface DirectionFrame { t: number, az: number, el: number, diff: number }
export interface DirectionResult { az: number, el: number, diffuseness: number, frames: DirectionFrame[] }
export interface DirectionOptions {
	/** sample rate, default 44100 */
	fs?: number
	/** analysis frame size in samples, default 1024 */
	frame?: number
}
/** DirAC-style direction-of-arrival + diffuseness from first-order B-format (needs ≥4 channels: W,Y,Z,X). */
export function direction(channels: Float32Array[], options?: DirectionOptions): DirectionResult

declare const ambisonic: {
	encode: typeof encode
	decode: typeof decode
	rotate: typeof rotate
	sh: typeof sh
	decoderMatrix: typeof decoderMatrix
	rotationMatrix: typeof rotationMatrix
	fumaToAmbix: typeof fumaToAmbix
	ambixToFuma: typeof ambixToFuma
	n3dToSn3d: typeof n3dToSn3d
	sn3dToN3d: typeof sn3dToN3d
	direction: typeof direction
}
export default ambisonic
