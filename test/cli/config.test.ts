import { describe, expect, it } from "vitest";
import { jevConfigFromEnv } from "../../src/cli/config.ts";

describe("jevConfigFromEnv", () => {
  const env = (debug?: string) => ({ TYPESAFE_API_KEY: "k", ...(debug === undefined ? {} : { DEBUG_JEV: debug }) });

  it("logs raw responses only when DEBUG_JEV is 1 or true", () => {
    for (const on of ["1", "true", "TRUE"]) expect(jevConfigFromEnv(env(on)).onRawResponse, on).toBeTypeOf("function");
    for (const off of [undefined, "", "0", "false"]) expect(jevConfigFromEnv(env(off)).onRawResponse, String(off)).toBeUndefined();
  });

  it("requires an API key", () => {
    expect(() => jevConfigFromEnv({})).toThrow(/TYPESAFE_API_KEY is not set/);
  });
});
