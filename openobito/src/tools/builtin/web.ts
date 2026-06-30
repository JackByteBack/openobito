import type { RegisteredTool } from "../registry.js";

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254."];

function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return !BLOCKED_HOSTS.some((h) => url.hostname.startsWith(h));
  } catch {
    return false;
  }
}

export const fetchUrlTool: RegisteredTool = {
  schema: {
    name: "fetch_url",
    description: "Fetch the content of a public URL (text only, no auth).",
    parameters: {
      url: { type: "string", description: "The URL to fetch", required: true },
      max_chars: {
        type: "number",
        description: "Maximum characters to return (default 8000)",
        required: false,
      },
    },
  },
  async handler({ url, max_chars = 8000 }) {
    const urlStr = String(url);
    if (!isSafeUrl(urlStr)) {
      return `Blocked: URL ${urlStr} is not allowed (localhost/non-http).`;
    }

    try {
      const res = await fetch(urlStr, {
        headers: { "User-Agent": "OpenAgent/0.1 (+https://github.com/openagent-dev/openagent)" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return `HTTP ${res.status} ${res.statusText}`;

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text")) return `Non-text content type: ${ct}`;

      const text = await res.text();
      const limit = Math.min(Number(max_chars), 32000);
      return text.length > limit ? text.slice(0, limit) + "\n[truncated]" : text;
    } catch (err) {
      return `Fetch error: ${String(err)}`;
    }
  },
};
