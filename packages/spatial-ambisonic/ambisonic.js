/**
 * Ambisonics — encode / rotate / decode, 1st-3rd order (HOA), ACN channel ordering,
 * SN3D normalization (AmbiX convention), with FuMa conversion.
 *
 * Convention: azimuth in degrees, counter-clockwise from front (0 = front, +90 =
 * left, ±180 = back, -90 = right); elevation in degrees, positive up. Cartesian
 * axes x = front, y = left, z = up (right-handed): a source at (az, el) sits at
 * unit vector (cos(az)cos(el), sin(az)cos(el), sin(el)) — which is exactly the
 * (unnormalized) first-order SH triple (X, Y, Z), the standard ambisonics identity.
 * NOTE this azimuth sign is opposite @audio/spatial-binaural's (0 front, +right) —
 * decodeBinaural() below negates explicitly at the boundary; nothing else in this
 * package touches binaural's convention.
 *
 * Real spherical harmonics Y_l^m(az, el), ACN index n = l² + l + m, no
 * Condon-Shortley phase (the convention every ambisonics exchange format uses):
 *   Y_l^m = N_l^m · P_l^|m|(sin el) · { cos(m·az)  m ≥ 0
 *                                      { sin(|m|·az) m < 0
 *   N_l^m(SN3D) = √((2-δ_m0)(l-|m|)!/(l+|m|)!),  N_l^m(N3D) = N_l^m(SN3D)·√(2l+1)
 * P_l^m is the associated Legendre function without the (-1)^m Condon-Shortley
 * factor (the "geodesy" convention).
 *
 * Citations:
 *  - F. Zotter & M. Frank, "Ambisonics," Springer Open, 2019 (open access) — SH
 *    definitions §2.2-2.4, SN3D/N3D §2.4, max-rE decoding §4.4-4.5.
 *  - J. Daniel, "Représentation de champs acoustiques, application à la
 *    transmission et à la reproduction de scènes sonores complexes dans un
 *    contexte multimédia," PhD thesis, Université Paris 6, 2001 — SN3D/N3D
 *    (eq. 3.9 relation used above), max-rE and in-phase decoding weights.
 *  - S. Nachbar, F. Zotter, E. Deleflie, A. Sontacchi, "AMBIX — A Suggested
 *    Ambisonics Format," Ambisonics Symposium 2011, eq. 3 — ACN/SN3D definition
 *    and the FuMa (maxN) conversion factors used in fumaToAmbix/ambixToFuma
 *    (cross-checked against the independently-sourced legacy Furse-Malham
 *    coefficient table reproduced on Wikipedia's "Ambisonic data exchange
 *    formats" page — both agree to the last digit).
 *  - M. A. Gerzon, "Periphony: With-Height Sound Reproduction," JAES 21(1), 1973;
 *    "Ambisonics in Multichannel Broadcasting and Video," JAES 33(11), 1985 —
 *    energy/velocity vector decoding criteria (rE, the max-rE optimization target).
 *  - J. Merimaa & V. Pulkki, "Spatial Impulse Response Rendering I: Analysis and
 *    Synthesis," JAES 53(12), 2005 — DirAC energy/intensity direction-of-arrival
 *    and diffuseness analysis, used by direction().
 *
 * Limits (see README): sampling/mode-matching decoders only — no AllRAD for
 * irregular layouts; no near-field (distance) compensation on encode; binaural
 * decode drops elevation (spatial-binaural is azimuth-only).
 */

import binauralFn from '@audio/spatial-binaural'

let { sin, cos, sqrt, atan2, asin, abs, max: mmax, min: mmin, round, PI } = Math
const DEG = PI / 180, RAD = 180 / PI
const GOLDEN_ANGLE = PI * (3 - sqrt(5))   // Vogel/spherical-Fibonacci step, ≈137.5°

// ───────────────────────────── associated Legendre / real SH ─────────────────────────────

function factorial (n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r }

