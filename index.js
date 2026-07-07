// @audio/spatial — spatial & channel tools umbrella re-exporting every @audio/spatial-* atom.
// For smaller bundles, depend directly on the individual atom.

export { default as panner } from '@audio/spatial-panner'
export { default as stereoWidener } from '@audio/spatial-widener'
export { default as haas } from '@audio/spatial-haas'
export { default as autoPanner } from '@audio/spatial-autopan'
export { default as crossfeed } from '@audio/spatial-crossfeed'
