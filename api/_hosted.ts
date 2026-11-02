// Composition root for the hosted demo's functions: reads the environment and wires the API. The underscore keeps Vercel
// from serving this file as a function of its own.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jevConfigFromEnv } from "../src/cli/config.ts";
import { createHostedApi } from "../src/hosting/api.ts";

export const hosted = createHostedApi({
  jev: jevConfigFromEnv(),
  samplesDir: join(process.cwd(), "data", "locating"),
  bakedAnswersDir: join(process.cwd(), "build", "locate-answers"),
  cacheDir: join(tmpdir(), "typecast"),
});
