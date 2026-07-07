import test, { almost, ok, is } from 'tst'
import crossfeed from '@audio/spatial-crossfeed'
const audio = { crossfeed }
import { lowshelf, highshelf } from 'digital-filter/iir/biquad.js'
import { dftMag, magDB, impulse, dc, EPSILON, LOOSE } from './util.js'

// Complex per-band frequency response (SOS cascade), for verifying flat-sum
// crossover reconstruction — magDB() alone discards phase, which hides
// polarity-cancellation defects (e.g. LR2 without inversion).
function sosComplex (sos, f, fs) {
	let w = 2 * Math.PI * f / fs
	let re = 1, im = 0
	for (let c of sos) {
		let br = c.b0 + c.b1 * Math.cos(w) + c.b2 * Math.cos(2 * w)
		let bi = -(c.b1 * Math.sin(w) + c.b2 * Math.sin(2 * w))
		let ar = 1 + c.a1 * Math.cos(w) + c.a2 * Math.cos(2 * w)
		let ai = -(c.a1 * Math.sin(w) + c.a2 * Math.sin(2 * w))
		let denom = ar * ar + ai * ai
		let hr = (br * ar + bi * ai) / denom
		let hi = (bi * ar - br * ai) / denom
		let nr = re * hr - im * hi, ni = re * hi + im * hr
		re = nr; im = ni
	}
	return { re, im }
}

// Complex sum across bands (a true "sum the outputs" check, unlike summing magnitudes)
function sumBandsDB (bands, f, fs) {
	let re = 0, im = 0
	for (let sos of bands) {
		let h = sosComplex(sos, f, fs)
		re += h.re; im += h.im
	}
	return 10 * Math.log10(re * re + im * im)
}

test('crossfeed — mixes stereo channels', () => {
	let left = dc(256, 1)
	let right = dc(256, 0)
	audio.crossfeed(left, right, {fc: 700, level: 0.3, fs: 44100})
	// Right channel should now have some energy (mixed from left)
	let rightEnergy = 0
	for (let i = 128; i < 256; i++) rightEnergy += right[i] * right[i]
	ok(rightEnergy > 0.01, 'crossfeed mixes L→R (right energy: ' + rightEnergy.toFixed(4) + ')')
	// Left should still have energy (not fully cancelled)
	let leftEnergy = 0
	for (let i = 128; i < 256; i++) leftEnergy += left[i] * left[i]
	ok(leftEnergy > 0.1, 'left retains energy after crossfeed')
})

test('crossfeed — level=0 is passthrough', () => {
	let N = 256
	let left = dc(N, 0.7), right = dc(N, -0.3)
	let origL = Float64Array.from(left), origR = Float64Array.from(right)
	audio.crossfeed(left, right, { fc: 700, level: 0, fs: 44100 })
	let maxErrL = 0, maxErrR = 0
	for (let i = 0; i < N; i++) {
		if (Math.abs(left[i] - origL[i]) > maxErrL) maxErrL = Math.abs(left[i] - origL[i])
		if (Math.abs(right[i] - origR[i]) > maxErrR) maxErrR = Math.abs(right[i] - origR[i])
	}
	ok(maxErrL < LOOSE, `left passthrough err=${maxErrL.toFixed(8)}`)
	ok(maxErrR < LOOSE, `right passthrough err=${maxErrR.toFixed(8)}`)
})

test('crossfeed — mono content stays near unity gain across level range (Bauer/BS2B)', () => {
	// Bauer (1961) / BS2B: direct+cross gain sums to unity so correlated/mono content
	// isn't boosted. Below fc the lowpass crossfeed term is ~unity, so a mono tone
	// well below fc should measure ~0dB regardless of level.
	let fs = 44100, N = 4096, fc = 700, freq = 50
	for (let level of [0.3, 0.5, 0.7]) {
		let left = new Float64Array(N), right = new Float64Array(N)
		for (let i = 0; i < N; i++) left[i] = right[i] = Math.sin(2 * Math.PI * freq * i / fs)
		audio.crossfeed(left, right, { fc, level, fs })
		let peak = 0
		for (let i = 3 * N / 4; i < N; i++) if (Math.abs(left[i]) > peak) peak = Math.abs(left[i])
		let db = 20 * Math.log10(peak)
		ok(Math.abs(db) < 0.5, `crossfeed level=${level}: mono gain=${db.toFixed(3)}dB`)
	}
})

test('crossfeed — recomputes coefficients when fc/fs/level change on reused params', () => {
	let p = { fc: 200, level: 0.3, fs: 44100 }
	audio.crossfeed(dc(64, 1), dc(64, 0), p)
	let before = JSON.stringify(p._coefs)
	p.fc = 5000
	audio.crossfeed(dc(64, 1), dc(64, 0), p)
	let after = JSON.stringify(p._coefs)
	ok(before !== after, 'fc mutation triggers coefficient rebuild')
})
