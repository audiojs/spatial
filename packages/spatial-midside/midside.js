// Mid/side matrix — encode L/R → M/S and back; the substrate of widening, vocal
// isolation (@audio/vocals) and M/S processing. decode accepts a width factor.

// Both write into the two channels of the pair given and return that pair: nothing is made per call, so a block loop
// may call them (the contract: `process` allocates nothing). `width` may be a typed array holding it at [0], a live
// parameter as a host hands it, read here so that no number is passed boxed.

export function encode (pair) {
	const L = pair[0], R = pair[1]
	for (let i = 0; i < L.length; i++) {
		let m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5
		L[i] = m; R[i] = s
	}
	return pair
}

export function decode (pair, { width = 1 } = {}) {
	const M = pair[0], S = pair[1], w = ArrayBuffer.isView(width) ? width[0] : +width
	for (let i = 0; i < M.length; i++) {
		let m = M[i], s = S[i] * w
		M[i] = m + s; S[i] = m - s
	}
	return pair
}

export default { encode, decode }
