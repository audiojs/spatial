// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, layouts?: { inputs: string[], outputs: string[] }, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'ambisonicPanner' */
export interface AmbisonicPannerOptions {
  /** -180..180 deg (default 0) */
  "az"?: Auto
  /** -90..90 deg (default 0) */
  "el"?: Auto
  /** 0..4 (default 1) */
  "gain"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const ambisonicPanner: {
  (ctx: Ctx): Process
  channels: {"inputs":1,"outputs":["ambisonic-1","ambisonic-2","ambisonic-3"]}
  params: {
    /** -180..180 deg (default 0) */
    "az": { type: "number", default: 0 }
    /** -90..90 deg (default 0) */
    "el": { type: "number", default: 0 }
    /** 0..4 (default 1) */
    "gain": { type: "number", default: 1 }
  }
}

/** Chainable-host options for 'ambisonicDecoder' */
export interface AmbisonicDecoderOptions {
  /** 'basic' | 'maxre' | 'inphase' (default 'maxre') */
  "weighting"?: 'basic' | 'maxre' | 'inphase'
  /** 'sampling' | 'basic' (default 'sampling') */
  "method"?: 'sampling' | 'basic'
  at?: number | string
  duration?: number | string
}

export declare const ambisonicDecoder: {
  (ctx: Ctx): Process
  channels: {"inputs":["ambisonic-1","ambisonic-2","ambisonic-3"],"outputs":["stereo","quad","5.1","7.1"]}
  params: {
    "weighting": { type: "enum", values: ["basic", "maxre", "inphase"], default: "maxre" }
    "method": { type: "enum", values: ["sampling", "basic"], default: "sampling" }
  }
}

/** Chainable-host options for 'ambisonicRotate' */
export interface AmbisonicRotateOptions {
  /** -180..180 deg (default 0) */
  "yaw"?: Auto
  /** -90..90 deg (default 0) */
  "pitch"?: Auto
  /** -180..180 deg (default 0) */
  "roll"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const ambisonicRotate: {
  (ctx: Ctx): Process
  channels: {"inputs":["ambisonic-1","ambisonic-2","ambisonic-3"],"outputs":["ambisonic-1","ambisonic-2","ambisonic-3"]}
  params: {
    /** -180..180 deg (default 0) */
    "yaw": { type: "number", default: 0 }
    /** -90..90 deg (default 0) */
    "pitch": { type: "number", default: 0 }
    /** -180..180 deg (default 0) */
    "roll": { type: "number", default: 0 }
  }
}
