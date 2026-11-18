import test from 'node:test'
import { strict as assert } from 'node:assert'

import * as fx from './index.js'

let { ok, equal: is } = assert

function almost (a, b, eps = 1e-6) { ok(Math.abs(a - b) < eps, `${a} ≈ ${b} (±${eps})`) }

function impulse (n = 64) { let d = new Float64Array(n); d[0] = 1; return d }
function dc (n = 64, val = 1) { let d = new Float64Array(n); d.fill(val); return d }
function sine (f, n, fs = 44100) {
	let d = new Float64Array(n)
	for (let i = 0; i < n; i++) d[i] = Math.sin(2 * Math.PI * f * i / fs)
	return d
}

// ═══════════════════════════════════════════════════════════════════════════
// Modulation
// ═══════════════════════════════════════════════════════════════════════════

test('stereoWidener — width=0 produces mono', () => {
	let L = sine(440, 256), R = sine(880, 256)
	fx.stereoWidener(L, R, { width: 0 })
	let maxDiff = 0
	for (let i = 0; i < L.length; i++) { let d = Math.abs(L[i] - R[i]); if (d > maxDiff) maxDiff = d }
	ok(maxDiff < 1e-10, `width=0 mono: maxDiff=${maxDiff}`)
})

test('stereoWidener — width=1 is passthrough', () => {
	let L = sine(440, 256), R = sine(880, 256)
	let origL = Float64Array.from(L), origR = Float64Array.from(R)
	fx.stereoWidener(L, R, { width: 1 })
	let maxErr = 0
	for (let i = 0; i < L.length; i++) {
		let eL = Math.abs(L[i] - origL[i]), eR = Math.abs(R[i] - origR[i])
		if (eL > maxErr) maxErr = eL
		if (eR > maxErr) maxErr = eR
	}
	ok(maxErr < 1e-10, `width=1 passthrough: err=${maxErr}`)
})

test('haas — delays one channel', () => {
	let L = impulse(4096), R = impulse(4096)
	fx.haas(L, R, { time: 0.02, channel: 'right', fs: 44100 })
	// Left should still have impulse at 0
	ok(Math.abs(L[0] - 1) < 1e-10, 'left unchanged')
	// Right should be delayed
	let peakIdx = 0
	for (let i = 0; i < R.length; i++) if (R[i] > R[peakIdx]) peakIdx = i
	ok(Math.abs(peakIdx - 882) < 5, `right delayed to sample ${peakIdx} (expected ~882)`)
})

test('panner — pan=0 center', () => {
	let L = dc(256, 1), R = dc(256, 1)
	fx.panner(L, R, { pan: 0 })
	// Both channels should be equal at center
	ok(Math.abs(L[128] - R[128]) < 0.01, 'center: L ≈ R')
})

test('panner — pan=-1 full left', () => {
	let L = dc(256, 1), R = dc(256, 1)
	fx.panner(L, R, { pan: -1 })
	ok(Math.abs(R[128]) < 0.01, 'full left: R ≈ 0')
	ok(L[128] > 0.5, 'full left: L > 0')
})

// ═══════════════════════════════════════════════════════════════════════════
// Binaural — structural (Brown & Duda 1998, IEEE TSAP 6(5), pp. 476-488)
// ═══════════════════════════════════════════════════════════════════════════

test('binaural — ITD matches the spherical two-branch formula at az=90 (Brown & Duda 1998, eq. 2)', () => {
	let fs = 44100, a = 0.0875, c = 343, N = 512
	let L = impulse(N), R = impulse(N)
	fx.binaural(L, R, { azimuth: 90, headRadius: a, fs })
	// near ear (theta_inc=0): T = -(a/c)cos(0) = -a/c; far ear (theta_inc=pi): T = (a/c)(pi-pi/2) = (a/c)(pi/2)
	// normalized so the near ear carries zero latency: ITD = T_far - T_near = (a/c)(pi/2 + 1)
	let expectedLag = (a / c) * (1 + Math.PI / 2) * fs   // ≈ 28.9 samples @ 44100
	let best = 0, bestScore = -Infinity
	for (let lag = 0; lag <= 40; lag++) {
		let score = 0
		for (let i = lag; i < N; i++) score += R[i - lag] * L[i]
		if (score > bestScore) { bestScore = score; best = lag }
	}
	ok(Math.abs(best - expectedLag) <= 1, `measured lag ${best} ≈ expected ${expectedLag.toFixed(2)} samples`)
})

test('binaural — ITD is zero at center (az=0)', () => {
	let N = 512
	let L = impulse(N), R = impulse(N)
	fx.binaural(L, R, { azimuth: 0, fs: 44100 })
	let maxDiff = 0
	for (let i = 0; i < N; i++) maxDiff = Math.max(maxDiff, Math.abs(L[i] - R[i]))
	ok(maxDiff < 1e-9, `center: L ≈ R, maxDiff=${maxDiff}`)
})

test('binaural — head-shadow ILD grows with frequency; ipsi/contra separation ≥6dB at 4kHz (eq. 3-5)', () => {
	let fs = 44100, N = 8192, tail0 = 4096
	let rmsDb = sig => {
		let sum = 0
		for (let i = tail0; i < N; i++) sum += sig[i] * sig[i]
		return 10 * Math.log10(sum / (N - tail0))
	}
	let measure = freq => {
		let L = sine(freq, N, fs), R = sine(freq, N, fs)
		let dryDb = rmsDb(L)   // L, R dry are identical
		fx.binaural(L, R, { azimuth: 90, fs })
		// az=90: right ear is ipsilateral (theta_inc≈0), left is contralateral (theta_inc≈180)
		return { ipsiDb: rmsDb(R) - dryDb, contraDb: rmsDb(L) - dryDb }
	}
	let m500 = measure(500), m4k = measure(4000)
	let attn500 = -m500.contraDb, attn4k = -m4k.contraDb   // positive = cut, dB
	ok(attn4k >= attn500 + 3, `contralateral attenuation grows with freq: 500Hz=${attn500.toFixed(2)}dB, 4kHz=${attn4k.toFixed(2)}dB`)
	ok(m4k.ipsiDb - m4k.contraDb >= 6, `ipsi/contra separation ≥6dB at 4kHz: ${(m4k.ipsiDb - m4k.contraDb).toFixed(2)}dB`)
})

test('binaural — left/right mirror symmetry: az=+40 swaps az=-40', () => {
	let fs = 44100, N = 4096
	let render = az => {
		let L = sine(300, N, fs), R = sine(300, N, fs)
		fx.binaural(L, R, { azimuth: az, fs })
		return [L, R]
	}
	let [Lp, Rp] = render(40), [Lm, Rm] = render(-40)
	let maxErr = 0
	for (let i = 0; i < N; i++) maxErr = Math.max(maxErr, Math.abs(Lp[i] - Rm[i]), Math.abs(Rp[i] - Lm[i]))
	ok(maxErr < 1e-6, `mirror symmetry: max err=${maxErr}`)
})

test('binaural — mix=0 is bit-exact identity', () => {
	let N = 1024
	let L = sine(440, N), R = sine(220, N)
	let origL = Float64Array.from(L), origR = Float64Array.from(R)
	fx.binaural(L, R, { azimuth: 90, mix: 0, fs: 44100 })
	let same = true
	for (let i = 0; i < N; i++) if (L[i] !== origL[i] || R[i] !== origR[i]) same = false
	ok(same, 'mix=0: bit-exact passthrough')
})

