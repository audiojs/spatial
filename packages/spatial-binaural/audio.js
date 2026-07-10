// atom manifest — wraps the Brown-Duda structural binaural kernel per @audio/compile CONTRACT.
// azimuth is the one param the raw kernel smooths itself (one-pole, state kept on p._az):
// a bare jump reseats the ITD delay-line read pointer and clicks, unlike the rest of the
// family where declarative `smoothing` on a live param is enough — so it's live here but
// carries no `smoothing` field (double-smoothing the host layer on top would just add lag).
// distance/mix are plain live gains. headRadius resizes the delay ring and re-derives the
// shadow filter's pole/zero base frequency, so it's construction-time like haas's `time`.

import binauralFn from './binaural.js'

export const binaural = (ctx) => {
	const p = { headRadius: ctx.params.headRadius[0], fs: ctx.sampleRate }
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		p.azimuth = params.azimuth[0]
		p.distance = params.distance[0]
		p.mix = params.mix[0]
		binauralFn(out[0], out[1], p)
	}
}
binaural.channels = 2
binaural.params = {
	azimuth:    { type: 'number', min: -180, max: 180, default: 0, unit: 'deg' },
	distance:   { type: 'number', min: 0, max: 10, default: 1, unit: 'm' },
	headRadius: { type: 'number', min: 0.05, max: 0.12, default: 0.0875, unit: 'm', flags: ['restart'] },
	mix:        { type: 'number', min: 0, max: 1, default: 1, smoothing: 0.01 },
}
