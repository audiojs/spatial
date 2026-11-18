// atom manifest — three processors over @audio/compile CONTRACT §Buses' 'ambisonic-n'
// layout tag ((n+1)² channels, ACN/SN3D). Order is a bus-layout choice (host picks
// via ctx.layouts, resolved once at construction — "reconfigure = new instance" per
// CONTRACT), never a live param. Each makes what it computes with at construction, in
// typed arrays, and writes straight into the preallocated `out` buffers in process(); a
// block allocates nothing, at rest or as values move (the kernel's typed forms: shAt,
// rotator, rotationInto, rotateRun). An output channel may be an input's memory (contract:
// process), so a path that writes a channel before it has read every input it needs at
// those frames reads a copy of the inputs, made here by maxBlockSize.

import { shAt, decoderMatrix, rotator, rotationInto, rotateRun } from './ambisonic.js'

function orderOf (tag) { return Number((tag || 'ambisonic-1').split('-')[1]) || 1 }

// mono → 'ambisonic-1'|'-2'|'-3'. az/el/gain live. Held, the (order+1)² SH gain vector is
// rebuilt only when az/el change (matches eq-tilt's "rebuilt only when gain/pivot/fs change"
// convention) and the gain applied as it is. The three scale the output channels, so a host's
// ramp of each is glided sample by sample (glide, below): while az or el moves the vector is
// worked out for each sample, while the gain moves it is read per sample. A move takes a
// frame's input sample before it writes that frame; the held and scaling paths write channel
// by channel, so they read the input from its copy (`xs`).
export const ambisonicPanner = (ctx) => {
	const order = orderOf(ctx.layouts?.outputs?.[0])
	const C = (order + 1) ** 2, N = ctx.maxBlockSize
	// the vector and the direction it is for (NaN: none yet), a vector for one sample of a move and its direction
	const y = new Float32Array(C), at = Float64Array.of(NaN, NaN), yi = new Float32Array(C), d = new Float64Array(2)
	const g = new Float64Array(3 * GLIDE).fill(NaN), rAz = new Float64Array(N), rEl = new Float64Array(N), rG = new Float64Array(N)
	const xs = new Float32Array(N)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp[0]) return
		const n = inp[0].length
		const turning = glide(g, 0, params.az, rAz, 0, n, 0) | glide(g, 1, params.el, rEl, 0, n, 0), scaling = glide(g, 2, params.gain, rG, 0, n, 0)
		if (turning) {
			const src = inp[0]
			for (let i = 0; i < n; i++) {
				d[0] = rAz[i]; d[1] = rEl[i]; shAt(yi, 0, d, order)
				const gain = rG[i], x = src[i]
				for (let c = 0; c < C; c++) out[c][i] = x * (yi[c] * gain)
			}
			return
		}
		const src = xs
		src.set(inp[0])
		const az = params.az[0], el = params.el[0], gain = params.gain[0]
		if (az !== at[0] || el !== at[1]) { at[0] = az; at[1] = el; shAt(y, 0, at, order) }
		if (scaling) {
			for (let c = 0; c < C; c++) { const yc = y[c], dst = out[c]; for (let i = 0; i < n; i++) dst[i] = src[i] * (yc * rG[i]) }
			return
		}
		for (let c = 0; c < C; c++) {
			const g = y[c] * gain, dst = out[c]
			for (let i = 0; i < n; i++) dst[i] = src[i] * g
		}
	}
}
ambisonicPanner.channels = { inputs: 1, outputs: [{ layouts: ['ambisonic-1', 'ambisonic-2', 'ambisonic-3'] }] }
ambisonicPanner.params = {
	az:   { type: 'number', min: -180, max: 180, default: 0, unit: 'deg', smoothing: 0.01 },
	el:   { type: 'number', min: -90, max: 90, default: 0, unit: 'deg', smoothing: 0.01 },
	gain: { type: 'number', min: 0, max: 4, default: 1, smoothing: 0.01 },
}