test('binaural — no clicks across an azimuth automation boundary (shared state)', () => {
	let fs = 44100, N = 2048
	let full = sine(220, N * 2, fs)
	for (let i = 0; i < full.length; i++) full[i] *= 0.5   // 0.5-amplitude input
	let L1 = Float64Array.from(full.subarray(0, N)), R1 = Float64Array.from(full.subarray(0, N))
	let L2 = Float64Array.from(full.subarray(N)), R2 = Float64Array.from(full.subarray(N))
	let params = { azimuth: 0, fs }
	fx.binaural(L1, R1, params)
	params.azimuth = 60   // jump, same params object → state (ring, filters, smoothed az) carries over
	fx.binaural(L2, R2, params)
	let win = 8
	let seqL = [...L1.slice(-win), ...L2.slice(0, win)]
	let seqR = [...R1.slice(-win), ...R2.slice(0, win)]
	let maxDelta = 0
	for (let i = 1; i < seqL.length; i++) maxDelta = Math.max(maxDelta, Math.abs(seqL[i] - seqL[i - 1]), Math.abs(seqR[i] - seqR[i - 1]))
	ok(maxDelta < 0.1, `max boundary delta=${maxDelta.toFixed(4)} (0.5-amp sine, click threshold 0.1)`)
})

test('binaural — deterministic, length-preserving, finite', () => {
	let N = 1000, fs = 44100
	let run = () => {
		let L = sine(300, N, fs), R = sine(500, N, fs)
		fx.binaural(L, R, { azimuth: 33, distance: 2, headRadius: 0.09, mix: 0.7, fs })
		return [L, R]
	}
	let [L1, R1] = run(), [L2, R2] = run()
	is(L1.length, N); is(R1.length, N)
	ok(L1.every(isFinite) && R1.every(isFinite), 'no NaN/Inf')
	let eq = true
	for (let i = 0; i < N; i++) if (L1[i] !== L2[i] || R1[i] !== R2[i]) eq = false
	ok(eq, 'deterministic: identical params/input → identical output')
})

// ═══════════════════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════════════════

test('autoPanner — depth=0 is passthrough', () => {
	let L = dc(4096, 1), R = dc(4096, 1)
	fx.autoPanner(L, R, { rate: 1, depth: 0, fs: 44100 })
	ok(Math.abs(L[2048] - R[2048]) < 1e-10, 'depth=0: L ≈ R')
})

test('autoPanner — sweeps between channels', () => {
	let fs = 44100, N = fs   // 1 s
	let L = dc(N, 1), R = dc(N, 1)
	fx.autoPanner(L, R, { rate: 1, depth: 1, fs })
	let maxL = 0, maxR = 0
	for (let i = 0; i < N; i++) {
		if (L[i] > maxL) maxL = L[i]
		if (R[i] > maxR) maxR = R[i]
	}
	ok(maxL > 0.9 && maxR > 0.9, `both sides reached: L=${maxL.toFixed(2)} R=${maxR.toFixed(2)}`)
	ok(L.every(isFinite) && R.every(isFinite), 'no NaN/Inf')
})

import { msEncode, msDecode, channelDelay, microshift, surround } from './index.js'

test('midside — roundtrip identity; mono has zero side', () => {
	let L = sine(440, 4096), R = sine(700, 4096)
	let refL = Float64Array.from(L), refR = Float64Array.from(R)
	msDecode(msEncode([L, R]))
	for (let i = 0; i < L.length; i += 41) {
		assert.ok(Math.abs(L[i] - refL[i]) < 1e-6 && Math.abs(R[i] - refR[i]) < 1e-6)
	}
	let M = Float32Array.from(sine(440, 1024)), C = Float32Array.from(M)
	let [, S] = msEncode([M, C])
	assert.ok(S.every(v => Math.abs(v) < 1e-7), 'mono → zero side')
})

// A block loop calls the matrix once a block, so neither form may make an array: each returns the pair it was given, and
// the width may come as the one-sample array a host hands a live value in
test('midside: encode and decode return the pair given; a width in a one-sample array is that width', () => {
	let pair = [sine(440, 512), sine(700, 512)]
	assert.equal(msEncode(pair), pair, 'encode returns its pair')
	assert.equal(msDecode(pair, { width: 1.3 }), pair, 'decode returns its pair')
	for (let w of [0, 0.3, 1, 1.3, 4]) {
		let a = [Float32Array.from(sine(440, 512)), Float32Array.from(sine(700, 512))], b = [Float32Array.from(a[0]), Float32Array.from(a[1])]
		msDecode(a, { width: Float32Array.of(w) }); msDecode(b, { width: Float32Array.of(w)[0] })
		assert.deepEqual(a, b, `width ${w} from an array and as a number`)
	}
})

test('channelDelay — sample-exact shift', () => {
	let a = sine(440, 4096), ref = Float64Array.from(a)
	channelDelay([a], { samples: [100] })
	assert.ok(Math.abs(a[150] - ref[50]) < 1e-7 && a[50] === 0)
})

test('microshift — wet channels detune ±cents', () => {
	let L = sine(440, 44100), R = sine(440, 44100)
	microshift([L, R], { cents: 30, mix: 1, fs: 44100 })
	let zc = (d, from, to) => {
		let c = 0
		for (let i = from + 1; i < to; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) c++
		return c / 2 * 44100 / (to - from)
	}
	let fL = zc(L, 8192, 36000), fR = zc(R, 8192, 36000)
	assert.ok(fL > 443 && fL < 452, 'L up (' + fL.toFixed(1) + ')')
	assert.ok(fR > 428 && fR < 437, 'R down (' + fR.toFixed(1) + ')')
})

test('surround — 6 channels, center holds mid, LFE lowpassed', () => {
	let n = 44100
	let L = new Float32Array(n), R = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		let mid = 0.5 * Math.sin(2 * Math.PI * 300 * i / 44100)
		let side = 0.3 * Math.sin(2 * Math.PI * 2000 * i / 44100)
		L[i] = mid + side; R[i] = mid - side
	}
	let chans = surround([L, R], { fs: 44100 })
	assert.equal(chans.length, 6)
	let [, , C, LFE, Ls] = chans
	let g = (d, f) => { let w = 2 * Math.PI * f / 44100, cw = Math.cos(w), s1 = 0, s2 = 0; for (let i = 4096; i < d.length - 4096; i++) { let s0 = d[i] + 2 * cw * s1 - s2; s2 = s1; s1 = s0 } return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - 2 * cw * s1 * s2)) / (d.length - 8192) }
	assert.ok(g(C, 300) > g(C, 2000) * 5, 'center holds mid content')
	assert.ok(g(Ls, 2000) > g(Ls, 300) * 5, 'surrounds hold side content')
	assert.ok(g(LFE, 300) > g(LFE, 2000) * 20, 'LFE lowpassed')
})

