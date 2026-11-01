// Local image generation on Apple Silicon through the mflux CLI (https://github.com/mflux-community/mflux).
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import type { GenerationProgress, Generator } from "./generator.ts";

/**
 * An mflux model: the suffix of its `mflux-generate-<command>` CLI, the weight quantization to load, and a guidance
 * scale for models whose CLI default doesn't match their authors' recommendation.
 */
export type MfluxModel = { command: string; quantize: 3 | 4 | 5 | 6 | 8; guidance?: number };

/** Every generator renders the same square size, so a judge compares content, not framing. */
export const IMAGE_SIZE = 1024;
/** Enough of mflux's stderr to show why it failed without its progress bars. */
const STDERR_TAIL_CHARS = 2000;

export type CommandResult = { exitCode: number; stderr: string };
export type RunCommand = (command: string, args: string[], onStderr?: (chunk: string) => void) => Promise<CommandResult>;

export type MfluxDeps = { run?: RunCommand; now?: () => number; fileExists?: (path: string) => Promise<boolean> };

/** Steps (and guidance, unless the model sets it) are left to each mflux tool's defaults. */
export function createMfluxGenerator(model: MfluxModel, deps: MfluxDeps = {}): Generator {
  const run = deps.run ?? runCommand;
  const now = deps.now ?? (() => performance.now());
  const fileExists = deps.fileExists ?? exists;
  const command = `mflux-generate-${model.command}`;

  return {
    // Guidance changes the image, so it is part of the name recorded with every render and used in cache keys.
    name: `mflux:${model.command}@q${model.quantize}${model.guidance === undefined ? "" : `+g${model.guidance}`}`,
    async generate({ prompt, seed, outputPath }, onProgress) {
      const args = [
        "--prompt", prompt,
        "--seed", String(seed),
        "--width", String(IMAGE_SIZE),
        "--height", String(IMAGE_SIZE),
        "--quantize", String(model.quantize),
        "--output", outputPath,
        ...(model.guidance === undefined ? [] : ["--guidance", String(model.guidance)]),
      ];
      const started = now();
      const { exitCode, stderr } = await run(command, args, onProgress && createStepProgressReader(onProgress));
      const latencyMs = now() - started;
      if (exitCode !== 0) throw new Error(`${command} exited with ${exitCode}: ${stderr.slice(-STDERR_TAIL_CHARS)}`);
      if (!(await fileExists(outputPath))) throw new Error(`${command} exited cleanly but wrote no image at ${outputPath}`);
      return { path: outputPath, latencyMs };
    },
  };
}

/**
 * mflux draws its denoising loop as a plain tqdm bar on stderr ("  40%|████      | 2/5 [00:03<00:04, 1.6s/it]"),
 * redrawn in place with carriage returns. Other bars (downloads, weight loading) carry a description before the
 * percentage, so anchoring on the line start picks the denoising bar alone.
 */
const STEP_BAR = /^\s*\d+%\|[^|]*\|\s*(\d+)\/(\d+)/;

/** Feeds stderr chunks in; calls `onProgress` each time the denoising bar reaches a new step. */
export function createStepProgressReader(onProgress: (progress: GenerationProgress) => void): (chunk: string) => void {
  let pending = "";
  let lastStep = -1;
  return (chunk) => {
    const lines = (pending + chunk).split(/[\r\n]/);
    // The last piece may be a bar still being written; finish it with the next chunk.
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const match = STEP_BAR.exec(line);
      if (!match) continue;
      const step = Number(match[1]);
      if (step === lastStep) continue;
      lastStep = step;
      onProgress({ step, total: Number(match[2]) });
    }
  };
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

/** Runs a command, discarding stdout, passing stderr to `onStderr` as it arrives, and keeping its tail for error messages. */
function runCommand(command: string, args: string[], onStderr?: (chunk: string) => void): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      onStderr?.(chunk);
      stderr = (stderr + chunk).slice(-STDERR_TAIL_CHARS);
    });
    child.on("error", (e: NodeJS.ErrnoException) =>
      reject(e.code === "ENOENT" ? new Error(`${command} not found on PATH. Install mflux with: uv tool install mflux`) : e));
    child.on("close", (code) => resolve({ exitCode: code ?? 1, stderr }));
  });
}
