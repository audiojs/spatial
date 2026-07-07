// Stereo → 5.1 matrix upmix: C = center content, L/R pass, Ls/Rs = decorrelated side
// (delayed ±), LFE = lowpassed mono. Simple matrix upmix, documented — not Dolby decoding.

export default function surround ([L, R], { fs = 44100, surroundDelay = 0.012, lfeCut = 120 } = {}) {
	let n = L.length
	let C = new Float32Array(n), Ls = new Float32Array(n), Rs = new Float32Array(n), LFE = new Float32Array(n)
	let D = Math.round(surroundDelay * fs)
	let a = Math.exp(-2 * Math.PI * lfeCut / fs)
	let lp = 0
	for (let i = 0; i < n; i++) {
		let m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5
		C[i] = m * 0.7071
		lp = m * (1 - a) + lp * a
		LFE[i] = lp
		if (i >= D) {
			let sd = (L[i - D] - R[i - D]) * 0.5
			Ls[i] = sd * 0.7071
			Rs[i] = -sd * 0.7071
		}
	}
	return [Float32Array.from(L), Float32Array.from(R), C, LFE, Ls, Rs]
}