// -- 2026-08 atom: ambisonic — encode → rotate → decode through the umbrella (depth lives in the package suite) --
test('ambisonic — a source at +90° encodes, rotates back to front, and decodes loudest at the front speaker', () => {
	let fs = 44100, n = 4096, mono = new Float32Array(n)
	for (let i = 0; i < n; i++) mono[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / fs)
	let enc = fx.ambisonicEncode(mono, { order: 3, az: 90, el: 0 })
	is(enc.length, 16, 'third order = 16 ACN channels')
	let rot = fx.ambisonicRotate(enc, { yaw: -90 })
	let rms = d => { let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length) }
	ok(rms(rot[1]) < 1e-3 * rms(rot[0]) + 1e-6, 'Y (left-right) component vanishes after rotating to front')
	let spk = fx.ambisonicDecode(rot, { layout: [{ az: 0, el: 0 }, { az: 90, el: 0 }, { az: 180, el: 0 }, { az: -90, el: 0 }], fs })
	is(spk.length, 4)
	ok(rms(spk[0]) > 3 * rms(spk[1]) && rms(spk[0]) > 3 * rms(spk[2]), 'front speaker dominates (order 3: ' + (rms(spk[0]) / rms(spk[1])).toFixed(1) + '× the side)')
	let { az } = fx.ambisonicDirection(enc, { fs })
	ok(Math.abs(az - 90) < 3, 'direction analysis recovers +90°: ' + az.toFixed(1))
})

// ═══════════════════════════════════════════════════════════════════════════
// Manifests (audio.js) under a host's calls: live params, tails, no allocation
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process'
import { haas as haasAtom } from '@audio/spatial-haas/audio'
import { binaural as binauralAtom } from '@audio/spatial-binaural/audio'
import { microshift as microshiftAtom } from '@audio/spatial-microshift/audio'
import { surround as surroundAtom } from '@audio/spatial-surround/audio'
import { widener as widenerAtom } from '@audio/spatial-widener/audio'
import { panner as pannerAtom } from '@audio/spatial-panner/audio'
import { autopan as autopanAtom } from '@audio/spatial-autopan/audio'
import { midside as midsideAtom } from '@audio/spatial-midside/audio'
import { ambisonicPanner, ambisonicRotate, ambisonicDecoder } from '@audio/spatial-ambisonic/audio'
import { shifter } from '@audio/spatial-microshift'

// A stub host: the manifest built once, then called in blocks of `block` frames (a whole-signal one in one call), each
// call with the values `at(frame)` gives at its first frame (numbers as 1-length Float32Arrays, as a host hands them)
function host (m, chans, { fs = 44100, block = 128, set = {}, at = () => ({}), outs = chans.length } = {}) {
	let values = f => Object.fromEntries(Object.entries(m.params).map(([k, s]) => {
		let v = at(f)[k] ?? set[k] ?? s.default
		return [k, s.type === 'number' ? Float32Array.of(v) : v]
	}))
	let n = chans[0].length, out = Array.from({ length: outs }, () => new Float32Array(n))
	if (m.streaming === false) block = n
	let proc = m({ sampleRate: fs, maxBlockSize: block, maxChannels: Math.max(chans.length, outs), params: values(0) })
	for (let f = 0; f < n; f += block) {
		let e = Math.min(n, f + block)
		proc([chans.map(c => c.subarray(f, e))], [out.map(c => c.subarray(f, e))], values(f))
	}
	return out
}
const noise = (n, seed = 1) => { let s = seed, d = new Float32Array(n); for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = s / 4294967296 - 0.5 } return d }
const rmsOf = (d, a = 0, b = d.length) => { let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]; return Math.sqrt(s / Math.max(1, b - a)) }
// whether the output is 60 dB under the input's RMS in every 64-frame window from `from` on (as the contract's validator
// measures a tail: from latency + tail, or 128 frames where the tail is shorter)
const quiet = (out, x, stop, from) => {
	let floor = rmsOf(x, 0, stop) * 1e-3
	for (let i = from; i + 64 <= out[0].length; i += 64) if (out.some(o => rmsOf(o, i, i + 64) > floor)) return false
	return true
}
// A host that ramps (contract 1.0, Parameters: smoothing and Time; What a host owes, 3): as `host`, but `key` set to `to`
// at frame k, which a host reaches by a linear ramp of the param's smoothing from the value in force, each call handed
// the ramp's value at its first frame (audio's batch.js valuesAt), calls split where the ramp starts and ends and of at
// most 32 frames while it runs. A param with no smoothing jumps at k
function ramped (m, chans, { fs = 44100, block = 128, set = {}, key, to, k, outs = chans.length } = {}) {
	let s = m.params[key], R = s.smoothing ? Math.max(1, Math.round(s.smoothing * fs)) : 0, from = set[key] ?? s.default
	let value = f => f < k ? from : f >= k + R ? to : to + (from - to) * (1 - (f - k) / R)
	let values = f => Object.fromEntries(Object.entries(m.params).map(([p, d]) => {
		let v = p === key ? value(f) : set[p] ?? d.default
		return [p, d.type === 'number' ? Float32Array.of(v) : v]
	}))
	let n = chans[0].length, out = Array.from({ length: outs }, () => new Float32Array(n))
	let proc = m({ sampleRate: fs, maxBlockSize: block, maxChannels: Math.max(chans.length, outs), params: values(0) })
	for (let f = 0; f < n;) {
		let e = Math.min(n, f + block)
		if (f < k && e > k) e = k
		if (f >= k && f < k + R) e = Math.min(e, f + 32, k + R)
		proc([chans.map(c => c.subarray(f, e))], [out.map(c => c.subarray(f, e))], values(f))
		f = e
	}
	return out
}
// what a value glided sample by sample is at frame i: the host's ramp (from `from` at frame k to `to` at k + R) played
// 32 frames late, the longest a host's call runs while a value moves, so it is known whatever the calls
const late = (from, to, k, R, i) => i - 32 < k ? from : i - 32 >= k + R ? to : from + (to - from) * (i - 32 - k) / R
const same = (a, b) => a.every((c, j) => c.every((v, i) => Object.is(v, b[j][i])))

test('haas atom: at a constant time and channel, the kernel\'s batch output, in any block size', () => {
	for (let fs of [44100, 48000]) for (let time of [1, 7.3, 20, 35]) for (let channel of ['left', 'right']) for (let block of [1, 37, 128, 2048]) {
		let L = noise(6000, 1), R = noise(6000, 2), out = host(haasAtom, [L, R], { fs, block, set: { time, channel } })
		let l = Float64Array.from(L), r = Float64Array.from(R)
		fx.haas(l, r, { time: Math.fround(time) / 1000, channel, fs })
		ok(out[0].every((v, i) => v === Math.fround(l[i])) && out[1].every((v, i) => v === Math.fround(r[i])), `${fs} Hz, ${time} ms, ${channel}, blocks of ${block}`)
	}
})

// A ramp in, x[i] = i: a channel read P_i samples back gives i − P_i, between two samples too (a straight line read
// between two of its points is the line), to float32's rounding of the output (under 1e-3 of a sample here)
const ramp = n => Float32Array.from({ length: n }, (_, i) => i)
const readOf = y => Float64Array.from(y, (v, i) => i - v)
const speeds = (P, a, b) => { let lo = Infinity, hi = -Infinity; for (let i = a + 1; i < b; i++) { let s = 1 - (P[i] - P[i - 1]); lo = Math.min(lo, s); hi = Math.max(hi, s) } return [lo, hi] }

