/**
 * Stereo widener — mid/side processing to adjust stereo width.
 * Takes two channel buffers, modifies both in-place.
 *
 * width: 0 = mono, 1 = original, 2 = full side emphasis
 */

export default function stereoWidener (left, right, params) {
	widen(left, right, Float64Array.of(params.width ?? 1.5), 0)
	return [left, right]
}

/** The same in place, returning nothing: what a host's block runs (nothing allocated, nothing kept). The width is
 *  width[i] for sample i while `moving` (1), width[0] throughout otherwise */
export function widen (left, right, width, moving) {
	let w = width[0]
	for (let i = 0, l = left.length; i < l; i++) {
		if (moving) w = width[i]
		let mid = (left[i] + right[i]) * 0.5
		let side = (left[i] - right[i]) * 0.5
		side *= w
		left[i] = mid + side
		right[i] = mid - side
	}
}
