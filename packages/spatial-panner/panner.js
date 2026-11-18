/**
 * Stereo panner — constant-power panning.
 * Takes two channel buffers, modifies both in-place.
 *
 * pan: -1 = full left, 0 = center, +1 = full right
 */

let {cos, sin, PI} = Math

export default function panner (left, right, params) {
	pan(left, right, Float64Array.of(params.pan ?? 0), 0)
	return [left, right]
}

/** The same in place, returning nothing: what a host's block runs. The pan is pans[i] for sample i while `moving` (1),
 *  pans[0] throughout otherwise, its gains then worked out once */
export function pan (left, right, pans, moving) {
	// Constant-power: cos/sin law
	let angle = (pans[0] + 1) * PI / 4   // 0..PI/2
	let gL = cos(angle)
	let gR = sin(angle)

	for (let i = 0, l = left.length; i < l; i++) {
		if (moving) { angle = (pans[i] + 1) * PI / 4; gL = cos(angle); gR = sin(angle) }
		let mid = (left[i] + right[i]) * 0.5
		left[i] = mid * gL
		right[i] = mid * gR
	}
}
