// atom manifest — three processors over @audio/compile CONTRACT §Buses' 'ambisonic-n'
// layout tag ((n+1)² channels, ACN/SN3D). Order is a bus-layout choice (host picks
// via ctx.layouts, resolved once at construction — "reconfigure = new instance" per
// CONTRACT), never a live param. All three precompute their small gain vector/matrix
// once — at construction, and again only when the params that drive it actually
// change — and write straight into the preallocated `out` buffers in process(); no
// per-block allocation.

import { sh, rotationMatrix, decoderMatrix } from './ambisonic.js'

function orderOf (tag) { return Number((tag || 'ambisonic-1').split('-')[1]) || 1 }

// mono → 'ambisonic-1'|'-2'|'-3'. az/el/gain live; the (order+1)² SH gain vector is
// only rebuilt when az/el actually change (matches eq-tilt's "rebuilt only when
// gain/pivot/fs change" convention).
export const ambisonicPanner = (ctx) => {
	const order = orderOf(ctx.layouts?.outputs?.[0])
	const C = (order + 1) ** 2
	let az0 = NaN, el0 = NaN, y = sh(0, 0, order)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp[0]) return
		const az = params.az[0], el = params.el[0], gain = params.gain[0]
		if (az !== az0 || el !== el0) { y = sh(az, el, order); az0 = az; el0 = el }
		const src = inp[0], n = src.length
		for (let c = 0; c < C; c++) {
			const g = y[c] * gain, dst = out[c]
			for (let i = 0; i < n; i++) dst[i] = src[i] * g
		}
	}
}
ambisonicPanner.channels = { inputs: 1, outputs: ['ambisonic-1', 'ambisonic-2', 'ambisonic-3'] }
ambisonicPanner.params = {
	az:   { type: 'number', min: -180, max: 180, default: 0, unit: 'deg', smoothing: 0.01 },
	el:   { type: 'number', min: -90, max: 90, default: 0, unit: 'deg', smoothing: 0.01 },
	gain: { type: 'number', min: 0, max: 4, default: 1, smoothing: 0.01 },
}

// 'ambisonic-n' → 'stereo'/'quad'/'5.1'/'7.1'. weighting/method are live but only
// trigger a matrix rebuild on actual change; decoderMatrix() already aligns LFE
// slots to an all-zero row, so the output-row loop needs no layout-specific case.
export const ambisonicDecoder = (ctx) => {
	const order = orderOf(ctx.layouts?.inputs?.[0])
	const outLayout = ctx.layouts?.outputs?.[0] ?? 'stereo'
	let D = null, weighting0 = null, method0 = null
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const weighting = params.weighting, method = params.method
		if (!D || weighting !== weighting0 || method !== method0) {
			D = decoderMatrix(order, outLayout, { method, weighting })
			weighting0 = weighting; method0 = method
		}
		const n = inp[0].length
		for (let s = 0; s < out.length; s++) {
			const row = D[s], dst = out[s]
			dst.fill(0)
			for (let c = 0; c < inp.length && c < row.length; c++) {
				const g = row[c]
				if (!g) continue
				const src = inp[c]
				for (let i = 0; i < n; i++) dst[i] += src[i] * g
			}
		}
	}
}
ambisonicDecoder.channels = { inputs: ['ambisonic-1', 'ambisonic-2', 'ambisonic-3'], outputs: ['stereo', 'quad', '5.1', '7.1'] }
ambisonicDecoder.params = {
	weighting: { type: 'enum', values: ['basic', 'maxre', 'inphase'], default: 'maxre' },
	method:    { type: 'enum', values: ['sampling', 'basic'], default: 'sampling' },
}

// 'ambisonic-n' → same order. yaw/pitch/roll live; the (order+1)²×(order+1)²
// rotation matrix is only rebuilt when they actually change (rebuilding it touches
// a small dense linear solve — see ambisonic.js rotationMatrix() — cheap, but not
// per-sample cheap, hence the cache).
export const ambisonicRotate = (ctx) => {
	const order = orderOf(ctx.layouts?.inputs?.[0])
	const C = (order + 1) ** 2
	let R = null, yaw0 = NaN, pitch0 = NaN, roll0 = NaN
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const yaw = params.yaw[0], pitch = params.pitch[0], roll = params.roll[0]
		if (!R || yaw !== yaw0 || pitch !== pitch0 || roll !== roll0) {
			R = rotationMatrix(order, yaw, pitch, roll)
			yaw0 = yaw; pitch0 = pitch; roll0 = roll
		}
		const n = inp[0].length
		for (let r = 0; r < C; r++) {
			const row = R[r], dst = out[r]
			dst.fill(0)
			for (let c = 0; c < C; c++) {
				const g = row[c]
				if (!g) continue
				const src = inp[c]
				for (let i = 0; i < n; i++) dst[i] += src[i] * g
			}
		}
	}
}
ambisonicRotate.channels = { inputs: ['ambisonic-1', 'ambisonic-2', 'ambisonic-3'], outputs: ['ambisonic-1', 'ambisonic-2', 'ambisonic-3'] }
ambisonicRotate.params = {
	yaw:   { type: 'number', min: -180, max: 180, default: 0, unit: 'deg', smoothing: 0.01 },
	pitch: { type: 'number', min: -90, max: 90, default: 0, unit: 'deg', smoothing: 0.01 },
	roll:  { type: 'number', min: -180, max: 180, default: 0, unit: 'deg', smoothing: 0.01 },
}
