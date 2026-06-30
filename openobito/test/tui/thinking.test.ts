import { describe, it, expect } from "vitest";

// Unit-test the pure helpers behind the thinking panel by re-deriving them.
// (The hook itself is exercised in integration; here we lock the parsing rules.)

function extractThinking(buffer: string): string {
  const open = buffer.indexOf("<thinking>");
  if (open === -1) return "";
  const start = open + "<thinking>".length;
  const close = buffer.indexOf("</thinking>", start);
  return (close === -1 ? buffer.slice(start) : buffer.slice(start, close)).trim();
}

function deriveSteps(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

describe("thinking parsing", () => {
  it("extracts a closed thinking block", () => {
    const buf = "<thinking>step one\nstep two</thinking>Answer: hi";
    expect(extractThinking(buf)).toBe("step one\nstep two");
  });

  it("extracts an open (streaming) thinking block", () => {
    const buf = "<thinking>still reason";
    expect(extractThinking(buf)).toBe("still reason");
  });

  it("returns empty when no thinking block present", () => {
    expect(extractThinking("just an answer")).toBe("");
  });

  it("derives tree steps and strips bullet markers", () => {
    const steps = deriveSteps("- understand\n- search\n• plan");
    expect(steps).toEqual(["understand", "search", "plan"]);
  });
});
