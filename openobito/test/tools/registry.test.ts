import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { RegisteredTool } from "../../src/tools/registry.js";

const echoTool: RegisteredTool = {
  schema: {
    name: "echo",
    description: "Echoes input back",
    parameters: { text: { type: "string", description: "Text to echo", required: true } },
  },
  async handler({ text }) {
    return String(text);
  },
};

const failTool: RegisteredTool = {
  schema: { name: "fail", description: "Always fails", parameters: {} },
  async handler() {
    throw new Error("intentional failure");
  },
};

describe("ToolRegistry", () => {
  it("registers and retrieves tools", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    expect(reg.has("echo")).toBe(true);
    expect(reg.get("echo")?.schema.name).toBe("echo");
  });

  it("unregisters tools", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    reg.unregister("echo");
    expect(reg.has("echo")).toBe(false);
  });

  it("executes a tool and returns result", async () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    const result = await reg.execute({ id: "1", name: "echo", arguments: { text: "hello" } });
    expect(result.isError).toBe(false);
    expect(result.content).toBe("hello");
  });

  it("returns error result for unknown tool", async () => {
    const reg = new ToolRegistry();
    const result = await reg.execute({ id: "2", name: "nope", arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/Unknown tool/);
  });

  it("returns error result when handler throws", async () => {
    const reg = new ToolRegistry();
    reg.register(failTool);
    const result = await reg.execute({ id: "3", name: "fail", arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/intentional failure/);
  });

  it("lists all schemas", () => {
    const reg = new ToolRegistry();
    reg.register(echoTool);
    reg.register(failTool);
    const schemas = reg.schemas();
    expect(schemas).toHaveLength(2);
    expect(schemas.map((s) => s.name)).toContain("echo");
  });
});
