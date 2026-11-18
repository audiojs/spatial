// atom manifest — wraps the LFO auto-panner kernel per @audio/compile CONTRACT.
// The kernel's `sweep` keeps the LFO phase in a typed array made here, so the sweep stays
// continuous across blocks and a block allocates nothing (the batch form keeps it on an
// options object, which a second instance meets in another shape). `rate` and `depth` are
// live: phase accumulates incrementally, so a rate change bends the sweep without a
// discontinuity; depth scales the pan, so a host's ramp of it is glided sample by sample
// (glide, below); held, `sweep` reads the one depth for the whole block, the batch form's
// arithmetic, so a held depth sounds as the kernel does.

import { sweep } from './auto-panner.js'

export const autopan = (ctx) => {
	const st = Float64Array.of(0, ctx.sampleRate), g = new Float64Array(GLIDE).fill(NaN), row = new Float64Array(ctx.maxBlockSize)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		sweep(st, out[0], out[1], params.rate, row, glide(g, 0, params.depth, row, 0, out[0].length, 0))
	}
}
autopan.channels = 2
autopan.params = {
	rate:  { type: 'number', min: 0.01, max: 20, default: 0.5, unit: 'Hz', curve: 'log' },
	depth: { type: 'number', min: 0, max: 1, default: 1, smoothing: 0.01 },
}

// A value glided sample by sample, so that a host's steps of it join into one line (the dynamics family's glide; a
// family keeps its own copy of a utility). A host hands each call the value at its first frame and, while a value moves
// (a `smoothing` ramp), calls with 32 frames at most (contract 1.0: Parameters, Time; What a host owes, 3). So the line
// through the values the calls bring, each at its call's first frame, is known 32 frames behind any call's first frame,
// however the host cut the calls; the glide plays it 32 frames late. Straight from the value of one call to the next's,
// it is the host's ramp itself, in the value's own unit, the same whether the host calls with 1, 32 or a mix of frames.
// A value that follows a call of more than 32 frames came with no ramp: it is reached in a straight line over 32 frames.
// The first call of an instance starts on its value, and a value held 32 frames is the value itself, so a value that
// does not move is bit for bit what it was before the glide existed.
// `g`: the memory, GLIDE slots a value from j·GLIDE (made NaN): the value the last call brought, where in the ring its
// first frame is, its frames, the frames the line had been at that value before it (64 once held and the ring all of
// it; counted to 63 at most, so that a long call after a move cannot reach 64 before the ring is made all of it), how
// many of `row`'s hold it, then the line, a frame a slot, in a ring of 64. `src`: the param's array. The line's values
// for this call's `n` frames go to `row` from `at`: as they are, or with `lin` 1 the gain e^(v·ln10/20) of a value in
// dB. Returns 1 while they move, 0 when every one is the value (then `row` holds it, filled once). Only arrays and whole
// numbers cross the call.
const GLIDE = 69
function glide (g, j, src, row, at, n, lin) {
	let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
	if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
	else if (v !== was || g[o + 3] < 64) {
		let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
		for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
		g[r + w] = v
		g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
		if (held < 32) {
			for (let i = 0; i < n; i++) {
				let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
				row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
			}
			return 1
		}
	} else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
	// held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
	// with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
	if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
	if (g[o + 4] < n) {
		let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
		for (let i = 0; i < n; i++) row[at + i] = u
		g[o + 4] = n
	}
	return 0
}
