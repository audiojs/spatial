// atom manifest — wraps the M/S matrix kernel per @audio/atom CONTRACT.
// Stateless per-sample matrix; `mode` and `width` are live. encode maps L/R → M/S
// (channel 0 = mid, channel 1 = side) for downstream M/S processing; decode maps
// back, scaling the side by `width` (1 = unity round-trip).

import ms from './midside.js'

export const midside = (ctx) => {
	const p = {}
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		if (params.mode === 'encode') ms.encode([out[0], out[1]])
		else {
			p.width = params.width[0]
			ms.decode([out[0], out[1]], p)
		}
	}
}
midside.channels = 2
midside.params = {
	mode:  { type: 'enum', values: ['encode', 'decode'], default: 'encode' },
	width: { type: 'number', min: 0, max: 4, default: 1, smoothing: 0.01 },
}
