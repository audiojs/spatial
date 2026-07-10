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
