import { describe, it, expect, vi } from "vitest";
import { EventBus, globalBus } from "../../src/agent/events.js";

describe("EventBus", () => {
  it("emits and receives events", () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.on("tool.call", listener);
    bus.emit("tool.call", "session-1", { name: "read_file" });
    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0]?.[0];
    expect(event?.type).toBe("tool.call");
    expect(event?.sessionId).toBe("session-1");
    expect(event?.data).toEqual({ name: "read_file" });
  });

  it("unsubscribes via returned function", () => {
    const bus = new EventBus();
    const listener = vi.fn();
    const unsub = bus.on("model.done", listener);
    unsub();
    bus.emit("model.done", "s1", {});
    expect(listener).not.toHaveBeenCalled();
  });

  it("once fires exactly once", () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.once("tool.call", listener);
    bus.emit("tool.call", "s1", { name: "read_file" });
    bus.emit("tool.call", "s1", { name: "read_file" });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("off removes a listener", () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.on("error", listener);
    bus.off("error", listener);
    bus.emit("error", "s1", { message: "test" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("global bus is a singleton", () => {
    expect(globalBus).toBeInstanceOf(EventBus);
  });
});
