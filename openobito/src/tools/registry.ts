import type { ToolSchema, ToolCall, ToolResult } from "../types/index.js";

// ─── Tool registry ────────────────────────────────────────────────────────────

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface RegisteredTool {
  schema: ToolSchema;
  handler: ToolHandler;
  pluginId?: string;
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  register(tool: RegisteredTool): void {
    this.tools.set(tool.schema.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  schemas(): ToolSchema[] {
    return this.list().map((t) => t.schema);
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        toolCallId: call.id,
        content: `Unknown tool: ${call.name}`,
        isError: true,
      };
    }

    try {
      const result = await tool.handler(call.arguments);
      return { toolCallId: call.id, content: result, isError: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCallId: call.id, content: `Tool error: ${msg}`, isError: true };
    }
  }
}
