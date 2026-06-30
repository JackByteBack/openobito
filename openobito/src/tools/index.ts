import { ToolRegistry } from "./registry.js";
import { readFileTool, writeFileTool, listDirectoryTool } from "./builtin/file.js";
import { shellExecTool } from "./builtin/shell.js";
import { fetchUrlTool } from "./builtin/web.js";

export { ToolRegistry } from "./registry.js";
export type { RegisteredTool, ToolHandler } from "./registry.js";

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(listDirectoryTool);
  registry.register(shellExecTool);
  registry.register(fetchUrlTool);
  return registry;
}
