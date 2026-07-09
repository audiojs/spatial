// atom manifest — wraps the Haas-delay kernel per @audio/atom CONTRACT.
// The kernel keeps its delay ring on the params object — the manifest owns one
// persistent params object per instance, so state survives across blocks. `time`
// sizes the ring at construction (flags: restart); `channel` selects which ring is
// delayed, so switching it mid-stream would replay stale history — also restart.
// The delay is the effect, not latency; the delayed channel drains for `time`
// after input stops — declared as tail (fn form, actual param not the max).

import haasFn from './haas.js'

export const haas = (ctx) => {
	const p = {
		time: ctx.params.time[0] / 1000,
		channel: ctx.params.channel,
		fs: ctx.sampleRate,
	}
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		haasFn(out[0], out[1], p)
	}
}
haas.channels = 2
haas.tail = (ctx) => ctx.params.time[0] / 1000
haas.params = {
	time:    { type: 'number', min: 1, max: 35, default: 20, unit: 'ms', flags: ['restart'] },
	channel: { type: 'enum', values: ['left', 'right'], default: 'right', flags: ['restart'] },
}
