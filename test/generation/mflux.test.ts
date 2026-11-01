import { describe, expect, it } from "vitest";
import type { GenerationProgress } from "../../src/generation/generator.ts";
import { createMfluxGenerator, createStepProgressReader, type RunCommand } from "../../src/generation/mflux.ts";

const model = { command: "z-image-turbo", quantize: 8 } as const;
const clock = (...times: number[]) => () => times.shift() ?? 0;

describe("createMfluxGenerator", () => {
  it("runs the model's CLI at a fixed square size and reports how long it took", async () => {
    const calls: [string, string[]][] = [];
    const run: RunCommand = async (command, args) => (calls.push([command, args]), { exitCode: 0, stderr: "" });
    const generator = createMfluxGenerator(model, { run, now: clock(100, 4100), fileExists: async () => true });

    const result = await generator.generate({ prompt: "a red apple", seed: 7, outputPath: "out/a.png" });

    expect(generator.name).toBe("mflux:z-image-turbo@q8");
    expect(calls).toEqual([["mflux-generate-z-image-turbo", ["--prompt", "a red apple", "--seed", "7", "--width", "1024", "--height", "1024", "--quantize", "8", "--output", "out/a.png"]]]);
    expect(result).toEqual({ path: "out/a.png", latencyMs: 4000 });
  });

  it("passes a model's guidance and records it in the name", async () => {
    const calls: string[][] = [];
    const run: RunCommand = async (_command, args) => (calls.push(args), { exitCode: 0, stderr: "" });
    const generator = createMfluxGenerator({ command: "z-image", quantize: 8, guidance: 4 }, { run, fileExists: async () => true });

    await generator.generate({ prompt: "x", seed: 1, outputPath: "a.png" });

    expect(generator.name).toBe("mflux:z-image@q8+g4");
    expect(calls[0].slice(-2)).toEqual(["--guidance", "4"]);
  });

  it("fails with the end of stderr when the CLI exits non-zero", async () => {
    const run: RunCommand = async () => ({ exitCode: 1, stderr: "Traceback...\nOut of memory" });
    const generator = createMfluxGenerator(model, { run, fileExists: async () => true });
    await expect(generator.generate({ prompt: "x", seed: 1, outputPath: "a.png" })).rejects.toThrow(/exited with 1: Traceback...\nOut of memory/);
  });

  it("fails when the CLI exits cleanly without writing the image", async () => {
    const run: RunCommand = async () => ({ exitCode: 0, stderr: "" });
    const generator = createMfluxGenerator(model, { run, fileExists: async () => false });
    await expect(generator.generate({ prompt: "x", seed: 1, outputPath: "a.png" })).rejects.toThrow(/wrote no image at a.png/);
  });
});

describe("mflux step progress", () => {
  it("reports denoising steps from stderr as the generator runs", async () => {
    const run: RunCommand = async (_command, _args, onStderr) => {
      onStderr?.("  0%|          | 0/4 [00:00<?, ?it/s]\r 50%|█████     | 2/4 [00:02<00:02, 1.0s/it]");
      onStderr?.("\r100%|██████████| 4/4 [00:04<00:00, 1.0s/it]\n");
      return { exitCode: 0, stderr: "" };
    };
    const progress: GenerationProgress[] = [];
    await createMfluxGenerator(model, { run, fileExists: async () => true }).generate({ prompt: "x", seed: 1, outputPath: "a.png" }, (p) => progress.push(p));
    expect(progress).toEqual([{ step: 0, total: 4 }, { step: 2, total: 4 }, { step: 4, total: 4 }]);
  });

  it("joins a bar split across chunks and reports each step once", () => {
    const progress: GenerationProgress[] = [];
    const read = createStepProgressReader((p) => progress.push(p));
    read(" 2");
    read("5%|██▌       | 2/8 [00:01<00:03, 2.0it/s]\r 25%|██▌       | 2/8 [00:01<00:03, 2.1it/s]\r");
    expect(progress).toEqual([{ step: 2, total: 8 }]);
  });

  it("ignores bars with a description, such as downloads and weight loading", () => {
    const progress: GenerationProgress[] = [];
    const read = createStepProgressReader((p) => progress.push(p));
    read("Fetching 17 files:  50%|█████     | 8/17 [00:10<00:11]\rLoading checkpoint shards: 100%|██████████| 3/3 [00:01<00:00]\n");
    expect(progress).toEqual([]);
  });
});
