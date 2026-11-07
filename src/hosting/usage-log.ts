// One entry per call to a live endpoint: who asked (as far as the platform's headers tell), what, and what Jev billed.
// The hosted site has no accounts, so this is the only record of who spends the Jev key.
import type { IncomingMessage } from "node:http";
import { isIPv4, isIPv6 } from "node:net";

export type Visitor = {
  /** The address with its host part dropped: enough to tell visitors apart, not enough to name a household. */
  ipPrefix?: string;
  country?: string;
  region?: string;
  city?: string;
  userAgent?: string;
  referer?: string;
};

export type UsageEntry = {
  endpoint: string;
  status: number;
  latencyMs: number;
  /** The text fields of the request; an uploaded image is only ever "upload". */
  input: Record<string, string>;
  cached?: boolean;
  model?: string;
  billedInputTokens: number;
  costUsd: number;
  error?: string;
  visitor: Visitor;
};

export type UsageLog = (entry: UsageEntry) => void;

/** What a live endpoint answers with that says what the call cost. */
export type Billed = { cached: boolean; model: string; inputTokens: number; costUsd: number };

const LOGGED_FIELDS = ["brief", "sample", "target"] as const;
const MAX_LOGGED_CHARS = 300;
const IPV4_KEPT_OCTETS = 3;
const IPV6_KEPT_GROUPS = 3;
const IPV6_GROUPS = 8;

export function inputOf(body: Record<string, unknown>): Record<string, string> {
  const input: Record<string, string> = {};
  for (const field of LOGGED_FIELDS) if (typeof body[field] === "string") input[field] = body[field].slice(0, MAX_LOGGED_CHARS);
  if (body.image !== undefined) input.image = "upload";
  return input;
}

export const billingOf = (result: Billed) => ({
  cached: result.cached,
  model: result.model,
  billedInputTokens: result.cached ? 0 : result.inputTokens,
  costUsd: result.costUsd,
});

/** The visitor as Vercel's request headers describe them; a plain Node server sends none of these but the last two. */
export function visitorOf(req: IncomingMessage): Visitor {
  const header = (name: string) => {
    const value = req.headers[name];
    return typeof value === "string" && value ? value : undefined;
  };
  const city = header("x-vercel-ip-city");
  return {
    ipPrefix: ipPrefixOf(header("x-forwarded-for")?.split(",")[0].trim()),
    country: header("x-vercel-ip-country"),
    region: header("x-vercel-ip-country-region"),
    city: city && decodeURIComponent(city),
    userAgent: header("user-agent"),
    referer: header("referer"),
  };
}

export function ipPrefixOf(ip: string | undefined): string | undefined {
  if (ip && isIPv4(ip)) return `${ip.split(".").slice(0, IPV4_KEPT_OCTETS).join(".")}.0/24`;
  if (ip && isIPv6(ip)) return `${ipv6Groups(ip).slice(0, IPV6_KEPT_GROUPS).join(":")}::/48`;
  return undefined;
}

/** The eight groups of an IPv6 address, with `::` expanded and leading zeros dropped. */
function ipv6Groups(ip: string): string[] {
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const zeros = tail === undefined ? [] : Array<string>(IPV6_GROUPS - left.length - right.length).fill("0");
  return [...left, ...zeros, ...right].map((group) => parseInt(group, 16).toString(16));
}