// Associated Legendre P_l^m(x), x ∈ [-1,1], m ≥ 0, no Condon-Shortley phase.
// Standard three-term recursion (e.g. Press et al., "Numerical Recipes," §6.8),
// with the customary leading (-1)^m dropped to match the ambisonics convention.
function legendre (l, m, x) {
	let pmm = 1
	if (m > 0) {
		let somx2 = sqrt((1 - x) * (1 + x))
		let fact = 1
		for (let i = 1; i <= m; i++) { pmm *= fact * somx2; fact += 2 }
	}
	if (l === m) return pmm
	let pmmp1 = x * (2 * m + 1) * pmm
	if (l === m + 1) return pmmp1
	let pll = 0
	for (let ll = m + 2; ll <= l; ll++) {
		pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m)
		pmm = pmmp1; pmmp1 = pll
	}
	return pll
}

// Plain Legendre polynomial P_l(x) (m=0), Bonnet's recursion.
function legendreP (l, x) {
	if (l === 0) return 1
	if (l === 1) return x
	let p0 = 1, p1 = x, p2 = 0
	for (let n = 2; n <= l; n++) { p2 = ((2 * n - 1) * x * p1 - (n - 1) * p0) / n; p0 = p1; p1 = p2 }
	return p1
}
function legendrePDeriv (l, x) {
	// P_l'(x) = l/(x²-1) · (x·P_l(x) - P_{l-1}(x)) — standard identity, valid off x=±1.
	return l / (x * x - 1) * (x * legendreP(l, x) - legendreP(l - 1, x))
}
// Largest root of P_n(x) = 0 in (0,1), by Newton-Raphson from the standard
// asymptotic (Chebyshev) initial guess. Used for max-rE weighting (see below);
// derived from the definition rather than a hardcoded table.
function legendreRootMax (n) {
	let x = cos(PI * 0.75 / (n + 0.5))
	for (let i = 0; i < 100; i++) {
		let dx = legendreP(n, x) / legendrePDeriv(n, x)
		x -= dx
		if (abs(dx) < 1e-15) break
	}
	return x
}

function shNorm (l, m, norm) {
	let n = sqrt((m === 0 ? 1 : 2) * factorial(l - abs(m)) / factorial(l + abs(m)))
	return norm === 'n3d' ? n * sqrt(2 * l + 1) : n
}

// Double-precision SH vector, plain Array — internal use (matrix construction).
function shVecD (azDeg, elDeg, order, norm) {
	let az = azDeg * DEG, el = elDeg * DEG, x = sin(el)
	let out = new Array((order + 1) ** 2)
	for (let l = 0; l <= order; l++) {
		for (let m = -l; m <= l; m++) {
			let p = legendre(l, abs(m), x)
			let trig = m >= 0 ? cos(m * az) : sin(-m * az)
			out[l * l + l + m] = shNorm(l, m, norm) * p * trig
		}
	}
	return out
}

/** The encoding vector Y for a source at (az, el): (order+1)² gains, ACN order. */
export function sh (az, el, order = 1, norm = 'sn3d') {
	return Float32Array.from(shVecD(az, el, order, norm))
}

function acnDegree (n) { return Math.floor(sqrt(n)) }   // l such that l² ≤ n < (l+1)²
function orderFromChannels (n) {
	let order = round(sqrt(n)) - 1
	if ((order + 1) ** 2 !== n) throw new Error(`ambisonic: channel count ${n} is not (order+1)² — not a valid ACN buffer`)
	return order
}

// ───────────────────────────── tiny dense linear algebra (all matrices ≤ 20×20) ─────────────────────────────

