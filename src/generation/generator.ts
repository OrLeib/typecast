/** One image to make: the prompt, a seed so runs are reproducible, and where to write the file. */
export type GenerationRequest = { prompt: string; seed: number; outputPath: string };

export type Generation = { path: string; latencyMs: number };

/** How far the sampler has got: `step` of `total` denoising steps done. */
export type GenerationProgress = { step: number; total: number };

/** Anything that turns a prompt into an image file: a local mflux model, a hosted API, or a test fake. */
export interface Generator {
  /** Stable name recorded with every image, e.g. "mflux:qwen-2.1@q8". */
  readonly name: string;
  /** `onProgress` is called as steps complete, if the generator can tell; it may never be called. */
  generate(request: GenerationRequest, onProgress?: (progress: GenerationProgress) => void): Promise<Generation>;
}