test('haas atom: time is live: the read moves toward a new time at half speed growing and double speed shrinking at most, lands on its whole sample, the same however the host cuts its calls (was: a glide across each call, which stopped or reversed the read)', () => {
	let fs = 44100, n = 16384, k = 4096, x = ramp(n), whole = t => (Math.fround(t) / 1000 * fs) | 0
	// moves the host's 20 ms ramp asks faster than the bound: read at the bound from the frame the line moves
	for (let [a, b] of [[10, 30], [35, 1], [20, 35]]) {
		let runs = [1, 7, 32, 128].map(block => ramped(haasAtom, [x, x], { fs, block, set: { time: a }, key: 'time', to: b, k }))
		ok(runs.every(o => same(o, runs[3])), `${a} → ${b} ms: the same samples in calls of 1, 7, 32 and 128`)
		let P = readOf(runs[3][1]), W0 = whole(a), W1 = whole(b), bound = W1 > W0 ? 0.5 : 1, land = k + 33 + Math.ceil(Math.abs(W1 - W0) / bound)
		ok(P.subarray(W0, k + 33).every(p => p === W0), `${a} → ${b} ms: ${W0} samples until the line moves, 32 frames after the jump`)
		let [lo, hi] = speeds(P, k, n)
		ok(lo > 0.5 - 1e-3 && hi < 2 + 1e-3, `${a} → ${b} ms: the read's speed ${lo.toFixed(4)} to ${hi.toFixed(4)}, within half and double`)
		ok(P.subarray(k + 34, land - 1).every((p, i) => Math.abs(p - P[k + 33 + i] - (W1 > W0 ? 0.5 : -1)) < 1e-3), `${a} → ${b} ms: at the bound throughout`)
		ok(P.subarray(land).every(p => p === W1), `${a} → ${b} ms: on ${W1} samples from ${land - k} frames after the jump`)
		ok(runs[3][0].every((v, i) => v === x[i]), `${a} → ${b} ms: the left channel as it is`)
	}
	// a move within the bound follows the host's line: the line's delay less its fraction at the move's start (10.3 ms is
	// 454.23 samples, read at 454), carried through the move; once the line holds, the read goes to the new whole sample
	// (10.9 ms: 480.69, read at 480) at a sample per time.smoothing
	let a = 10.3, b = 10.9, R = Math.round(0.02 * fs), step = 1 / (0.02 * fs), e = t => Math.fround(t) / 1000 * fs
	let r0 = e(a) - whole(a), r1 = e(b) - whole(b), held = k + R + 33
	let reads = [1, 32, 128].map(block => readOf(ramped(haasAtom, [x, x], { fs, block, set: { time: a }, key: 'time', to: b, k })[1])), worst = 0
	for (let i = whole(a); i < n; i++) {
		let r = i < held ? r0 : Math.min(r1, r0 + (i - held + 1) * step), want = late(e(a), e(b), k, R, i) - r
		for (let P of reads) worst = Math.max(worst, Math.abs(P[i] - want))
	}
	ok(worst < 1e-3, `${a} → ${b} ms: the read follows the line less the carried fraction, then lands on ${whole(b)}, in calls of 1, 32 and 128: within ${worst.toExponential(1)} of a sample`)
	ok(reads[2].subarray(held + Math.ceil((r1 - r0) / step) + 1).every(p => p === whole(b)), `${a} → ${b} ms: on the whole sample once the fraction is taken up`)
})

test('haas atom: channel is live: a switch moves both reads at the bound from the call it comes with, the one delayed now growing at half speed to the time, the other falling at double speed to 0, in any cut of the calls (was: both over a 20 ms glide)', () => {
	let fs = 48000, n = 16384, k = 4096, x = ramp(n), W = (Math.fround(20) / 1000 * fs) | 0
	let runs = [1, 7, 32, 128, 2048].map(block => ramped(haasAtom, [x, x], { fs, block, set: { time: 20, channel: 'right' }, key: 'channel', to: 'left', k }))
	ok(runs.every(o => same(o, runs[3])), 'the same samples in calls of 1, 7, 32, 128 and 2048')
	let Pl = readOf(runs[3][0]), Pr = readOf(runs[3][1]), worst = 0
	for (let i = W; i < n; i++) {
		let l = i < k ? 0 : Math.min(W, 0.5 * (i - k + 1)), r = i < k ? W : Math.max(0, W - (i - k + 1))
		worst = Math.max(worst, Math.abs(Pl[i] - l), Math.abs(Pr[i] - r))
	}
	ok(worst < 1e-3, `left grows 0 → ${W} at half a frame a frame, right falls ${W} → 0 at a frame a frame: within ${worst.toExponential(1)} of a sample`)
	ok(Pl.subarray(k + 2 * W).every(p => p === W) && Pr.subarray(k + W).every(p => p === 0), 'then the left delayed by the whole time, the right as it is')
})

test('binaural atom: at a constant head radius, the kernel\'s output, in any block size; a new radius glides, the same in 32-frame calls as in 1-frame calls (was: restart, ignored)', () => {
	for (let a of [0.05, 0.0875, 0.12]) for (let block of [1, 37, 1024]) {
		let L = noise(4000, 7), R = noise(4000, 8), out = host(binauralAtom, [L, R], { block, set: { azimuth: 70, headRadius: a, distance: 2, mix: 0.8 } })
		let l = Float64Array.from(L), r = Float64Array.from(R)
		fx.binaural(l, r, { azimuth: Math.fround(70), headRadius: Math.fround(a), distance: 2, mix: Math.fround(0.8), fs: 44100 })
		ok(out[0].every((v, i) => v === Math.fround(l[i])) && out[1].every((v, i) => v === Math.fround(r[i])), `radius ${a}, blocks of ${block}`)
	}
	// a host ramps a smoothed value over 20 ms in calls of at most 32 frames; each call's glide joins the steps, so the
	// output is the one of a ramp taken frame by frame. Float32 values per call: within 1e-6
	let fs = 48000, n = 9600, k = 2400, R = 0.02 * fs, L = noise(n, 9), Rt = noise(n, 10)
	let radius = f => f < k ? 0.05 : 0.05 + 0.07 * Math.min(1, (f - k) / R)
	let ramp = block => host(binauralAtom, [L, Rt], { fs, block, set: { azimuth: 90 }, at: f => ({ headRadius: radius(f + block) }) })
	let a = ramp(32), b = ramp(1), worst = 0
	for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(a[c][i] - b[c][i]))
	ok(worst < 1e-6, `32-frame calls within 1e-6 of 1-frame calls: ${worst}`)
	// the change is heard: past the ramp and the ring, the render at the new radius
	let held = host(binauralAtom, [L, Rt], { fs, block: 32, set: { azimuth: 90, headRadius: 0.12 } }), was = host(binauralAtom, [L, Rt], { fs, block: 32, set: { azimuth: 90, headRadius: 0.05 } })
	let late = 0, moved = 0
	for (let i = k + R + 512; i < n; i++) { late = Math.max(late, Math.abs(a[0][i] - held[0][i])); moved = Math.max(moved, Math.abs(a[0][i] - was[0][i])) }
	ok(late < 1e-6, `then as at 0.12 m throughout: ${late}`)
	ok(moved > 0.05, `and not as at 0.05 m: ${moved}`)
})

