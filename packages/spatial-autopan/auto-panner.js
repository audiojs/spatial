/**
 * Auto-panner — LFO-driven stereo panning. Constant-power cos/sin law.
 * Signal sweeps between speakers at `rate` Hz, full excursion at depth=1.
 */

let {cos, sin, PI} = Math

export default function autoPanner (left, right, params) {
	let rate  = params.rate  ?? 0.5      // Hz
	let depth = params.depth ?? 1        // 0–1
	let fs    = params.fs    || 44100

	let st = Float64Array.of(params._phase ?? 0, fs)
	sweep(st, left, right, Float64Array.of(rate), Float64Array.of(depth), 0)
	params._phase = st[0]
	return [left, right]
}

/**
 * The same sweep in place, for a host: its state in a typed array made once, [LFO phase, sample rate], so a block
 * allocates nothing and a second instance meets no object of another shape. `rate` is read once a block (a new rate
 * bends the sweep: the phase goes on from where it is); the depth is depth[i] for sample i while `moving` (1),
 * depth[0] throughout otherwise.
 */
export function sweep (st, left, right, rate, depth, moving) {
	let phase = st[0], d = depth[0]
	let inc = 2 * PI * rate[0] / st[1]

	for (let i = 0, l = left.length; i < l; i++) {
		if (moving) d = depth[i]
		let pan = sin(phase) * d             // −1..+1
		phase += inc
		if (phase > 2 * PI) phase -= 2 * PI

		let a = (pan + 1) * PI / 4           // 0..π/2
		let gL = cos(a), gR = sin(a)

		let mid = (left[i] + right[i]) * 0.5
		left[i]  = mid * gL
		right[i] = mid * gR
	}

	st[0] = phase
}
