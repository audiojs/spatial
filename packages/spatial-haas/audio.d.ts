// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'haas' */
export interface HaasOptions {
  /** 1..35 ms (default 20) */
  "time"?: Auto
  /** default "right" */
  "channel"?: "left" | "right"
  at?: number | string
  duration?: number | string
}

export declare const haas: {
  (ctx: Ctx): Process
  channels: 2
  tail: (ctx: { sampleRate: number, params: Live }) => number
  params: {
    /** 1..35 ms (default 20) [restart] */
    "time": { type: "number", default: 20 }
    /** default "right" [restart] */
    "channel": { type: "enum", values: ["left","right"], default: "right" }
  }
}
