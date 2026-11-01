import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createJevClient, type JevConfig } from "../../src/jev/client.ts";
import { createFakeDecisionClient } from "../support/fake-decision-client.ts";
import { decisionClientContract } from "./decision-client.contract.ts";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/jev-choice-response.json", import.meta.url), "utf8"));
const config: JevConfig = { apiKey: "test-key", baseUrl: "http://jev.test/", model: "jev-latest" };
const respondWith = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

decisionClientContract("Jev HTTP client (recorded response)", () => createJevClient(config, { fetch: respondWith(fixture) }));
decisionClientContract("fake decision client", () => createFakeDecisionClient(() => ({ choice: "product", confidence: 0.9 })));

describe("createJevClient", () => {
  it("posts the model, state and questions to /v1/systemone with a bearer token", async () => {
    const fetch = respondWith(fixture);
    const questions = { model: { type: "choice" as const, instructions: "Pick one", criteria: { product: "Packshots" } } };
    await createJevClient(config, { fetch }).decide("a brief", questions);

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://jev.test/v1/systemone");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body as string)).toEqual({ model: "jev-latest", state: "a brief", questions });
  });

  it("sends images as assets, opting in with the images header only when there are any", async () => {
    const fetch = respondWith(fixture);
    const client = createJevClient(config, { fetch });
    const assets = { "ref-1": { type: "image" as const, format: "png" as const, data_base64: "iVBO" } };
    await client.decide({ photo: "ref-1" }, {}, assets);
    await client.decide("no images", {}, {});

    const [withImages, without] = fetch.mock.calls as unknown as [string, RequestInit][];
    expect((withImages[1].headers as Record<string, string>)["TypeSafe-Danger-Zone-Images"]).toBe("true");
    expect(JSON.parse(withImages[1].body as string).assets).toEqual(assets);
    expect(without[1].headers).not.toHaveProperty("TypeSafe-Danger-Zone-Images");
    expect(JSON.parse(without[1].body as string)).not.toHaveProperty("assets");
  });

  it("measures latency with the injected clock", async () => {
    const ticks = [100, 350];
    const result = await createJevClient(config, { fetch: respondWith(fixture), now: () => ticks.shift()! }).decide("x", {});
    expect(result.latencyMs).toBe(250);
  });

  it("counts reading the response body in latency", async () => {
    let clock = 0;
    const slowBody = vi.fn(async () => {
      clock += 100;
      const res = new Response(JSON.stringify(fixture));
      const json = res.json.bind(res);
      return Object.assign(res, { json: async () => ((clock += 400), json()) });
    });
    const result = await createJevClient(config, { fetch: slowBody, now: () => clock }).decide("x", {});
    expect(result.latencyMs).toBe(500);
  });

  it("hands every raw body to onRawResponse", async () => {
    const onRawResponse = vi.fn();
    await createJevClient({ ...config, onRawResponse }, { fetch: respondWith(fixture) }).decide("x", {});
    expect(onRawResponse).toHaveBeenCalledWith(fixture);
  });

  it("surfaces HTTP errors with the body", async () => {
    const client = createJevClient(config, { fetch: respondWith({ error: "bad request" }, 400) });
    await expect(client.decide("x", {})).rejects.toThrow(/Jev 400: .*bad request/);
    await expect(client.decide("x", {})).rejects.toMatchObject({ status: 400 });
  });
});
