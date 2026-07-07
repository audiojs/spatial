/**
 * Auto-panner — LFO-driven stereo panning. Constant-power cos/sin law.
 * Signal sweeps between speakers at `rate` Hz, full excursion at depth=1.
 */

let {cos, sin, PI} = Math

export default function autoPanner (left, right, params) {
	let rate  = params.rate  ?? 0.5      // Hz
	let depth = params.depth ?? 1        // 0–1
	let fs    = params.fs    || 44100

	if (params._phase == null) params._phase = 0
	let phase = params._phase
	let inc = 2 * PI * rate / fs

	for (let i = 0, l = left.length; i < l; i++) {
		let pan = sin(phase) * depth         // −1..+1
		phase += inc
		if (phase > 2 * PI) phase -= 2 * PI

		let a = (pan + 1) * PI / 4           // 0..π/2
		let gL = cos(a), gR = sin(a)

		let mid = (left[i] + right[i]) * 0.5
		left[i]  = mid * gL
		right[i] = mid * gR
	}

	params._phase = phase
	return [left, right]
}
