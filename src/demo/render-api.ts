// Rendering in the demo: stream a local render with progress, or report one already on disk.
import type { ServerResponse } from "node:http";
import { join } from "node:path";
import type { GenerationProgress, Generator } from "../generation/generator.ts";
import { fileExists } from "../shared/files.ts";
import { HttpError } from "../shared/http.ts";
import { imageFileFor, imageUrl } from "./images.ts";
import { briefFrom } from "./requests.ts";

export type RenderApiConfig = {
  /** Category -> local generator. Categories without one (e.g. video) can be routed to but not rendered. */
  generators: Record<string, Generator>;
  defaultGenerator: Generator;
  imagesDir: string;
  seed: number;
};

/** Request bodies name a routed `category`, or set `default: true` for the default model. */
export function createRenderApi({ generators, defaultGenerator, imagesDir, seed }: RenderApiConfig) {
  const renderOneAtATime = serialize();

  function generatorFrom(body: Record<string, unknown>): Generator {
    if (body.default === true) return defaultGenerator;
    const category = String(body.category ?? "");
    const generator = generators[category];
    if (!generator) throw new HttpError(400, `no local generator for "${category}"`);
    return generator;
  }

  /** Lets the page show images it already rendered as soon as a brief is routed, without a render click. */
  async function cachedImage(body: Record<string, unknown>) {
    const brief = briefFrom(body);
    const generator = generatorFrom(body);
    const file = imageFileFor(generator.name, seed, brief);
    const cached = await fileExists(join(imagesDir, file));
    return { image: cached ? imageUrl(file) : null, generator: generator.name };
  }

  /**
   * Streams the render as NDJSON events so the page can show progress: zero or more
   * `{ type: "progress", step, total }`, then `{ type: "done", image, generator, latencyMs, cached }` or `{ type: "error", error }`.
   * Bad requests fail before the stream starts, as plain JSON errors like every other route.
   */
  async function generate(body: Record<string, unknown>, res: ServerResponse) {
    const brief = briefFrom(body);
    const generator = generatorFrom(body);
    const file = imageFileFor(generator.name, seed, brief);
    const outputPath = join(imagesDir, file);
    const done = (latencyMs: number, cached: boolean) => ({ type: "done", image: imageUrl(file), generator: generator.name, latencyMs, cached });

    res.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
    const emit = (event: Record<string, unknown>) => res.write(`${JSON.stringify(event)}\n`);
    try {
      if (await fileExists(outputPath)) {
        emit(done(0, true));
      } else {
        const onProgress = (progress: GenerationProgress) => emit({ type: "progress", ...progress });
        const { latencyMs } = await renderOneAtATime(() => generator.generate({ prompt: brief, seed, outputPath }, onProgress));
        emit(done(latencyMs, false));
      }
    } catch (e) {
      emit({ type: "error", error: (e as Error).message });
    }
    res.end();
  }

  return { cachedImage, generate };
}

/** Image models fill most of unified memory, so renders run one at a time, in arrival order. */
function serialize() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}