test('binaural atom: its tail covers the ear delay and the head shadow\'s ring, to 192 kHz (was 0)', () => {
	for (let fs of [44100, 192000]) for (let headRadius of [0.05, 0.12]) {
		let n = fs / 4 | 0, stop = n / 2, L = noise(n, 11), R = noise(n, 12)
		L.fill(0, stop); R.fill(0, stop)
		let out = host(binauralAtom, [L, R], { fs, set: { azimuth: 90, headRadius } }), T = binauralAtom.tail({ sampleRate: fs, params: { headRadius: Float32Array.of(headRadius) } })
		ok(quiet(out, L, stop, stop + Math.max(128, Math.ceil(T * fs))), `${fs} Hz, ${headRadius} m: 60 dB down within the tail, ${(T * fs).toFixed(0)} frames`)
	}
	let T = binauralAtom.tail({ sampleRate: 192000, params: { headRadius: Float32Array.of(0.12) } })
	ok(T * 192000 > 128, `at 192 kHz the ring outlasts 128 frames: ${(T * 192000).toFixed(0)}`)
})

test('microshift atom: at a constant cents, the kernel\'s batch output, in any block size; cents is live: the left channel\'s pitch follows a change (was: restart, ignored)', () => {
	for (let cents of [1, 9, 50]) for (let block of [1, 100, 2048]) {
		let L = noise(5000, 13), R = noise(5000, 14), out = host(microshiftAtom, [L, R], { block, set: { cents, mix: 0.6 } })
		let l = L.slice(), r = R.slice()
		microshift([l, r], { cents: Math.fround(cents), mix: Math.fround(0.6), fs: 44100 })
		ok(out[0].every((v, i) => v === l[i]) && out[1].every((v, i) => v === r[i]), `${cents} cents, blocks of ${block}`)
	}
	let fs = 44100, n = 2 * fs, s = new Float32Array(n)
	for (let i = 0; i < n; i++) s[i] = Math.sin(2 * Math.PI * 440 * i / fs)
	let out = host(microshiftAtom, [s, s.slice()], { fs, set: { mix: 1 }, at: f => ({ cents: f < fs ? 9 : 40 }) })
	let zc = (d, a, b) => { let c = 0; for (let i = a + 1; i < b; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) c++; return c / 2 * fs / (b - a) }
	let f9 = zc(out[0], 8192, fs - 4096), f40 = zc(out[0], fs + 8192, n - 4096)
	ok(Math.abs(f9 - 440 * 2 ** (9 / 1200)) < 1.5, `9 cents: ${f9.toFixed(1)} Hz`)
	ok(Math.abs(f40 - 440 * 2 ** (40 / 1200)) < 1.5, `then 40: ${f40.toFixed(1)} Hz, for ${(440 * 2 ** (40 / 1200)).toFixed(1)}`)
})

test('widener, panner, autopan, microshift, binaural atoms: a value that scales the signal follows the host\'s ramp sample by sample, 32 frames late, in any cut of the calls (was: held for each call, a staircase of 32-frame steps)', () => {
	// each output against a direct computation of the processor at the value `late` gives at that frame
	let fs = 44100, n = 4096, k = 1000, sh = Math.max(256, Math.round(fs * 0.05))
	let L = Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 220 * i / fs)), R = Float32Array.from({ length: n }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 330 * i / fs + 1))
	let mid = i => (L[i] + R[i]) * 0.5, placed = (i, pan) => { let a = (pan + 1) * Math.PI / 4; return [mid(i) * Math.cos(a), mid(i) * Math.sin(a)] }
	// the auto-panner's LFO at its default rate, 0.5 Hz, its phase accumulated as the kernel's definition has it
	let phase = new Float64Array(n), inc = 2 * Math.PI * Math.fround(0.5) / fs
	for (let i = 1, p = 0; i < n; i++) { p += inc; if (p > 2 * Math.PI) p -= 2 * Math.PI; phase[i] = p }
	// microshift's wet heads: the closure shifter, detuned ±9 cents
	let up = shifter(Math.fround(9), sh), down = shifter(-Math.fround(9), sh), wetL = L.map(v => up(v)), wetR = R.map(v => down(v))
	// binaural's wet path alone (mix 1), at azimuth 60
	let wet = host(binauralAtom, [L, R], { fs, set: { azimuth: 60, mix: 1 } })
	let cases = [
		[widenerAtom, 'width', 1, 3, {}, (i, w) => { let s = (L[i] - R[i]) * 0.5 * w; return [mid(i) + s, mid(i) - s] }],
		[pannerAtom, 'pan', -0.5, 0.5, {}, placed],
		[autopanAtom, 'depth', 0.25, 0.75, {}, (i, d) => placed(i, Math.sin(phase[i]) * d)],
		[microshiftAtom, 'mix', 0.25, 0.75, {}, (i, m) => [L[i] * (1 - m) + wetL[i] * m, R[i] * (1 - m) + wetR[i] * m]],
		[binauralAtom, 'mix', 0.25, 0.75, { azimuth: 60 }, (i, m) => [L[i] * (1 - m) + wet[0][i] * m, R[i] * (1 - m) + wet[1][i] * m]],
	]
	for (let [m, key, from, to, set, want] of cases) {
		let Rr = Math.round(m.params[key].smoothing * fs), runs = [1, 32, 128].map(block => ramped(m, [L, R], { fs, block, set: { ...set, [key]: from }, key, to, k })), worst = 0
		for (let o of runs) for (let i = 0; i < n; i++) { let y = want(i, late(Math.fround(from), Math.fround(to), k, Rr, i)); worst = Math.max(worst, Math.abs(o[0][i] - y[0]), Math.abs(o[1][i] - y[1])) }
		ok(worst < 1e-6, `${m.name} ${key} ${from} → ${to}: within ${worst.toExponential(1)} of the line, in calls of 1, 32 and 128`)
	}
	// binaural's distance scales the source before the wet path, which is linear: the output is the wet path at 1 m of
	// the input scaled sample by sample by 1/distance
	let from = 2, to = 6, Rr = Math.round(binauralAtom.params.distance.smoothing * fs), g = i => 1 / late(Math.fround(from), Math.fround(to), k, Rr, i)
	let ref = host(binauralAtom, [L.map((v, i) => v * g(i)), R.map((v, i) => v * g(i))], { fs, set: { azimuth: 60, mix: 1, distance: 1 } }), worst = 0
	for (let block of [1, 32, 128]) { let o = ramped(binauralAtom, [L, R], { fs, block, set: { azimuth: 60, mix: 1, distance: from }, key: 'distance', to, k }); for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(o[c][i] - ref[c][i])) }
	ok(worst < 1e-6, `binaural distance ${from} → ${to} m: within ${worst.toExponential(1)} of the source scaled by the line, in calls of 1, 32 and 128`)
})

test('surround atom: its tail covers the surround delay and the LFE low-pass (was 0)', () => {
	for (let [delay, lfeCut] of [[12, 120], [50, 300], [1, 40]]) {
		let fs = 44100, n = fs / 2, stop = n / 2, L = noise(n, 15), R = noise(n, 16)
		L.fill(0, stop); R.fill(0, stop)
		let out = host(surroundAtom, [L, R], { fs, outs: 6, set: { delay, lfeCut } }), T = surroundAtom.tail({ sampleRate: fs, params: { delay: Float32Array.of(delay), lfeCut: Float32Array.of(lfeCut) } })
		ok(quiet(out, L, stop, stop + Math.max(128, Math.ceil(T * fs))), `delay ${delay} ms, LFE ${lfeCut} Hz: 60 dB down within the tail, ${(T * fs).toFixed(0)} frames`)
	}
})

