// ─── Session event bus (opencode-inspired) ───────────────────────────────────

export type AgentEventType =
  | "session.start"
  | "session.end"
  | "message.user"
  | "message.assistant"
  | "message.tool_result"
  | "tool.call"
  | "tool.result"
  | "tool.approval_required"
  | "tool.denied"
  | "model.thinking"
  | "model.done"
  | "agent.circuit_breaker"
  | "agent.model_error"
  | "agent.delegate_start"
  | "agent.delegate_done"
  | "agent.delegate_error"
  | "cron.job_added"
  | "cron.job_removed"
  | "cron.job_start"
  | "cron.job_done"
  | "cron.job_error"
  | "error";

export interface AgentEvent<T = unknown> {
  type: AgentEventType;
  sessionId: string;
  timestamp: number;
  data: T;
}

type Listener<T = unknown> = (event: AgentEvent<T>) => void;

export class EventBus {
  private listeners = new Map<AgentEventType, Set<Listener>>();

  on<T = unknown>(type: AgentEventType, listener: Listener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener as Listener);
    return () => this.off(type, listener as Listener);
  }

  off(type: AgentEventType, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit<T = unknown>(type: AgentEventType, sessionId: string, data: T): void {
    const event: AgentEvent<T> = { type, sessionId, timestamp: Date.now(), data };
    this.listeners.get(type)?.forEach((l) => l(event as AgentEvent));
  }

  once<T = unknown>(type: AgentEventType, listener: Listener<T>): void {
    const wrapped: Listener<T> = (event) => {
      listener(event);
      this.off(type, wrapped as Listener);
    };
    this.on(type, wrapped);
  }
}

export const globalBus = new EventBus();
