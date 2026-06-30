import { describe, it, expect } from "vitest";
import { filterEnv, isAllowedCwd } from "../../src/safety/sandbox.js";

describe("Sandbox", () => {
  it("filters environment variables", () => {
    const allowed = filterEnv({
      PATH: "/usr/bin",
      HOME: "/home/user",
      SECRET_KEY: "supersecret",
      NODE_OPTIONS: "--inspect",
    } as NodeJS.ProcessEnv);
    expect(allowed.PATH).toBe("/usr/bin");
    expect(allowed.HOME).toBe("/home/user");
    expect(allowed.SECRET_KEY).toBeUndefined();
    expect(allowed.NODE_OPTIONS).toBe("--inspect");
  });

  it("allows CWD within project", () => {
    expect(isAllowedCwd(process.cwd())).toBe(true);
  });

  it("blocks CWD outside allowed dirs", () => {
    // /etc should not be in the default allowed dirs
    expect(isAllowedCwd("/etc")).toBe(false);
  });
});
