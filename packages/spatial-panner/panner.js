/**
 * Stereo panner — constant-power panning.
 * Takes two channel buffers, modifies both in-place.
 *
 * pan: -1 = full left, 0 = center, +1 = full right
 */

let {cos, sin, PI} = Math

export default function panner (left, right, params) {
	let pan = params.pan ?? 0

	// Constant-power: cos/sin law
	let angle = (pan + 1) * PI / 4   // 0..PI/2
	let gL = cos(angle)
	let gR = sin(angle)

	for (let i = 0, l = left.length; i < l; i++) {
		let mid = (left[i] + right[i]) * 0.5
		left[i] = mid * gL
		right[i] = mid * gR
	}

	return [left, right]
}