test('surround atom: streams (was: streaming: false): in blocks of any size, the kernel\'s output over the whole signal, bit for bit; delay and lfeCut are live', () => {
	ok(surroundAtom.streaming !== false, 'declares no whole signal')
	for (let fs of [22050, 44100, 96000]) for (let [delay, lfeCut] of [[12, 120], [1, 300], [50, 40], [7.7, 87.3]]) for (let mono of [false, true]) {
		let n = 6000, L = noise(n, 21), R = mono ? L : noise(n, 22), set = { delay, lfeCut }
		let ref = surround([L.slice(), R.slice()], { fs, surroundDelay: Math.fround(delay) / 1000, lfeCut: Math.fround(lfeCut) })
		// the kernel runs on the streaming form too, so its whole call is held to the matrix computed here: L and R as they
		// come, C = 0.7071·mid, LFE the one-pole y = mid·(1 − a) + y·a (a = e^(−2π·lfeCut/fs)), Ls = 0.7071·side and
		// Rs = −0.7071·side read round(delay·fs) frames back, silent until that many are in
		let D = Math.round(Math.fround(delay) / 1000 * fs), a = Math.exp(-2 * Math.PI * Math.fround(lfeCut) / fs), want = Array.from({ length: 6 }, () => new Float32Array(n))
		for (let i = 0, y = 0; i < n; i++) {
			let m = (L[i] + R[i]) * 0.5
			want[0][i] = L[i]; want[1][i] = R[i]; want[2][i] = m * 0.7071
			y = m * (1 - a) + y * a; want[3][i] = y
			if (i >= D) { let s = (L[i - D] - R[i - D]) * 0.5; want[4][i] = s * 0.7071; want[5][i] = -s * 0.7071 }
		}
		ok(same(ref, want), `${fs} Hz, ${delay} ms, ${lfeCut} Hz, ${mono ? 'mono' : 'stereo'} in: the kernel's whole call is the matrix, bit for bit`)
		for (let block of [1, 37, 128, 2048]) ok(same(host(surroundAtom, mono ? [L] : [L, R], { fs, block, outs: 6, set }), ref), `${fs} Hz, ${delay} ms, ${lfeCut} Hz, ${mono ? 'mono' : 'stereo'} in, blocks of ${block}`)
	}
	// lfeCut: the LFE is the one-pole y = m·(1 − a) + y·a of the mid m, its pole a = e^(−2π·lfeCut/fs) from the call that
	// brings a new cutoff on, its memory kept
	let fs = 44100, n = 8192, k = 3001, L = noise(n, 23), R = noise(n, 24), a0 = Math.exp(-2 * Math.PI * Math.fround(80) / fs), a1 = Math.exp(-2 * Math.PI * Math.fround(250) / fs)
	let out = ramped(surroundAtom, [L, R], { fs, outs: 6, set: { lfeCut: 80 }, key: 'lfeCut', to: 250, k }), worst = 0
	for (let i = 0, y = 0; i < n; i++) { let a = i < k ? a0 : a1; y = (L[i] + R[i]) * 0.5 * (1 - a) + y * a; worst = Math.max(worst, Math.abs(out[3][i] - y)) }
	ok(worst < 1e-7, `lfeCut 80 → 250 Hz at frame ${k}: the LFE within ${worst.toExponential(1)} of the one-pole switching there`)
	// delay: L = x/16, R = −x/16 for a ramp x, so the side signal is x/16 and Ls = 0.7071·x/16 read P samples back gives P;
	// a far move is read at the tape bound from the frame the line moves (32 frames after the jump) and lands on the
	// rounded delay, the same in any cut of the calls
	let x = Float32Array.from({ length: n }, (_, i) => i / 16), nx = x.map(v => -v)
	for (let [d0, d1] of [[12, 40], [50, 2]]) {
		let runs = [1, 7, 32, 128].map(block => ramped(surroundAtom, [x, nx], { fs, block, outs: 6, set: { delay: d0 }, key: 'delay', to: d1, k: 4096 }))
		ok(runs.every(o => same(o, runs[3])), `delay ${d0} → ${d1} ms: the same samples in calls of 1, 7, 32 and 128`)
		let P = Float64Array.from(runs[3][4], (v, i) => i - 16 * v / 0.7071), W0 = Math.round(Math.fround(d0) / 1000 * fs), W1 = Math.round(Math.fround(d1) / 1000 * fs)
		let [lo, hi] = speeds(P, 4096, n), land = 4096 + 33 + Math.ceil(Math.abs(W1 - W0) / (W1 > W0 ? 0.5 : 1))
		ok(P.subarray(W0, 4096 + 33).every(p => Math.abs(p - W0) < 1e-3), `delay ${d0} → ${d1} ms: ${W0} samples until the line moves`)
		ok(lo > 0.5 - 1e-3 && hi < 2 + 1e-3, `delay ${d0} → ${d1} ms: the read's speed ${lo.toFixed(4)} to ${hi.toFixed(4)}, within half and double`)
		ok(P.subarray(land).every(p => Math.abs(p - W1) < 1e-3), `delay ${d0} → ${d1} ms: on ${W1} samples from ${land - 4096} frames after the jump`)
	}
})

const peakOf = chans => chans.reduce((p, c) => c.reduce((q, v) => Math.max(q, Math.abs(v)), p), 0)

test('binaural atom: distance is the inverse law clamped at 1 m, gain 1/max(distance, 1) (OpenAL 1.1, §3.4.2; Web Audio API, §1.27 "inverse", refDistance 1): nearer than 1 m sounds as 1 m, and a move is never louder than the louder of its two ends (was: 1/distance, a pole at 0 inside the range, and a move to or from 0 m ran through gains up to 441)', () => {
	// a 220 Hz tone of 0.5 in both channels, azimuth 30, mix 1
	let fs = 44100, n = 16384, k = 8192, x = Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 220 * i / fs)), set = { azimuth: 30, mix: 1 }
	let held = d => host(binauralAtom, [x, x], { fs, set: { ...set, distance: d } }), one = held(1)
	for (let d of [0, 0.01, 0.5, 0.999]) { let o = held(d); ok(same(o, one), `${d} m held: as 1 m, bit for bit (peak ${peakOf(o).toFixed(3)} against ${peakOf(one).toFixed(3)})`) }
	let l = Float64Array.from(x), r = Float64Array.from(x), l1 = Float64Array.from(x), r1 = Float64Array.from(x)
	fx.binaural(l, r, { ...set, distance: 0.25, fs }); fx.binaural(l1, r1, { ...set, distance: 1, fs })
	ok(l.every((v, i) => Object.is(v, l1[i])) && r.every((v, i) => Object.is(v, r1[i])), 'the kernel at 0.25 m: as at 1 m, bit for bit')
	// a move between distances of 1 m or less keeps the gain at 1 throughout: the output at 1 m, bit for bit
	for (let [a, b] of [[1, 0], [0, 0.5], [0, 1], [0.5, 0]]) for (let block of [1, 32, 128]) {
		let o = ramped(binauralAtom, [x, x], { fs, block, set: { ...set, distance: a }, key: 'distance', to: b, k })
		ok(same(o, one), `${a} → ${b} m in calls of ${block}: as 1 m throughout, bit for bit (peak ${peakOf(o).toFixed(2)} against ${peakOf(one).toFixed(2)})`)
	}
	// a move with an end past 1 m: the gain g moves monotonically between the two ends' gains. The wet output is
	// Σ_k f_k·g[i−k]·mid[i−k] (f: the ITD read, taps D and D + 1, then the head-shadow filter h); against g[i−D]·Σ_k f_k·mid[i−k],
	// which lies between the two ends' outputs at frame i, it is off by Σ_k |f_k|·|g[i−k] − g[i−D]|·|mid| ≤ A·δ·S: A the
	// mid's peak, δ the gain's largest step a frame, S = Σ_j (j + 1)·|h_j|. h_0 = b0 ≤ 2 (α ≤ 2) and h_j = (b1 − a1·b0)·(−a1)^(j−1),
	// whose sum is |1 − α|·(κ/2K + κ/(K + κ)) ≤ fs·a/(2c) + 1 (K = 2c/a, κ = 2fs; the filter as binaural.js derives it), so
	// S ≤ 3 + fs·a/(2c). δ: the host's ramp moves the distance |b − a|/R a frame (R = smoothing·fs frames; 2^-19 for the
	// float32 values a host hands), and 1/max(d, 1) moves by at most that over max(min(a, b), 1)². Float32 output: 2^-23 of the peak
	let S = 3 + fs * 0.0875 / (2 * 343), R = Math.round(binauralAtom.params.distance.smoothing * fs)
	for (let [a, b] of [[2, 0], [0, 2], [0, 10], [10, 0], [0.5, 3], [1, 10]]) {
		let lim = Math.max(peakOf(held(a)), peakOf(held(b))), eps = 0.5 * (Math.abs(b - a) / R + 2 ** -19) / Math.max(Math.min(a, b), 1) ** 2 * S + lim * 2 ** -23
		for (let block of [1, 32, 128]) {
			let p = peakOf(ramped(binauralAtom, [x, x], { fs, block, set: { ...set, distance: a }, key: 'distance', to: b, k }))
			ok(p <= lim + eps, `${a} → ${b} m in calls of ${block}: peak ${p.toFixed(4)}, the louder end's ${lim.toFixed(4)} (+${eps.toExponential(1)})`)
		}
	}
})

