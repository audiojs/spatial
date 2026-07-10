// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'surround' */
export interface SurroundOptions {
  /** 1..50 ms (default 12) */
  "delay"?: Auto
  /** 40..300 Hz (default 120) */
  "lfeCut"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const surround: {
  (ctx: Ctx): Process
  channels: {"inputs":2,"outputs":6}
  streaming: false
  params: {
    /** 1..50 ms (default 12) */
    "delay": { type: "number", default: 12 }
    /** 40..300 Hz (default 120) */
    "lfeCut": { type: "number", default: 120 }
  }
}
