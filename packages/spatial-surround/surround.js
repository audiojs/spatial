// Stereo → 5.1 matrix upmix: C = center content, L/R pass, Ls/Rs = decorrelated side
// (delayed ±), LFE = lowpassed mono. Simple matrix upmix, documented — not Dolby decoding.

export default function surround ([L, R], { fs = 44100, surroundDelay = 0.012, lfeCut = 120 } = {}) {
	let n = L.length, out = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)]
	block(state(Math.max(0, surroundDelay * fs), fs), L, R, out, Float64Array.of(surroundDelay), Float64Array.of(lfeCut), 0)
	return out
}

// How far the Ls/Rs read may move in a frame while the delay moves, as a tape delay's head runs no slower than half
// speed and no faster than double (the effect family's delay read): the side signal bends an octave at most, down
// while the delay grows (half a frame a frame), up while it shrinks (a frame a frame); within that it is the delay asked
const GROW = 0.5, SHRINK = 1

/**
 * The state a host keeps for `block`, made once: the side signal's ring, long enough for `maxDelay` samples and the two
 * past them a read between samples and a delay rounded up take, and [write position, frames written (to the ring's
 * length), the read's delay in samples (NaN until the first block), the remainder (below; NaN until then), the delay
 * the last frame was given, the LFE low-pass's memory, the cutoff its pole is for (NaN until then), the pole, fs, the
 * divisor that takes a delay to seconds (1000 for ms), the remainder's step a frame (a sample per 20 ms)].
 */
export const state = (maxDelay, fs, per = 1) => ({ ring: new Float64Array(Math.floor(maxDelay) + 3), st: Float64Array.of(0, 0, NaN, NaN, NaN, 0, NaN, 0, fs, per, 1 / (0.02 * fs)) })

/**
 * L and R (R may be L) into out = [L, R, C, LFE, Ls, Rs], a call at a time, as `surround` makes them over the whole
 * signal: the Ls/Rs side signal read `delay` back, Math.round(delay / per · fs) samples, silent until that many were
 * written; the LFE pole e^(−2π·lfeCut/fs), worked out when lfeCut[0] changes. The delay is delay[i] for frame i while
 * `moving` (1), delay[0] throughout otherwise. While it moves the read is between samples, at the bound above; the
 * line's fraction at the move's start (the remainder) is carried through the move, so the read leaves its whole
 * sample without a jump, and once the delay holds it goes to the new whole sample at a sample per 20 ms. Held, the read
 * is the whole sample. Allocates nothing.
 */
export function block (s, L, R, out, delay, lfeCut, moving) {
	let ring = s.ring, st = s.st, N = ring.length, w = st[0], t = st[1], at = st[2], r = st[3], prev = st[4], lp = st[5]
	let fs = st[8], per = st[9], step = st[10]
	if (lfeCut[0] !== st[6]) { st[6] = lfeCut[0]; st[7] = Math.exp(-2 * Math.PI * lfeCut[0] / fs) }
	let a = st[7], v = delay[0], e = v / per * fs
	if (!(r === r)) { at = Math.round(e); r = e - at; prev = v }
	let oL = out[0], oR = out[1], oC = out[2], oF = out[3], oLs = out[4], oRs = out[5]
	for (let i = 0, n = L.length; i < n; i++) {
		let l = L[i], rr = R[i], m = (l + rr) * 0.5
		ring[w] = (l - rr) * 0.5
		oL[i] = l
		oR[i] = rr
		oC[i] = m * 0.7071
		lp = m * (1 - a) + lp * a
		oF[i] = lp
		if (moving) { v = delay[i]; e = v / per * fs }
		if (v === prev) { let goal = e - Math.round(e), u = goal - r; r = u > step ? r + step : u < -step ? r - step : goal }
		prev = v
		let d = e - r
		at = d > at + GROW ? at + GROW : d < at - SHRINK ? at - SHRINK : d
		let D = Math.floor(at)
		if (t >= D) {
			let f = at - D, k = w - D
			if (k < 0) k += N
			let sd = ring[k]
			if (f) sd += f * (ring[k ? k - 1 : N - 1] - sd)
			oLs[i] = sd * 0.7071
			oRs[i] = -sd * 0.7071
		} else oLs[i] = oRs[i] = 0
		if (++w === N) w = 0
		if (t < N) t++
	}
	st[0] = w; st[1] = t; st[2] = at; st[3] = r; st[4] = prev; st[5] = lp
}