test('haas and surround atoms: the tail holds while a delay moves: it declares the longest read, time.max or delay.max, so a read still behind as the input stops is heard out (was: the tail at the time in force, which a shrinking move outlasts)', () => {
	let fs = 44100, n = fs / 2, stop = n >> 2, x = [noise(n, 31), noise(n, 32)]
	for (let c of x) c.fill(0, stop)
	let cases = [[haasAtom, 2, { time: 35 }, 'time', 1], [haasAtom, 2, { time: 20 }, 'time', 1], [haasAtom, 2, { time: 20, channel: 'right' }, 'channel', 'left'],
		[surroundAtom, 6, { delay: 50, lfeCut: 300 }, 'delay', 1], [surroundAtom, 6, { delay: 30, lfeCut: 120 }, 'delay', 2]]
	for (let [m, outs, set, key, to] of cases) for (let lead of [0, 5, 15]) {
		// a new value set `lead` ms before the input stops; the host takes the tail at the values in force there, the new ones
		let k = stop - Math.round(lead / 1000 * fs), out = ramped(m, x, { fs, outs, set, key, to, k })
		let now = { ...set, [key]: to }, params = Object.fromEntries(Object.entries(m.params).map(([p, d]) => { let v = now[p] ?? d.default; return [p, d.type === 'number' ? Float32Array.of(v) : v] }))
		let T = m.tail({ sampleRate: fs, params }), last = stop
		for (let i = stop; i + 64 <= n; i += 64) if (out.some(o => rmsOf(o, i, i + 64) > rmsOf(x[0], 0, stop) * 1e-3)) last = i + 64
		ok(quiet(out, x[0], stop, stop + Math.max(128, Math.ceil(T * fs))), `${m.name} ${JSON.stringify(set)} → ${key} ${to}, ${lead} ms before the stop: rings ${last - stop} frames, declares ${Math.ceil(T * fs)}`)
	}
})

test('every spatial atom: outputs that are its inputs\' memory (contract 1.0, process) give what separate outputs give, bit for bit: held, as numbers move and as enums switch (was: the ambisonic panner, rotator and decoder read inputs they had written over)', () => {
	let D3 = { inputs: ['ambisonic-3'], outputs: ['7.1'] }, D1 = { inputs: ['ambisonic-1'], outputs: ['stereo'] }, A3 = { inputs: ['ambisonic-3'], outputs: ['ambisonic-3'] }
	let cases = [[widenerAtom, 2, 2], [pannerAtom, 2, 2], [autopanAtom, 2, 2], [binauralAtom, 2, 2], [microshiftAtom, 2, 2], [haasAtom, 2, 2, undefined, { channel: 'left' }],
		[midsideAtom, 2, 2, undefined, { mode: 'decode' }], [surroundAtom, 2, 6], [surroundAtom, 1, 6], [ambisonicPanner, 1, 16, { inputs: ['mono'], outputs: ['ambisonic-3'] }],
		[ambisonicRotate, 16, 16, A3], [ambisonicDecoder, 16, 8, D3, { weighting: 'inphase' }], [ambisonicDecoder, 4, 2, D1, { method: 'basic' }]]
	for (let [m, ni, no, layouts, switched = {}] of cases) {
		// 160 calls: held for 40 (calls of 1 to 128 frames), every number moving a call at a time for 40 (calls of 1 to 32, as
		// a host moves a value), held for 40, the enums switched at call 100, moving back for 40; numbers at 30 % and 70 % of
		// their range, so a gain is not 1 and an angle not 0
		let seed = 5, u = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
		let calls = Array.from({ length: 160 }, (_, j) => (j >= 40 && j < 80) || j >= 120 ? 1 + Math.floor(u() * 32) : 1 + Math.floor(u() * 128))
		let total = calls.reduce((a, b) => a + b), sig = Array.from({ length: ni }, (_, c) => noise(total, 40 + c))
		let at = j => { let t = j < 40 ? 0.3 : j < 80 ? 0.3 + 0.4 * (j - 40) / 40 : j < 120 ? 0.7 : 0.7 - 0.4 * (j - 120) / 40; return Object.fromEntries(Object.entries(m.params).map(([p, d]) => [p, d.type === 'number' ? Float32Array.of(d.min + (d.max - d.min) * t) : j >= 100 && p in switched ? switched[p] : d.default])) }
		let run = alias => {
			let io = sig.map(c => c.slice()), out = Array.from({ length: no }, (_, c) => alias && c < ni ? io[c] : new Float32Array(total))
			let proc = m({ sampleRate: 48000, maxBlockSize: 128, maxChannels: Math.max(ni, no), params: at(0), layouts })
			for (let j = 0, f = 0; j < 160; f += calls[j++]) {
				let e = f + calls[j]
				proc([io.map(c => c.subarray(f, e))], [out.map(c => new Float32Array(c.buffer, c.byteOffset + 4 * f, e - f))], at(j))
			}
			return out
		}
		let a = run(true), b = run(false), worst = 0
		for (let c = 0; c < no; c++) for (let i = 0; i < total; i++) worst = Math.max(worst, Math.abs(a[c][i] - b[c][i]))
		ok(same(a, b), `${m.name}, ${ni} in, ${no} out${layouts ? ` (${layouts.inputs[0]} → ${layouts.outputs[0]})` : ''}: in place as with separate outputs, bit for bit (${worst.toExponential(2)} apart)`)
	}
})

