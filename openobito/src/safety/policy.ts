// Layer 1 — Default Deny Principle + ToolPolicyEngine
// Builds immutable ToolPolicySession snapshots. Unknown tools → Deny (fail-closed).

import type {
  TaskRiskLevel,
  ToolPolicyAction,
  SecurityLevel,
  ToolPolicySession,
} from "./types.js";
import type { ToolPolicy } from "../types/index.js";

// ─── Built-in tool classifications ───────────────────────────────────────────
// Defines default action + risk level for every known tool.
// Anything NOT in this map → deny (fail-closed).

interface ToolClass {
  action: ToolPolicyAction;
  risk: TaskRiskLevel;
}

class FrozenDecisionMap<K, V> implements ReadonlyMap<K, V> {
  private readonly inner: ReadonlyMap<K, V>;

  constructor(entries: Iterable<readonly [K, V]>) {
    this.inner = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.inner.size;
  }

  get(key: K): V | undefined {
    return this.inner.get(key);
  }

  has(key: K): boolean {
    return this.inner.has(key);
  }

  forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void {
    this.inner.forEach((value, key) => callbackfn.call(thisArg, value, key, this));
  }

  entries(): IterableIterator<[K, V]> {
    return this.inner.entries();
  }

  keys(): IterableIterator<K> {
    return this.inner.keys();
  }

  values(): IterableIterator<V> {
    return this.inner.values();
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.inner[Symbol.iterator]();
  }

  get [Symbol.toStringTag](): string {
    return "FrozenDecisionMap";
  }

  set(): never {
    throw new TypeError("Tool policy decisions are immutable");
  }

  delete(): never {
    throw new TypeError("Tool policy decisions are immutable");
  }

  clear(): never {
    throw new TypeError("Tool policy decisions are immutable");
  }
}

const BUILTIN_CLASSIFICATIONS: Record<string, ToolClass> = {
  // Safe reads — auto-allow
  read_file:        { action: "allow",            risk: "low"      },
  list_directory:   { action: "allow",            risk: "low"      },
  git_status:       { action: "allow",            risk: "low"      },
  git_log:          { action: "allow",            risk: "low"      },
  git_diff:         { action: "allow",            risk: "low"      },
  git_branch:       { action: "allow",            risk: "low"      },

  // Writes — require approval
  write_file:       { action: "require_approval", risk: "medium"   },
  delete_file:      { action: "require_approval", risk: "high"     },
  git_commit:       { action: "require_approval", risk: "medium"   },
  git_checkout:     { action: "require_approval", risk: "medium"   },

  // High-risk — require approval
  shell_exec:       { action: "require_approval", risk: "high"     },
  git_push:         { action: "require_approval", risk: "high"     },
  git_pull:         { action: "require_approval", risk: "medium"   },
  web_fetch:        { action: "require_approval", risk: "medium"   },
  run_script:       { action: "require_approval", risk: "high"     },

  // Permanently dangerous — deny (regardless of config)
  format_disk:      { action: "deny",             risk: "critical" },
  wipe_filesystem:  { action: "deny",             risk: "critical" },
  kill_process:     { action: "deny",             risk: "critical" },
};

// Security-level overrides: how the action changes per SecurityLevel.
// "strict" tightens, "relaxed" loosens, "moderate" is the default.
const LEVEL_OVERRIDES: Record<SecurityLevel, Partial<Record<string, ToolPolicyAction>>> = {
  strict: {
    write_file:    "require_approval",
    delete_file:   "require_approval",
    shell_exec:    "require_approval",
    git_commit:    "require_approval",
    git_push:      "require_approval",
    git_pull:      "require_approval",
    web_fetch:     "require_approval",
  },
  moderate: {
    // same as builtin defaults
  },
  relaxed: {
    write_file:    "allow",
    git_commit:    "allow",
    git_pull:      "allow",
    web_fetch:     "allow",
    read_file:     "allow",
    list_directory: "allow",
  },
};

// ─── ToolPolicyEngine ─────────────────────────────────────────────────────────

