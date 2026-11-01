import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll } from "vitest";

/** Serves `server` on a free local port for the file's tests, then closes it and runs `cleanup`. */
export function listenForTests(server: Server, { setup, cleanup }: { setup?: () => Promise<void>; cleanup?: () => Promise<void> } = {}) {
  const local = { base: "" };
  beforeAll(async () => {
    await setup?.();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    local.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.close();
    await cleanup?.();
  });
  return {
    get: (path: string) => fetch(local.base + path),
    post: (path: string, body: unknown) => fetch(local.base + path, { method: "POST", body: JSON.stringify(body) }),
  };
}
