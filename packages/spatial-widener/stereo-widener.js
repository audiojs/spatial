/**
 * Stereo widener — mid/side processing to adjust stereo width.
 * Takes two channel buffers, modifies both in-place.
 *
 * width: 0 = mono, 1 = original, 2 = full side emphasis
 */

export default function stereoWidener (left, right, params) {
	let width = params.width ?? 1.5

	for (let i = 0, l = left.length; i < l; i++) {
		let mid = (left[i] + right[i]) * 0.5
		let side = (left[i] - right[i]) * 0.5
		side *= width
		left[i] = mid + side
		right[i] = mid - side
	}

	return [left, right]
}
