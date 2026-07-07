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
