// atom manifest — wraps the M/S stereo widener kernel per @audio/atom CONTRACT.
// Stateless per-sample matrix; width is live (host ramps patched values click-free).
// Mono input passes through — there is no side signal to scale.

import widen from './stereo-widener.js'

export const widener = (ctx) => {
	const p = {}
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		p.width = params.width[0]
		widen(out[0], out[1], p)
	}
}
widener.channels = 2
widener.params = {
	width: { type: 'number', min: 0, max: 4, default: 1.5, smoothing: 0.01 },
}
