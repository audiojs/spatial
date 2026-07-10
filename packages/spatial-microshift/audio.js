// atom manifest — wraps the micro-pitch widener per @audio/compile CONTRACT.
// The batch kernel builds its two detune heads per call, so it can't stream; the
// manifest builds them once from the exported `shifter` factory and keeps them in
// closure — state survives across blocks. `cents` bakes each head's varispeed rate
// at construction (flags: restart); `mix` is live. The ring is 50 ms — declared as
// tail so the wet heads drain after input stops.

import { shifter } from './microshift.js'

export const microshift = (ctx) => {
	const size = Math.max(256, Math.round(ctx.sampleRate * 0.05))
	const cents = ctx.params.cents[0]
	const up = shifter(cents, size), down = shifter(-cents, size)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		const mix = params.mix[0]
		const L = inp[0], R = inp[1], oL = out[0], oR = out[1]
		for (let i = 0; i < L.length; i++) {
			oL[i] = L[i] * (1 - mix) + up(L[i]) * mix
			oR[i] = R[i] * (1 - mix) + down(R[i]) * mix
		}
	}
}
microshift.channels = 2
microshift.tail = 0.05
microshift.params = {
	cents: { type: 'number', min: 1, max: 50, default: 9, unit: 'cents', flags: ['restart'] },
	mix:   { type: 'number', min: 0, max: 1, default: 0.5, smoothing: 0.01 },
}
