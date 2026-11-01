import type { GenerationProgress, GenerationRequest, Generator } from "../../src/generation/generator.ts";

/** In-memory Generator: records requests, reports `steps` progress, and pretends each took `latencyMs`. Writes no file. */
export function createFakeGenerator(name: string, latencyMs = 1000, steps = 0): Generator & { requests: GenerationRequest[] } {
  const requests: GenerationRequest[] = [];
  return {
    name,
    requests,
    async generate(request, onProgress?: (progress: GenerationProgress) => void) {
      requests.push(request);
      for (let step = 1; step <= steps; step++) onProgress?.({ step, total: steps });
      return { path: request.outputPath, latencyMs };
    },
  };
}
