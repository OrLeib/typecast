// The only place that reads the process environment. Everything below the CLIs receives config.
import { execSync } from "node:child_process";
import { JEV_DEFAULT_BASE_URL, JEV_DEFAULT_MODEL, type JevConfig } from "../jev/client.ts";

export function jevConfigFromEnv(env: NodeJS.ProcessEnv = process.env): JevConfig {
  const apiKey = env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set (see .env.example)");
  return {
    apiKey,
    baseUrl: env.TYPESAFE_BASE_URL ?? JEV_DEFAULT_BASE_URL,
    model: env.JEV_MODEL ?? JEV_DEFAULT_MODEL,
    onRawResponse: env.DEBUG_JEV ? (raw) => console.error(JSON.stringify(raw, null, 2)) : undefined,
  };
}

/** Short commit hash, suffixed "-dirty" when the work tree has changes, so runs record what produced them. */
export function currentCommit(): string {
  try {
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    return execSync("git status --porcelain", { encoding: "utf8" }).trim() ? `${hash}-dirty` : hash;
  } catch {
    return "unknown";
  }
}