// CONTRACT 1.0, process: "Allocate nothing". A warm process() in a child Node with a 1 MB young generation, counted over
// 2^16 blocks of 8 frames (a collection is 1 MB, so 16 bytes a block show), under the validator's flags, at the
// defaults and with each live param moving every block, one case after another in one process, so a processor's later
// cases run a second (third...) instance on the code its first left. Where V8 boxes a number moves with its version:
// measured on Node 20, 22 and 25
test('the spatial atoms allocate nothing in process, at their defaults, as their params move, and in a second instance', { skip: +process.versions.node.split('.')[0] < 20 && 'measured on Node 20 and later', timeout: 120000 }, () => {
	let A3 = { inputs: ['ambisonic-3'], outputs: ['ambisonic-3'] }, P3 = { inputs: ['mono'], outputs: ['ambisonic-3'] }, D3 = { inputs: ['ambisonic-3'], outputs: ['7.1'] }, D1 = { inputs: ['ambisonic-1'], outputs: ['stereo'] }
	let cases = [['widener'], ['widener', 'width', 0, 4], ['microshift'], ['microshift', 'cents', 1, 50], ['microshift', 'mix', 0, 1], ['haas'], ['haas', 'time', 1, 35],
		['haas', 'channel', 'left', 'right'], ['binaural'], ['binaural', 'headRadius', 0.05, 0.12], ['binaural', 'azimuth', -180, 180], ['binaural', 'distance', 0, 10], ['binaural', 'mix', 0, 1],
		['panner'], ['panner', 'pan', -1, 1], ['autopan'], ['autopan', 'rate', 0.01, 20], ['autopan', 'depth', 0, 1], ['autopan'],
		['surround', , , , 2, 6], ['surround', 'delay', 1, 50, 2, 6], ['surround', 'lfeCut', 40, 300, 2, 6],
		['ambisonicPanner', , , , 1, 16, P3], ['ambisonicPanner', 'az', -180, 180, 1, 16, P3], ['ambisonicPanner', 'el', -90, 90, 1, 16, P3], ['ambisonicPanner', 'gain', 0, 4, 1, 16, P3],
		['ambisonicRotate', , , , 16, 16, A3], ['ambisonicRotate', 'yaw', -180, 180, 16, 16, A3], ['ambisonicRotate', 'pitch', -90, 90, 16, 16, A3], ['ambisonicRotate', 'roll', -180, 180, 16, 16, A3],
		['ambisonicDecoder', , , , 16, 8, D3], ['ambisonicDecoder', 'weighting', 'basic', 'inphase', 16, 8, D3], ['ambisonicDecoder', 'method', 'sampling', 'basic', 4, 2, D1],
		// midside: each mode, the mode switched, the width moving while it decodes (an 8th item holds other values)
		['midside'], ['midside', 'mode', 'encode', 'decode'], ['midside', 'width', 0.3, 3.3, 2, 2, , { mode: 'decode' }]]
		.map(([name, key, a, b, ni = 2, no = 2, layouts, set]) => [import.meta.resolve(`@audio/spatial-${name.startsWith('ambisonic') ? 'ambisonic' : name}/audio`), name, key, a, b, ni, no, layouts, set])
	let child = `
		import { PerformanceObserver } from 'node:perf_hooks'
		let counts = []
		for (let [url, name, key, a, b, ni, no, layouts, set] of JSON.parse(process.argv[1])) {
			let m = (await import(url))[name], given = () => Object.assign(Object.fromEntries(Object.entries(m.params).map(([k, s]) => [k, s.type === 'number' ? Float32Array.of(s.default) : s.default])), set)
			let params = given(), proc = m({ sampleRate: 48000, maxBlockSize: 128, maxChannels: Math.max(ni, no), params: given(), layouts })
			let src = Array.from({ length: ni }, (_, c) => Float32Array.from({ length: 512 }, (_, i) => 0.5 * Math.sin(i * 0.1 + c) + 0.1 * Math.sin(i * 1.7)))
			let ins = Array.from({ length: 64 }, (_, k) => [src.map(c => c.subarray(k * 8, k * 8 + 8))]), outs = [Array.from({ length: no }, () => new Float32Array(8))]
			let v = typeof a === 'number' ? params[key] : null, to = Float32Array.of(a ?? 0, b ?? 0)
			let move = !key ? i => {} : v ? i => { v[0] = to[i & 1] } : i => { params[key] = i & 1 ? b : a }
			let run = n => { for (let i = 0; i < n; i++) { move(i); proc(ins[i & 63], outs, params) } }
			run(1 << 15); globalThis.gc()
			let gcs = 0, seen = new PerformanceObserver(list => { gcs += list.getEntries().length }); seen.observe({ entryTypes: ['gc'] })
			run(1 << 16); await new Promise(done => setTimeout(done, 20)); seen.disconnect()
			counts.push(gcs)
		}
		console.log(JSON.stringify(counts))`
	let counts = JSON.parse(execFileSync(process.execPath, ['--max-semi-space-size=1', '--expose-gc', '--no-concurrent-recompilation', '--input-type=module', '-e', child, JSON.stringify(cases)], { encoding: 'utf8', timeout: 120000 }))
	cases.forEach(([, name, key, a, b, , , , set], k) => is(counts[k], 0, `${name}${set ? `, ${Object.entries(set).map(e => e.join(' ')).join(', ')}` : ''}${key ? `, ${key} ${a} ↔ ${b} each block` : ''}: ${counts[k]} collections in 2^16 blocks`))
})

// midside's manifest hands its kernel one pair made with the instance. With an array made in each call, two instances
// called in turn while they decode, the values in a different object each call, cost 64 bytes a call on Node 22 and 20
// (8 collections in 2^17 calls with a 1 MB young generation)
test('midside: two instances called in turn while they decode allocate nothing', { skip: +process.versions.node.split('.')[0] < 20 && 'measured on Node 20 and later', timeout: 120000 }, () => {
	let child = `
		import { PerformanceObserver } from 'node:perf_hooks'
		let { midside } = await import(process.argv[1])
		let ps = Array.from({ length: 1024 }, (_, k) => ({ mode: 'decode', width: Float32Array.of(0.3 + 3 * (k % 64) / 64) }))
		let ctx = () => ({ sampleRate: 48000, maxBlockSize: 8, maxChannels: 2, params: ps[0] }), a = midside(ctx()), b = midside(ctx())
		let ins = [[new Float32Array(8).fill(0.2), new Float32Array(8).fill(0.1)]], o1 = [[new Float32Array(8), new Float32Array(8)]], o2 = [[new Float32Array(8), new Float32Array(8)]]
		let run = n => { for (let i = 0; i < n; i++) { a(ins, o1, ps[i & 1023]); b(ins, o2, ps[i & 1023]) } }
		run(1 << 16); globalThis.gc()
		let gcs = 0, seen = new PerformanceObserver(list => { gcs += list.getEntries().length }); seen.observe({ entryTypes: ['gc'] })
		run(1 << 16); await new Promise(done => setTimeout(done, 20)); seen.disconnect()
		console.log(gcs)`
	let gcs = +execFileSync(process.execPath, ['--max-semi-space-size=1', '--expose-gc', '--no-concurrent-recompilation', '--input-type=module', '-e', child, import.meta.resolve('@audio/spatial-midside/audio')], { encoding: 'utf8', timeout: 120000 })
	assert.equal(gcs, 0, `${gcs} collections in 2^17 calls`)
})
