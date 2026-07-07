// Per-channel delay (FFmpeg adelay class) — integer-sample shifts, zero-filled.

/**
 * @param {Float32Array[]} channels — modified in place
 * @param {object} opts — { delays: number[] (ms per channel), fs=44100, samples: number[] (overrides ms) }
 */
export default function delay (channels, { delays = [], fs = 44100, samples } = {}) {
	for (let c = 0; c < channels.length; c++) {
		let d = samples ? (samples[c] | 0) : Math.round((delays[c] || 0) * fs / 1000)
		if (!d) continue
		let ch = channels[c]
		if (d > 0) {
			ch.copyWithin(d, 0, ch.length - d)
			ch.fill(0, 0, d)
		} else {
			ch.copyWithin(0, -d)
			ch.fill(0, ch.length + d)
		}
	}
	return channels
}
