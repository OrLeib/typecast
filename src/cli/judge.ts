import { parseArgs } from "node:util";
import { loadManifest } from "../generation/manifest.ts";
import { createJudgeServer } from "../judging/server.ts";

const { values: args, positionals } = parseArgs({ allowPositionals: true, options: { port: { type: "string", default: "4173" } } });
const [dir] = positionals;
if (!dir) {
  console.error("Usage: npm run judge -- <runs/level2/... dir> [--port 4173]");
  process.exit(1);
}

const server = createJudgeServer(dir, await loadManifest(dir));
server.listen(Number(args.port), "127.0.0.1", () => console.log(`judging ${dir} at http://localhost:${args.port}  (Ctrl+C to stop)`));