function transpose (A) { let m = A.length, n = A[0].length, T = []; for (let j = 0; j < n; j++) { let row = new Array(m); for (let i = 0; i < m; i++) row[i] = A[i][j]; T.push(row) } return T }
function matMul (A, B) {
	let m = A.length, k = B.length, n = B[0].length, C = []
	for (let i = 0; i < m; i++) {
		let row = new Array(n).fill(0), Ai = A[i]
		for (let p = 0; p < k; p++) { let a = Ai[p]; if (!a) continue; let Bp = B[p]; for (let j = 0; j < n; j++) row[j] += a * Bp[j] }
		C.push(row)
	}
	return C
}
// Gauss-Jordan matrix inverse with partial pivoting — n ≤ 16 here, cost is negligible.
function inverse (A) {
	let n = A.length
	let M = A.map((row, i) => row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))))
	for (let col = 0; col < n; col++) {
		let piv = col
		for (let r = col + 1; r < n; r++) if (abs(M[r][col]) > abs(M[piv][col])) piv = r
		if (abs(M[piv][col]) < 1e-10) throw new Error('ambisonic: singular matrix (degenerate layout for this order)')
		if (piv !== col) [M[col], M[piv]] = [M[piv], M[col]]
		let d = M[col][col]
		for (let j = 0; j < 2 * n; j++) M[col][j] /= d
		for (let r = 0; r < n; r++) {
			if (r === col) continue
			let f = M[r][col]
			if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j]
		}
	}
	return M.map(row => row.slice(n))
}
// Moore-Penrose pseudo-inverse via normal equations (A: m×n array-of-rows → n×m).
function pinv (A) {
	let m = A.length, n = A[0].length
	if (m >= n) { let At = transpose(A); return matMul(inverse(matMul(At, A)), At) }
	let At = transpose(A); return matMul(At, inverse(matMul(A, At)))
}
function identity (n) { return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))) }

// ───────────────────────────── directions: conversion, spherical Fibonacci lattice ─────────────────────────────

function azElToXYZ (azDeg, elDeg) { let az = azDeg * DEG, el = elDeg * DEG, ce = cos(el); return [cos(az) * ce, sin(az) * ce, sin(el)] }
function xyzToAzEl (x, y, z) { return [atan2(y, x) * RAD, asin(mmax(-1, mmin(1, z))) * RAD] }

// Spherical Fibonacci lattice (Vogel's method) — N points, roughly evenly spread.
// Á. González, "Measurement of Areas on a Sphere Using Fibonacci and Latitude–
// Longitude Lattices," Mathematical Geosciences 42, 2010.
function fibonacciSphere (N) {
	let dirs = []
	for (let i = 0; i < N; i++) {
		let z = 1 - (2 * i + 1) / N
		let el = asin(mmax(-1, mmin(1, z))) * RAD
		let a = (i * GOLDEN_ANGLE) % (2 * PI)
		if (a > PI) a -= 2 * PI
		dirs.push({ az: a * RAD, el })
	}
	return dirs
}

// ───────────────────────────── encode ─────────────────────────────

/**
 * Encode mono source(s) into ambisonic B-format (ACN/SN3D by default).
 * @param {Float32Array|{data:Float32Array,az?:number,el?:number,gain?:number}[]} input
 * @param {{order?:number, az?:number, el?:number, gain?:number, norm?:'sn3d'|'n3d'}} [opts]
 * @returns {Float32Array[]} (order+1)² channels, ACN order
 */
export function encode (input, opts = {}) {
	let order = opts.order ?? 1
	let norm = opts.norm ?? 'sn3d'
	let sources = Array.isArray(input)
		? input
		: [{ data: input, az: opts.az ?? 0, el: opts.el ?? 0, gain: opts.gain ?? 1 }]
	if (!sources.length) throw new Error('ambisonic.encode: no source given')
	let n = sources[0].data.length
	for (let s of sources) if (s.data.length !== n) throw new Error('ambisonic.encode: all sources must have equal length')
	let C = (order + 1) ** 2
	let out = Array.from({ length: C }, () => new Float32Array(n))
	for (let s of sources) {
		let g = s.gain ?? 1
		if (!g) continue
		let y = shVecD(s.az ?? 0, s.el ?? 0, order, norm)
		let d = s.data
		for (let c = 0; c < C; c++) {
			let gy = g * y[c]
			if (!gy) continue
			let ch = out[c]
			for (let i = 0; i < n; i++) ch[i] += d[i] * gy
		}
	}
	return out
}

