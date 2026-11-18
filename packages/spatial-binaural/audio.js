// atom manifest — wraps the Brown-Duda structural binaural kernel per @audio/compile CONTRACT.
// azimuth is the one param the raw kernel smooths itself (one-pole, state kept in the kernel's
// state): a bare jump reseats the ITD delay-line read pointer and clicks, unlike the rest of the
// family where declarative `smoothing` on a live param is enough — so it's live here but
// carries no `smoothing` field (double-smoothing the host layer on top would just add lag).
// distance/mix are live gains (mix blends dry and wet; distance scales the source by
// 1/max(distance, 1), the inverse distance law clamped at the reference distance of 1 m: OpenAL
// 1.1, §3.4.2 Inverse Distance Clamped Model; Web Audio API, §1.27 DistanceModelType "inverse",
// refDistance 1. Nearer than 1 m sounds as 1 m, so no distance in range boosts the source and a
// move between two distances stays between their two levels): a host's ramp of either is glided
// sample by sample into the kernel's rows (glide, below); a held value takes the kernel's
// one-value path, its batch form's arithmetic. headRadius is live too: the kernel's ring is made
// here for headRadius.max, and a new radius glides across the block from where the last one
// ended (it moves the ITD reads; the host ramps a jump over its smoothing in short calls, and the
// glide joins their steps) and re-derives the shadow filter's pole/zero base frequency per sample.
// The kernel's `block` keeps its state in typed arrays: nothing is allocated in process.

import { state, block, tail } from './binaural.js'

export const binaural = (ctx) => {
	const s = state(binaural.params.headRadius.max, ctx.sampleRate, ctx.maxBlockSize), v = s.v
	const g = new Float64Array(2 * GLIDE).fill(NaN)
	v[4] = ctx.sampleRate
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		out[0].set(inp[0])
		if (!inp[1]) return
		out[1].set(inp[1])
		const n = out[0].length
		v[0] = params.azimuth[0]
		v[1] = params.distance[0]
		v[2] = params.headRadius[0]
		v[3] = params.mix[0]
		block(s, out[0], out[1], glide(g, 0, params.distance, s.d, 0, n, 0) | glide(g, 1, params.mix, s.m, 0, n, 0) << 1)
	}
}
binaural.channels = 2
// the farther ear's delay and the head-shadow pole's decay, at the head radius in force (the kernel's `tail`)
binaural.tail = ({ sampleRate, params }) => tail(params.headRadius[0], sampleRate)
binaural.params = {
	azimuth:    { type: 'number', min: -180, max: 180, default: 0, unit: 'deg' },
	distance:   { type: 'number', min: 0, max: 10, default: 1, unit: 'm', smoothing: 0.01 },
	headRadius: { type: 'number', min: 0.05, max: 0.12, default: 0.0875, unit: 'm', smoothing: 0.02 },
	mix:        { type: 'number', min: 0, max: 1, default: 1, smoothing: 0.01 },
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