export class ToolPolicyEngine {
  private readonly userPolicies: Map<string, ToolPolicy>;

  constructor(userPolicies: ToolPolicy[] = []) {
    this.userPolicies = new Map(userPolicies.map((p) => [p.toolName, p]));
  }

  // Classify a single tool at the given security level.
  // Priority: permanently blocked > user policy > security-level override > builtin default > deny.
  classify(toolName: string, level: SecurityLevel): ToolPolicyAction {
    const builtin = BUILTIN_CLASSIFICATIONS[toolName];

    // Permanently blocked tools can never be allowed
    if (builtin?.action === "deny") return "deny";

    // User policy overrides everything (permanent blocks already returned above)
    const userPolicy = this.userPolicies.get(toolName);
    if (userPolicy) return userPolicy.action;

    // Security-level override
    const levelOverride = LEVEL_OVERRIDES[level][toolName];
    if (levelOverride !== undefined) return levelOverride;

    // Builtin default
    if (builtin) return builtin.action;

    // Unknown tool → fail-closed
    return "deny";
  }

  getRiskLevel(toolName: string): TaskRiskLevel {
    const userPolicy = this.userPolicies.get(toolName);
    if (userPolicy) return userPolicy.riskLevel;
    return BUILTIN_CLASSIFICATIONS[toolName]?.risk ?? "high";
  }

  // Build an immutable session snapshot. Called once at session start.
  buildSession(
    sessionId: string,
    agentId: string,
    tools: string[],
    level: SecurityLevel
  ): ToolPolicySession {
    const decisions = new Map<string, ToolPolicyAction>();
    for (const tool of tools) {
      decisions.set(tool, this.classify(tool, level));
    }

    const session: ToolPolicySession = {
      sessionId,
      agentId,
      securityLevel: level,
      decisions: new FrozenDecisionMap(decisions),
      boundaryPrompt: this.renderBoundaryPrompt(decisions, level),
      createdAt: Date.now(),
    };
    return Object.freeze(session) as ToolPolicySession;
  }

  // Generate the system-prompt boundary description injected into every session.
  renderBoundaryPrompt(
    decisions: ReadonlyMap<string, ToolPolicyAction>,
    level: SecurityLevel,
    maxBytes = 2000
  ): string {
    const allowed: string[] = [];
    const needApproval: string[] = [];
    const denied: string[] = [];
    const hidden: string[] = [];

    for (const [tool, action] of decisions) {
      if (action === "allow") allowed.push(tool);
      else if (action === "require_approval") needApproval.push(tool);
      else if (action === "deny") denied.push(tool);
      else if (action === "hide_from_prompt") hidden.push(tool);
    }

    const lines = [
      `[SAFETY BOUNDARY — security_level=${level}]`,
      `You operate under a strict tool permission policy.`,
      ``,
      `Auto-allowed (${allowed.length}): ${allowed.join(", ") || "none"}`,
      `Require user approval (${needApproval.length}): ${needApproval.join(", ") || "none"}`,
      `Permanently denied (${denied.length}): ${denied.join(", ") || "none"}`,
      ``,
      `Rules:`,
      `- NEVER attempt a denied tool. If you need it, explain why to the user.`,
      `- For require_approval tools, describe EXACTLY what you will do before calling.`,
      `- Prefer read-only operations. Request minimal permissions.`,
      `- If uncertain about a tool's safety, ask the user first.`,
      `[END BOUNDARY]`,
    ];

    const prompt = lines.join("\n");
    return prompt.length > maxBytes ? prompt.slice(0, maxBytes) + "\n...[truncated]" : prompt;
  }

  addPolicy(policy: ToolPolicy): void {
    this.userPolicies.set(policy.toolName, policy);
  }

  removePolicy(toolName: string): void {
    this.userPolicies.delete(toolName);
  }

  listPolicies(): ToolPolicy[] {
    return Array.from(this.userPolicies.values());
  }
}

// Known tool names — used by the TUI to enumerate completions
export const KNOWN_TOOLS = Object.keys(BUILTIN_CLASSIFICATIONS);