// ───────────────────────────── rotate ─────────────────────────────

// Cartesian rotation M = Rz(yaw)·Ry(pitch)·Rx(roll), acting on column [x,y,z]
// (x=front,y=left,z=up). yaw is about the up axis with the same sign as azimuth
// (positive yaw increases a source's azimuth — see README/test 3). pitch is about
// the left axis, positive = nose up. roll is about the front axis. Order fixed:
// roll applied first, then pitch, then yaw (extrinsic composition).
function rotationMatrix3 (yawDeg, pitchDeg, rollDeg) {
	let y = yawDeg * DEG, p = pitchDeg * DEG, r = rollDeg * DEG
	let cy = cos(y), sy = sin(y), cp = cos(p), sp = sin(p), cr = cos(r), sr = sin(r)
	let Rz = [[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]]
	let Ry = [[cp, 0, -sp], [0, 1, 0], [sp, 0, cp]]
	let Rx = [[1, 0, 0], [0, cr, -sr], [0, sr, cr]]
	return matMul(Rz, matMul(Ry, Rx))
}

/**
 * The (order+1)²×(order+1)² SH rotation matrix for a yaw/pitch/roll rotation.
 * Built by the "direct" projection method (exact for band-limited SH, valid for
 * any order): sample a dense, roughly-uniform set of directions, evaluate the SH
 * vector at each direction and at its rotated counterpart, and solve the linear
 * map between them by least squares. This is algebraically exact — a rotation
 * maps each SH degree l onto a linear combination of that same degree's
 * functions only — the ≥4×(channel count) oversampling just keeps the linear
 * solve numerically well-conditioned. Equivalent by construction to the
 * Ivanic & Ruedenberg (1996) recursive block construction; verified in test.js
 * against direct re-encoding of rotated sources (< 1e-6 for orders 1-3).
 */
export function rotationMatrix (order, yaw = 0, pitch = 0, roll = 0) {
	let C = (order + 1) ** 2
	if (!yaw && !pitch && !roll) return identity(C).map(r => Float32Array.from(r))
	let M = rotationMatrix3(yaw, pitch, roll)
	let dirs = fibonacciSphere(mmax(64, 4 * C))
	let Y = [], Yr = []
	for (let d of dirs) {
		Y.push(shVecD(d.az, d.el, order, 'sn3d'))
		let [x, y, z] = azElToXYZ(d.az, d.el)
		let xr = M[0][0] * x + M[0][1] * y + M[0][2] * z
		let yr = M[1][0] * x + M[1][1] * y + M[1][2] * z
		let zr = M[2][0] * x + M[2][1] * y + M[2][2] * z
		let [azr, elr] = xyzToAzEl(xr, yr, zr)
		Yr.push(shVecD(azr, elr, order, 'sn3d'))
	}
	let Rt = matMul(pinv(Y), Yr)   // pinv(Y): C×N, Yr: N×C → C×C = Rᵀ
	return transpose(Rt).map(r => Float32Array.from(r))
}

/** Rotate an ambisonic signal by yaw/pitch/roll (degrees). Returns new arrays. */
export function rotate (channels, opts = {}) {
	let order = orderFromChannels(channels.length)
	let R = rotationMatrix(order, opts.yaw ?? 0, opts.pitch ?? 0, opts.roll ?? 0)
	let n = channels[0].length
	let C = channels.length
	let out = Array.from({ length: C }, () => new Float32Array(n))
	for (let r = 0; r < C; r++) {
		let row = R[r], outc = out[r]
		for (let c = 0; c < C; c++) {
			let g = row[c]
			if (abs(g) < 1e-9) continue
			let ch = channels[c]
			for (let i = 0; i < n; i++) outc[i] += ch[i] * g
		}
	}
	return out
}

// ───────────────────────────── decode ─────────────────────────────

