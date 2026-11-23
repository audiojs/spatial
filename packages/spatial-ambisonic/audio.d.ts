// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/plugin. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Transport = Readonly<{ playing: boolean, bpm: number, beat: number, barStart: number, timeSig: [number, number] }>
/** What a host hands a processor it builds: the contract's Context (CONTRACT.d.ts, 1.0) */
type Ctx = { readonly sampleRate: number, readonly maxBlockSize: number, readonly maxChannels: number, readonly layouts?: { readonly inputs: readonly (string | undefined)[], readonly outputs: readonly (string | undefined)[] }, readonly params: Live, readonly buffers: Readonly<Record<string, Float32Array[] | undefined>>, readonly events?: readonly { time: number, kind: 'on' | 'off', midi: number, velocity: number, id: number }[], emit(name: string, value: number): void, readonly transport: Transport }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'ambisonicDecoder' */
export interface AmbisonicDecoderOptions {
  /** default "maxre" */
  "weighting"?: "basic" | "maxre" | "inphase"
  /** default "sampling" */
  "method"?: "sampling" | "basic"
  at?: number | string
  duration?: number | string
}

export declare const ambisonicDecoder: {
  (ctx: Ctx): Process
  channels: {"inputs":[{"layouts":["ambisonic-1","ambisonic-2","ambisonic-3"]}],"outputs":[{"layouts":["stereo","quad","5.1","7.1"]}]}
  params: {
    /** default "maxre" */
    "weighting": { type: "enum", values: ["basic","maxre","inphase"], default: "maxre" }
    /** default "sampling" */
    "method": { type: "enum", values: ["sampling","basic"], default: "sampling" }
  }
}

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
  channels: {"inputs":1,"outputs":[{"layouts":["ambisonic-1","ambisonic-2","ambisonic-3"]}]}
  params: {
    /** -180..180 deg (default 0) */
    "az": { type: "number", min: -180, max: 180, default: 0, unit: "deg", smoothing: 0.01 }
    /** -90..90 deg (default 0) */
    "el": { type: "number", min: -90, max: 90, default: 0, unit: "deg", smoothing: 0.01 }
    /** 0..4 (default 1) */
    "gain": { type: "number", min: 0, max: 4, default: 1, smoothing: 0.01 }
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
  channels: {"inputs":[{"layouts":["ambisonic-1","ambisonic-2","ambisonic-3"]}],"outputs":[{"layouts":["ambisonic-1","ambisonic-2","ambisonic-3"]}]}
  params: {
    /** -180..180 deg (default 0) */
    "yaw": { type: "number", min: -180, max: 180, default: 0, unit: "deg", smoothing: 0.01 }
    /** -90..90 deg (default 0) */
    "pitch": { type: "number", min: -90, max: 90, default: 0, unit: "deg", smoothing: 0.01 }
    /** -180..180 deg (default 0) */
    "roll": { type: "number", min: -180, max: 180, default: 0, unit: "deg", smoothing: 0.01 }
  }
}
