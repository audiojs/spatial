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

// A line for a host: a ring for up to `max` samples of delay and the sample past them that a read between two takes,
// and its state [write position, the read's delay in samples (NaN until the first call)]
export const line = max => ({ ring: new Float64Array(Math.floor(max) + 2), st: Float64Array.of(0, NaN) })

// How far the read may move in a frame, as a tape delay's head runs no slower than half speed and no faster than double
// while its time moves (the effect family's delay read): the echo bends an octave at most, down while the delay grows
// (by at most half a frame a frame, so a move takes twice the increase) and up while it shrinks (a frame a frame, as
// long as the decrease). A 20 ms ramp from 1 to 35 ms asks 1.7 frames a frame, which would run the read backwards
const GROW = 0.5, SHRINK = 1

/** x through line `l` into y (they may be the same memory), its read moving toward the delay `want` asks, want[i]
 *  samples for sample i while `moving` (1), want[0] throughout otherwise, by at most GROW farther back and SHRINK
 *  nearer a frame; within that it is the delay asked. A whole delay reads one sample, as `haas` does; between two, it
 *  reads between them; 0 passes x as it is. The first call starts on its delay. Allocates nothing */
export function follow (l, x, y, want, moving) {
	let ring = l.ring, st = l.st, N = ring.length, w = st[0], at = st[1], d = want[0], n = x.length
	if (!(at === at)) at = d
	for (let i = 0; i < n; i++) {
		ring[w] = x[i]
		if (moving) d = want[i]
		at = d > at + GROW ? at + GROW : d < at - SHRINK ? at - SHRINK : d
		let D = Math.floor(at), f = at - D, r = w - D
		if (r < 0) r += N
		let v = ring[r]
		if (f) v += f * (ring[r ? r - 1 : N - 1] - v)
		y[i] = v
		if (++w === N) w = 0
	}
	st[0] = w
	st[1] = at
}
