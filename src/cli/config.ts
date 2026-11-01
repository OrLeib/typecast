// The only place that reads the process environment. Everything below the CLIs receives config.
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import { createJevClient, JEV_DEFAULT_BASE_URL, JEV_DEFAULT_MODEL, type DecisionClient, type JevConfig } from "../jev/client.ts";
import { withRetries } from "../jev/retry.ts";

export function jevConfigFromEnv(env: NodeJS.ProcessEnv = process.env): JevConfig {
  const apiKey = env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set (see .env.example)");
  return {
    apiKey,
    baseUrl: env.TYPESAFE_BASE_URL ?? JEV_DEFAULT_BASE_URL,
    model: env.JEV_MODEL ?? JEV_DEFAULT_MODEL,
    onRawResponse: isOn(env.DEBUG_JEV) ? (raw) => console.error(JSON.stringify(raw, null, 2)) : undefined,
  };
}

/** A flag is on only when set to 1 or true, so DEBUG_JEV=0 means off. */
const isOn = (flag: string | undefined) => flag === "1" || flag?.toLowerCase() === "true";

/** Short commit hash, suffixed "-dirty" when the work tree has changes, so runs record what produced them. */
export function currentCommit(): string {
  try {
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    return execSync("git status --porcelain", { encoding: "utf8" }).trim() ? `${hash}-dirty` : hash;
  } catch {
    return "unknown";
  }
}

/** Image requests have hit brief 503 "Image processing is unavailable" answers that cleared on retry. */
const IMAGE_RETRIES = { attempts: 5, delayMs: 5000 };

/** A Jev client for judging images, retrying through brief outages. */
export const jevImageClientFromEnv = (): DecisionClient => withRetries(createJevClient(jevConfigFromEnv()), IMAGE_RETRIES);

/** The run directory a CLI was given as its only positional argument; exits with `usage` when there is none. */
export function runDirArg(usage: string): string {
  const { positionals } = parseArgs({ allowPositionals: true });
  if (!positionals[0]) {
    console.error(`Usage: ${usage}`);
    process.exit(1);
  }
  return positionals[0];
}