// Canonical layouts (az CCW-from-front/+left, el up, degrees). `null` marks a
// non-directional slot (LFE) — kept silent in decode(), skipped by the decoder.
// Channel order matches @audio/compile CONTRACT.md § Buses exactly.
const LAYOUTS = {
	stereo: [{ az: 30, el: 0 }, { az: -30, el: 0 }],                                           // L R — ITU-R BS.775 ±30°
	quad: [{ az: 45, el: 0 }, { az: -45, el: 0 }, { az: 135, el: 0 }, { az: -135, el: 0 }],      // L R Ls Rs
	'5.1': [{ az: 30, el: 0 }, { az: -30, el: 0 }, { az: 0, el: 0 }, null, { az: 110, el: 0 }, { az: -110, el: 0 }],                 // L R C LFE Ls Rs — ITU-R BS.775
	'7.1': [{ az: 30, el: 0 }, { az: -30, el: 0 }, { az: 0, el: 0 }, null, { az: 90, el: 0 }, { az: -90, el: 0 }, { az: 135, el: 0 }, { az: -135, el: 0 }],  // L R C LFE Ls Rs Lrs Rrs
	cube: [45, 135, -135, -45].flatMap(az => [{ az, el: 35.264 }, { az, el: -35.264 }]),        // 8 cube vertices, el = asin(1/√3)
	octagon: Array.from({ length: 8 }, (_, i) => ({ az: i * 45, el: 0 })),                      // 8 around the horizon
}

function resolveSlots (layout) {
	if (Array.isArray(layout)) return layout.map(d => ({ az: d.az ?? 0, el: d.el ?? 0 }))
	let L = LAYOUTS[layout]
	if (!L) throw new Error(`ambisonic.decode: unknown layout '${layout}' (use stereo/quad/5.1/7.1/cube/octagon/binaural or a custom [{az,el}] array)`)
	return L
}

// Order-1 virtual speaker set: horizon ring (binaural is azimuth-only, see decodeBinaural).
// Order-2/3: a spherical-Fibonacci set (14/20 points) — inside the brief's stated
// 12-20 range; not an exact spherical t-design, documented in README.
function virtualSpeakers (order) {
	if (order <= 1) return LAYOUTS.octagon
	return fibonacciSphere(order === 2 ? 14 : 20)
}

// max-rE degree weights for ambisonic order N: g_l = P_l(t_N), t_N = largest root
// of P_{N+1} (Daniel 2001; Zotter & Frank 2019 §4.4). rE magnitude achieved by
// this weighting for N=1,2,3 is t_N itself (0.577/0.775/0.861 — verified in test.js).
// in-phase weights: g_l = (N!)²/((N-l)!(N+l+1)!), normalized to g_0=1 (Daniel 2001).
function degreeWeights (order, weighting) {
	if (weighting === 'basic') return Array.from({ length: order + 1 }, () => 1)
	if (weighting === 'inphase') {
		let raw = Array.from({ length: order + 1 }, (_, l) => factorial(order) ** 2 / (factorial(order - l) * factorial(order + l + 1)))
		return raw.map(v => v / raw[0])
	}
	let t = legendreRootMax(order + 1)
	return Array.from({ length: order + 1 }, (_, l) => legendreP(l, t))
}
// The sampling decoder feeds SN3D channels through the addition theorem
// Σ_m Y_l^m,SN3D(u)Y_l^m,SN3D(u0) = P_l(cosγ)/(4π) — the (2l+1) that the theorem
// carries for orthonormal (N3D) SH has already cancelled against SN3D's own
// 1/√(2l+1) per function (taken twice). Reinstating (2l+1) here is what makes a
// SN3D-fed sampling decoder actually realize the textbook g_l weighting (basic:
// the reconstruction kernel sharpens with order as it must; max-rE: realizes
// rE = t_N — verified in test.js against the 0.577/0.775/0.861 citation above).
function weightVector (order, weighting) {
	let g = degreeWeights(order, weighting), C = (order + 1) ** 2, w = new Array(C)
	for (let l = 0; l <= order; l++) for (let m = -l; m <= l; m++) w[l * l + l + m] = g[l] * (2 * l + 1)
	return w
}

