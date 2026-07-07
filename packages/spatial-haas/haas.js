/**
 * Haas effect — delays one channel by 1–35 ms to create phantom stereo image.
 * Takes two channel buffers, modifies both in-place.
 */

export default function haas (left, right, params) {
	let time = params.time ?? 0.02       // seconds (20ms default)
	let channel = params.channel ?? 'right'
	let fs = params.fs || 44100

	let delaySamples = (time * fs) | 0
	let target = channel === 'left' ? left : right

	if (!params.buffer || params.buffer.length < delaySamples) {
		params.buffer = new Float64Array(delaySamples)
		params.ptr = 0
	}
	let buf = params.buffer, ptr = params.ptr

	for (let i = 0, l = target.length; i < l; i++) {
		let delayed = buf[ptr]
		buf[ptr] = target[i]
		ptr = (ptr + 1) % delaySamples
		target[i] = delayed
	}

	params.ptr = ptr

	return [left, right]
}