// 'ambisonic-n' → 'stereo'/'quad'/'5.1'/'7.1'. weighting/method are live: the decoder matrix of
// each pair is made at construction (decoderMatrix() already aligns LFE slots to an all-zero
// row, so the output-row loop needs no layout-specific case), and a new pair crossfades from
// the matrix in force over 20 ms, frame-counted across calls, so the speakers' gains never
// step. A pair after it waits for the fade under way to end. A pair the layout cannot take
// ('basic' on a horizontal layout leaves Z unobservable) throws when chosen: decoderMatrix's
// error for it, kept from construction. Each speaker's row reads every input channel, so the
// rows read the inputs from their copy (`xs`).
const FADE = 0.02
export const ambisonicDecoder = (ctx) => {
	const order = orderOf(ctx.layouts?.inputs?.[0])
	const outLayout = ctx.layouts?.outputs?.[0] ?? 'stereo'
	const { weighting, method } = ambisonicDecoder.params, L = Math.max(1, Math.round(FADE * ctx.sampleRate))
	const D = [], fail = []
	for (const w of weighting.values) for (const m of method.values) {
		try { D.push(decoderMatrix(order, outLayout, { method: m, weighting: w })); fail.push(null) } catch (e) { D.push(null); fail.push(e) }
	}
	// the pair in force (-1 before the first block), the pair faded to, frames into the fade (0: none under way)
	const f = Int32Array.of(-1, 0, 0)
	const xs = Array.from({ length: (order + 1) ** 2 }, () => new Float32Array(ctx.maxBlockSize))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const k = weighting.values.indexOf(params.weighting) * 2 + method.values.indexOf(params.method)
		if (fail[k]) throw fail[k]
		if (f[0] < 0) f[0] = k
		const n = inp[0].length, C = inp.length < xs.length ? inp.length : xs.length
		for (let c = 0; c < C; c++) xs[c].set(inp[c])
		// a frame at a time while a fade is under way or the pair asked is not the one in force, so a pair asked during a
		// fade starts its own at the frame that one ends, in any cut of the calls: (1 − w)·the old matrix's output +
		// w·the new one's, w = j/L at the fade's j-th frame
		let i = 0
		for (; i < n && (f[2] || k !== f[0]); i++) {
			if (!f[2]) f[1] = k
			const A = D[f[0]], B = D[f[1]], w = ++f[2] / L
			for (let s = 0; s < out.length; s++) {
				const ra = A[s], rb = B[s]
				let a = 0, b = 0
				for (let c = 0; c < C && c < ra.length; c++) { a += ra[c] * xs[c][i]; b += rb[c] * xs[c][i] }
				out[s][i] = a * (1 - w) + b * w
			}
			if (f[2] === L) { f[0] = f[1]; f[2] = 0 }
		}
		if (i === n) return
		const M = D[f[0]]
		for (let s = 0; s < out.length; s++) {
			const row = M[s], dst = out[s]
			dst.fill(0, i)
			for (let c = 0; c < C && c < row.length; c++) {
				const g = row[c]
				if (!g) continue
				const src = xs[c]
				for (let j = i; j < n; j++) dst[j] += src[j] * g
			}
		}
	}
}
ambisonicDecoder.channels = { inputs: [{ layouts: ['ambisonic-1', 'ambisonic-2', 'ambisonic-3'] }], outputs: [{ layouts: ['stereo', 'quad', '5.1', '7.1'] }] }
ambisonicDecoder.params = {
	weighting: { type: 'enum', values: ['basic', 'maxre', 'inphase'], default: 'maxre' },
	method:    { type: 'enum', values: ['sampling', 'basic'], default: 'sampling' },
}

// 'ambisonic-n' → same order. yaw/pitch/roll live. Held, the (order+1)²×(order+1)² rotation
// matrix is rebuilt only when they change (rebuilding it touches a small dense linear solve —
// see ambisonic.js rotationMatrix() — cheap, but not per-sample cheap, hence the cache). The
// angles move the output channels' gains, so a host's ramp of each is glided sample by sample
// (glide, below), and while one moves the signal is turned a sample at a time by the kernel's
// rotateRun: the same rotation as a product of turns about the up axis and fixed matrices,
// which is per-sample cheap. rotateRun takes a frame's inputs before it writes that frame; held,
// each output row reads every input channel, so the rows read the inputs from their copy (`xs`).
export const ambisonicRotate = (ctx) => {
	const order = orderOf(ctx.layouts?.inputs?.[0])
	const C = (order + 1) ** 2, N = ctx.maxBlockSize
	const rot = rotator(order), R = rot.R, v = rot.v, at = Float64Array.of(0, 0, 0)
	const g = new Float64Array(3 * GLIDE).fill(NaN), rY = new Float64Array(N), rP = new Float64Array(N), rR = new Float64Array(N)
	const xs = Array.from({ length: C }, () => new Float32Array(N))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const n = inp[0].length
		if (glide(g, 0, params.yaw, rY, 0, n, 0) | glide(g, 1, params.pitch, rP, 0, n, 0) | glide(g, 2, params.roll, rR, 0, n, 0)) {
			rotateRun(rot, inp, out, n, rY, rP, rR)
			return
		}
		const yaw = params.yaw[0], pitch = params.pitch[0], roll = params.roll[0]
		if (yaw !== at[0] || pitch !== at[1] || roll !== at[2]) {
			at[0] = v[0] = yaw; at[1] = v[1] = pitch; at[2] = v[2] = roll
			rotationInto(rot)
		}
		for (let c = 0; c < C; c++) xs[c].set(inp[c])
		for (let r = 0; r < C; r++) {
			const dst = out[r]
			dst.fill(0)
			for (let c = 0; c < C; c++) {
				const g = R[r * C + c]
				if (!g) continue
				const src = xs[c]
				for (let i = 0; i < n; i++) dst[i] += src[i] * g
			}
		}
	}
}
ambisonicRotate.channels = { inputs: [{ layouts: ['ambisonic-1', 'ambisonic-2', 'ambisonic-3'] }], outputs: [{ layouts: ['ambisonic-1', 'ambisonic-2', 'ambisonic-3'] }] }
ambisonicRotate.params = {
	yaw:   { type: 'number', min: -180, max: 180, default: 0, unit: 'deg', smoothing: 0.01 },
	pitch: { type: 'number', min: -90, max: 90, default: 0, unit: 'deg', smoothing: 0.01 },
	roll:  { type: 'number', min: -180, max: 180, default: 0, unit: 'deg', smoothing: 0.01 },
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
