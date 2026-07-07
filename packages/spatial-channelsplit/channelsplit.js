// Channel split/combine — planes ↔ channel array (FFmpeg channelsplit class).

export function split (channels) {
	return channels.map(ch => Float32Array.from(ch))
}

export function combine (planes) {
	return planes
}

export default split
