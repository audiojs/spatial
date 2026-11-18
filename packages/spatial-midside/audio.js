// atom manifest — wraps the M/S matrix kernel per @audio/compile CONTRACT.
// Stateless per-sample matrix; `mode` and `width` are live. encode maps L/R → M/S
// (channel 0 = mid, channel 1 = side) for downstream M/S processing; decode maps
// back, scaling the side by `width` (1 = unity round-trip).

import ms from './midside.js'

export const midside = (ctx) => {
	// the pair the kernel writes into is made once: a block makes nothing. The kernel reads `width` from the live
	// values themselves (its one-sample array), so no number is copied into an object on the way
	const pair = [null, null]
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		pair[0] = out[0]; pair[1] = out[1]
		if (params.mode === 'encode') ms.encode(pair)
		else ms.decode(pair, params)
		pair[0] = pair[1] = null   // the host's arrays are not kept past the call
	}
}
midside.channels = 2
midside.params = {
	mode:  { type: 'enum', values: ['encode', 'decode'], default: 'encode' },
	width: { type: 'number', min: 0, max: 4, default: 1, smoothing: 0.01 },
}