// Decode matrix rows for a list of speaker directions (no LFE slots). 'sampling':
// D = (1/N)·Yᵀ·diag(weight) (Zotter & Frank §4.2 "sampling decoder" / projection
// decoding). 'basic' (mode-matching): D = pinv(Yᵀ), exact for a well-posed layout
// (Zotter & Frank §4.3). AllRAD is not implemented — sampling/mode-matching only,
// adequate for the regular/near-regular layouts this module names; an irregular
// custom layout should be checked for even coverage by the caller.
function buildDecoder (order, dirs, method, weighting) {
	let C = (order + 1) ** 2, N = dirs.length
	let Y = dirs.map(d => shVecD(d.az, d.el, order, 'sn3d'))   // N×C
	if (method === 'basic') return pinv(transpose(Y))          // pinv(C×N) → N×C
	let w = weightVector(order, weighting)
	return Y.map(row => row.map((v, c) => v * w[c] / N))
}
// Insert a zero row at each `null` slot (LFE) so the result aligns 1:1 with the
// layout's declared channel order.
function alignRows (rows, slots, C) {
	let out = [], ri = 0
	for (let slot of slots) out.push(slot ? rows[ri++] : new Array(C).fill(0))
	return out
}

/** The decode matrix (rows = speakers, in the layout's canonical order) for one
 * order/layout. `layout: 'binaural'` returns the pre-binaural virtual-speaker
 * matrix (always 'sampling' — `opts.method` is ignored there, see decodeBinaural). */
export function decoderMatrix (order, layout, opts = {}) {
	let method = opts.method ?? 'sampling', weighting = opts.weighting ?? 'maxre'
	let C = (order + 1) ** 2
	if (layout === 'binaural') return buildDecoder(order, virtualSpeakers(order), 'sampling', weighting).map(r => Float32Array.from(r))
	let slots = resolveSlots(layout)
	return alignRows(buildDecoder(order, slots.filter(Boolean), method, weighting), slots, C).map(r => Float32Array.from(r))
}

// Decode to a virtual loudspeaker set, then pass each through the structural
// binaural panner (Brown-Duda), summing L/R. Elevation is dropped — spatial-
// binaural is azimuth-only (see its README) — so the virtual speakers' elevation
// only affects which of the (order+1)² channels feed each one, not the final
// binaural cue.
function decodeBinaural (channels, order, opts) {
	let fs = opts.fs ?? 44100
	let dirs = virtualSpeakers(order)
	let D = buildDecoder(order, dirs, 'sampling', opts.weighting ?? 'maxre')
	let n = channels[0].length
	let L = new Float32Array(n), R = new Float32Array(n)
	for (let s = 0; s < dirs.length; s++) {
		let row = D[s]
		let mono = new Float32Array(n)
		for (let c = 0; c < channels.length; c++) {
			let g = row[c]
			if (!g) continue
			let ch = channels[c]
			for (let i = 0; i < n; i++) mono[i] += ch[i] * g
		}
		let bl = Float32Array.from(mono), br = Float32Array.from(mono)
		let az = -dirs[s].az   // this module: +az=left; spatial-binaural: +az=right
		if (az > 180) az -= 360; else if (az < -180) az += 360
		// Fresh params per virtual speaker: each is an independent fixed-direction
		// source, not a moving one, so binaural's own ITD ring / azimuth-smoothing /
		// head-shadow filter state (kept ON this object between calls) must not
		// carry over from one virtual speaker to the next — reusing one object
		// across the loop would smear each speaker's onset into the previous
		// speaker's stale state and break the L/R symmetry a front source needs.
		let bp = { azimuth: az, distance: 1, mix: 1, fs }
		if (opts.headRadius != null) bp.headRadius = opts.headRadius
		binauralFn(bl, br, bp)
		for (let i = 0; i < n; i++) { L[i] += bl[i]; R[i] += br[i] }
	}
	return [L, R]
}

