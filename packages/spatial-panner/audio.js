// atom manifest — wraps the constant-power panner kernel per @audio/compile CONTRACT.
// Stateless cos/sin law over the mono mid — distinct from a balance control: the
// kernel collapses the stereo image to mid, then places it. `pan` is live.

import pannerFn from './panner.js'

export const panner = (ctx) => {
	const p = {}
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		p.pan = params.pan[0]
		pannerFn(out[0], out[1], p)
	}
}
panner.channels = 2
panner.params = {
	pan: { type: 'number', min: -1, max: 1, default: 0, smoothing: 0.01 },
}
