// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'binaural' */
export interface BinauralOptions {
  /** -180..180 deg (default 0) */
  "azimuth"?: Auto
  /** 0..10 m (default 1) */
  "distance"?: Auto
  /** 0.05..0.12 m (default 0.0875) */
  "headRadius"?: Auto
  /** 0..1 (default 1) */
  "mix"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const binaural: {
  (ctx: Ctx): Process
  channels: 2
  params: {
    /** -180..180 deg (default 0) */
    "azimuth": { type: "number", default: 0 }
    /** 0..10 m (default 1) */
    "distance": { type: "number", default: 1 }
    /** 0.05..0.12 m (default 0.0875) [restart] */
    "headRadius": { type: "number", default: 0.0875 }
    /** 0..1 (default 1) */
    "mix": { type: "number", default: 1 }
  }
}
