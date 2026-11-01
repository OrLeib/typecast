import { HttpError } from "../shared/http.ts";

/** Briefs longer than this are almost certainly pasted by mistake, and Jev bills per input token. */
const MAX_BRIEF_CHARS = 2000;

export function briefFrom(body: Record<string, unknown>): string {
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  if (!brief) throw new HttpError(400, "brief must be a non-empty string");
  if (brief.length > MAX_BRIEF_CHARS) throw new HttpError(400, `brief must be at most ${MAX_BRIEF_CHARS} characters`);
  return brief;
}
