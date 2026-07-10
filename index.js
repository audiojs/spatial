// @audio/spatial — spatial & channel tools umbrella re-exporting every @audio/spatial-* atom.
// For smaller bundles, depend directly on the individual atom.

export { default as panner } from '@audio/spatial-panner'
export { default as stereoWidener } from '@audio/spatial-widener'
export { default as haas } from '@audio/spatial-haas'
export { default as autoPanner } from '@audio/spatial-autopan'
export { default as crossfeed } from '@audio/spatial-crossfeed'
export { default as binaural } from '@audio/spatial-binaural'
export { encode as msEncode, decode as msDecode } from '@audio/spatial-midside'
export { split as channelSplit, combine as channelCombine } from '@audio/spatial-channelsplit'
export { default as channelDelay } from '@audio/spatial-delay'
export { default as microshift } from '@audio/spatial-microshift'
export { default as surround } from '@audio/spatial-surround'