/**
 * Decode ambisonic B-format to a speaker layout or to binaural.
 * @param {Float32Array[]} channels (order+1)² ACN/SN3D channels
 * @param {{layout?:string|{az:number,el:number}[], method?:'sampling'|'basic', weighting?:'basic'|'maxre'|'inphase', fs?:number, headRadius?:number}} [opts]
 */
export function decode (channels, opts = {}) {
	let order = orderFromChannels(channels.length)
	let layout = opts.layout ?? 'stereo'
	if (layout === 'binaural') return decodeBinaural(channels, order, opts)
	let method = opts.method ?? 'sampling', weighting = opts.weighting ?? 'maxre'
	let slots = resolveSlots(layout)
	let D = alignRows(buildDecoder(order, slots.filter(Boolean), method, weighting), slots, channels.length)
	let n = channels[0].length
	let out = D.map(() => new Float32Array(n))
	for (let s = 0; s < D.length; s++) {
		let row = D[s], outc = out[s]
		for (let c = 0; c < channels.length; c++) {
			let g = row[c]
			if (!g) continue
			let ch = channels[c]
			for (let i = 0; i < n; i++) outc[i] += ch[i] * g
		}
	}
	return out
}

// ───────────────────────────── FuMa ↔ AmbiX ─────────────────────────────

// [fumaStreamIndex, acnIndex, gain] where gain = FuMa(maxN*)/SN3D. Source: Nachbar,
// Zotter, Deleflie, Sontacchi, "AMBIX — A Suggested Ambisonics Format" (2011) eq. 3
// (N3D→SN3D and N3D→maxN* factors, ratio taken here); FuMa stream order and letter
// names (W X Y Z | R S T U V | K L M N O P Q) per Chapman, "Ambisonic channel
// sequence" (2008). Cross-checked against the independently-sourced legacy
// Furse-Malham weight table (same article) — agrees to the last digit:
//   l=1 (X,Y,Z): gain 1 — a bare permutation, no rescale.
//   l=2, m=0 (R): gain 1.  l=2, m≠0 (S,T,U,V): gain 2/√3.
//   l=3, m=0 (K): gain 1.  l=3, |m|=1 (L,M): √(45/32).  |m|=2 (N,O): 3/√5.  |m|=3 (P,Q): √(8/5).
const SQRT1_2 = 1 / Math.SQRT2
const FUMA_ACN = [
	[0, 0, SQRT1_2],                  // W  l0 m0  (-3 dB legacy B-Format correction)
	[1, 3, 1],                        // X  l1 m1
	[2, 1, 1],                        // Y  l1 m-1
	[3, 2, 1],                        // Z  l1 m0
	[4, 6, 1],                        // R  l2 m0
	[5, 7, 2 / sqrt(3)],              // S  l2 m1
	[6, 5, 2 / sqrt(3)],              // T  l2 m-1
	[7, 8, 2 / sqrt(3)],              // U  l2 m2
	[8, 4, 2 / sqrt(3)],              // V  l2 m-2
	[9, 12, 1],                       // K  l3 m0
	[10, 13, sqrt(45 / 32)],          // L  l3 m1
	[11, 11, sqrt(45 / 32)],          // M  l3 m-1
	[12, 14, 3 / sqrt(5)],            // N  l3 m2
	[13, 10, 3 / sqrt(5)],            // O  l3 m-2
	[14, 15, sqrt(8 / 5)],            // P  l3 m3
	[15, 9, sqrt(8 / 5)],             // Q  l3 m-3
]

function scaleChannel (ch, g) { let o = new Float32Array(ch.length); for (let i = 0; i < ch.length; i++) o[i] = ch[i] * g; return o }
function assertOrderCount (n, who) { if (![1, 4, 9, 16].includes(n)) throw new Error(`${who}: channel count must be 1, 4, 9 or 16 (order 0-3), got ${n}`) }

/** FuMa (WXYZ.../maxN) → ACN/SN3D (AmbiX). Reorders + rescales; see FUMA_ACN above.
 * gain there is FuMa/SN3D, so this direction divides by it (SN3D = FuMa / gain). */
