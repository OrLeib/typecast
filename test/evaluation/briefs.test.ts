import { describe, expect, it } from "vitest";
import { parseBriefs } from "../../src/evaluation/briefs.ts";

describe("parseBriefs", () => {
  it("parses rows, skips blank lines and keeps an optional note", () => {
    const jsonl = '{"id":"a","brief":"A cat","expected":"photoreal"}\n\n{"id":"b","brief":"A logo","expected":"typography","note":"why"}\n';
    expect(parseBriefs(jsonl, "d.jsonl")).toEqual([
      { id: "a", brief: "A cat", expected: "photoreal" },
      { id: "b", brief: "A logo", expected: "typography", note: "why" },
    ]);
  });

  it.each([
    ["invalid JSON", "{nope", /d\.jsonl:2: not valid JSON/],
    ["a non-object row", "[1]", /d\.jsonl:2: must be a JSON object/],
    ["a missing label", '{"id":"x","brief":"b"}', /d\.jsonl:2: expected must be a non-empty string/],
    ["an empty brief", '{"id":"x","brief":" ","expected":"video"}', /d\.jsonl:2: brief must be a non-empty string/],
    ["an empty note", '{"id":"x","brief":"b","expected":"video","note":""}', /d\.jsonl:2: note must be a non-empty string/],
    ["an unknown field", '{"id":"x","brief":"b","expected":"video","label":"y"}', /d\.jsonl:2: unknown field\(s\) label/],
  ])("rejects %s, naming the line and field", (_name, row, message) => {
    const first = '{"id":"ok","brief":"fine","expected":"video"}';
    expect(() => parseBriefs(`${first}\n${row}`, "d.jsonl")).toThrow(message);
  });
});
