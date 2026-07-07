// Mid/side matrix — encode L/R → M/S and back; the substrate of widening, vocal
// isolation (@audio/vocals) and M/S processing. decode accepts a width factor.

export function encode ([L, R]) {
	for (let i = 0; i < L.length; i++) {
		let m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5
		L[i] = m; R[i] = s
	}
	return [L, R]
}

export function decode ([M, S], { width = 1 } = {}) {
	for (let i = 0; i < M.length; i++) {
		let m = M[i], s = S[i] * width
		M[i] = m + s; S[i] = m - s
	}
	return [M, S]
}

export default { encode, decode }