export function fumaToAmbix (channels) {
	assertOrderCount(channels.length, 'fumaToAmbix')
	let out = new Array(channels.length)
	for (let [fi, ai, g] of FUMA_ACN) if (fi < channels.length) out[ai] = scaleChannel(channels[fi], 1 / g)
	return out
}
/** ACN/SN3D (AmbiX) → FuMa (WXYZ.../maxN). Inverse of fumaToAmbix (FuMa = SN3D · gain). */
export function ambixToFuma (channels) {
	assertOrderCount(channels.length, 'ambixToFuma')
	let out = new Array(channels.length)
	for (let [fi, ai, g] of FUMA_ACN) if (ai < channels.length) out[fi] = scaleChannel(channels[ai], g)
	return out
}

/** N3D → SN3D: per-channel factor 1/√(2l+1) (Daniel 2001, eq. 3.9). */
export function n3dToSn3d (channels) { return channels.map((ch, i) => scaleChannel(ch, 1 / sqrt(2 * acnDegree(i) + 1))) }
/** SN3D → N3D: per-channel factor √(2l+1) (Daniel 2001, eq. 3.9). */
export function sn3dToN3d (channels) { return channels.map((ch, i) => scaleChannel(ch, sqrt(2 * acnDegree(i) + 1))) }

// ───────────────────────────── direction (DirAC-style analysis) ─────────────────────────────

// Active-intensity direction/diffuseness from first-order B-format, per Merimaa &
// Pulkki (2005): I = ⟨W·[X,Y,Z]⟩ (frame-averaged), E = ⟨(W²+X²+Y²+Z²)/2⟩,
// diffuseness ψ = 1 - |I|/E. For a single SN3D-encoded plane wave, X²+Y²+Z² = W²
// exactly (the unit-vector identity behind the SH triple), so |I| = E and ψ = 0;
// incoherent/multi-source content partially cancels in I while E stays additive,
// pushing ψ → 1.
function analyzeFrame (W, X, Y, Z, start, len) {
	let ix = 0, iy = 0, iz = 0, e = 0
	for (let i = start; i < start + len; i++) {
		let w = W[i], x = X[i], y = Y[i], z = Z[i]
		ix += w * x; iy += w * y; iz += w * z
		e += (w * w + x * x + y * y + z * z) * 0.5
	}
	ix /= len; iy /= len; iz /= len; e /= len
	let imag = sqrt(ix * ix + iy * iy + iz * iz)
	let az = atan2(iy, ix) * RAD
	let el = imag > 1e-12 ? asin(mmax(-1, mmin(1, iz / imag))) * RAD : 0
	let diffuseness = e > 1e-12 ? mmax(0, mmin(1, 1 - imag / e)) : 0
	return { az, el, diffuseness }
}

/**
 * DirAC-style direction-of-arrival + diffuseness from first-order B-format.
 * @param {Float32Array[]} channels at least [W,Y,Z,X] (ACN 0-3)
 * @param {{fs?:number, frame?:number}} [opts]
 */
export function direction (channels, opts = {}) {
	if (channels.length < 4) throw new Error('ambisonic.direction: needs first-order channels (≥4: W,Y,Z,X)')
	let fs = opts.fs ?? 44100, frame = opts.frame ?? 1024
	let [W, Y, Z, X] = channels
	let n = W.length
	let g = analyzeFrame(W, X, Y, Z, 0, n)
	let frames = []
	for (let start = 0; start < n; start += frame) {
		let len = mmin(frame, n - start)
		let f = analyzeFrame(W, X, Y, Z, start, len)
		frames.push({ t: start / fs, az: f.az, el: f.el, diff: f.diffuseness })
	}
	return { az: g.az, el: g.el, diffuseness: g.diffuseness, frames }
}

export default { encode, decode, rotate, sh, decoderMatrix, rotationMatrix, fumaToAmbix, ambixToFuma, n3dToSn3d, sn3dToN3d, direction }
