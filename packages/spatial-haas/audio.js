// atom manifest — wraps the Haas-delay kernel per @audio/compile CONTRACT.
// Each channel runs through a line of the kernel's (`line`, `follow`), made here for the
// longest time (time.max, 35 ms), so `time` and `channel` are live: the delayed channel's
// line reads `time` back, the other's reads 0 (the input as it is). A read moves toward its
// delay at no more than the kernel's tape bound (half speed while it grows, double while it
// shrinks), so a move bends the echo by an octave at most and never stops or reverses it.
// `time` is glided sample by sample (glide, below), the host's own ramp 32 frames late, so
// a move is the same however the host cut its calls (to the float32 rounding of the values
// it hands; bit for bit where the read runs at the bound). Held, the delay is whole samples, as
// the kernel's batch form reads it (bit for bit); while it moves the read is between
// samples, and the line's fraction at the move's start is carried through it, so the read
// leaves its whole sample without a jump and, once the line holds, comes back to the new
// whole sample at a sample per `time.smoothing` (20 ms). A new `channel` moves both reads
// at the bound from the call it comes with: the one delayed now grows to the time, the
// other falls to 0. The delay is the effect, not latency; after the input stops a channel
// drains for as long as its read is behind, which a move leaves anywhere up to time.max:
// the tail declares that (below).

import { line, follow } from './haas.js'

export const haas = (ctx) => {
	const fs = ctx.sampleRate, { time } = haas.params, N = ctx.maxBlockSize, max = time.max / 1000 * fs
	const lines = [line(max), line(max)], step = 1 / (time.smoothing * fs)
	const g = new Float64Array(GLIDE).fill(NaN), row = new Float64Array(N), want = new Float64Array(N), whole = new Float64Array(1), none = new Float64Array(1)
	// [the remainder: the line's delay in samples less the delayed read's (NaN before the first call), the line's last value]
	const k = Float64Array.of(NaN, NaN)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		if (!inp[1]) { out[0].set(inp[0]); return }
		const n = out[0].length, ch = params.channel === 'left' ? 0 : 1, t = params.time[0]
		const moving = glide(g, 0, params.time, row, 0, n, 0), d = t / 1000 * fs, W = d | 0
		if (!(k[0] === k[0])) { k[0] = d - W; k[1] = t }
		if (moving || k[0] !== d - W) {
			// the delayed read's target, a sample at a time: the line less the remainder, which holds while the line
			// moves and, where it holds, goes to the line's own fraction, so the target lands on the whole sample
			let r = k[0], prev = k[1]
			for (let i = 0; i < n; i++) {
				const v = moving ? row[i] : t, e = v / 1000 * fs
				if (v === prev) { const goal = e - (e | 0), u = goal - r; r = u > step ? r + step : u < -step ? r - step : goal }
				want[i] = e - r
				prev = v
			}
			k[0] = r; k[1] = prev
			follow(lines[ch], inp[ch], out[ch], want, 1)
		} else { whole[0] = W; k[1] = t; follow(lines[ch], inp[ch], out[ch], whole, 0) }
		follow(lines[1 - ch], inp[1 - ch], out[1 - ch], none, 0)
	}
}
haas.channels = 2
// seconds until the output is silent once the input stops, whatever the reads are doing. A read follows a new time or
// channel at the tape bound, so as the input stops it may be anywhere up to the longest time while the time in force
// is short (35 → 1 ms takes 34 ms). A tail function sees the setting, not the read, so it declares the longest read:
// the read is never farther back than the line, time.max·fs samples (the remainder it carries is a fraction under the
// line), so the last input sample it takes is ceil(time.max·fs) frames after it came in; in whole frames, so a host
// that rounds the tail to frames and one that rounds it up both cover it
haas.tail = ({ sampleRate }) => Math.ceil(haas.params.time.max / 1000 * sampleRate) / sampleRate
haas.params = {
	time:    { type: 'number', min: 1, max: 35, default: 20, unit: 'ms', smoothing: 0.02 },
	channel: { type: 'enum', values: ['left', 'right'], default: 'right' },
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
