// atom manifest — wraps the LFO auto-panner kernel per @audio/compile CONTRACT.
// The kernel keeps LFO phase on the params object — the manifest owns one persistent
// params object per instance, so the sweep stays continuous across blocks. `rate` and
// `depth` are live: phase accumulates incrementally, so rate changes bend the sweep
// without a discontinuity.

import autoPannerFn from './auto-panner.js'

export const autopan = (ctx) => {
	const p = { fs: ctx.sampleRate }
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		p.rate = params.rate[0]
		p.depth = params.depth[0]
		autoPannerFn(out[0], out[1], p)
	}
}
autopan.channels = 2
autopan.params = {
	rate:  { type: 'number', min: 0.01, max: 20, default: 0.5, unit: 'Hz', curve: 'log' },
	depth: { type: 'number', min: 0, max: 1, default: 1 },
}
