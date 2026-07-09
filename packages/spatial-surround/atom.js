// atom manifest — wraps the 5.1 matrix upmix kernel per @audio/atom CONTRACT.
// The kernel is batch-shaped (its surround delay line and LFE lowpass state live and
// die inside one call), so per-block hosting would reset both at every boundary —
// declared streaming: false instead: the host buffers the whole input and calls
// process once, which is exactly the batch shape the kernel expects. Channel-count
// change (stereo in → 5.1 out) is declared via CONTRACT §channels; output order is
// the contract's canonical 5.1: L R C LFE Ls Rs — matching the kernel's return.

import surroundFn from './surround.js'

export const surround = (ctx) => {
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const res = surroundFn([inp[0], inp[1] || inp[0]], {
			fs: ctx.sampleRate,
			surroundDelay: params.delay[0] / 1000,
			lfeCut: params.lfeCut[0],
		})
		// kernel returns [L, R, C, LFE, Ls, Rs]; contract 5.1 order is L R C LFE Ls Rs
		for (let c = 0; c < out.length && c < res.length; c++) out[c].set(res[c])
	}
}
surround.channels = { inputs: 2, outputs: 6 }
surround.streaming = false
surround.params = {
	delay:  { type: 'number', min: 1, max: 50, default: 12, unit: 'ms' },
	lfeCut: { type: 'number', min: 40, max: 300, default: 120, unit: 'Hz' },
}
