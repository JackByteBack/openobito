import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { SkillInfo, ImprovementResult } from "./types.js";
import type { SkillRegistry } from "./registry.js";
import type { OllamaAdapter } from "../model/ollama.js";

// ─── Skill improver ───────────────────────────────────────────────────────────
// Manages self-improving skills: agent-generated improvements, usage tracking,
// and ratings. Writes changes back to SKILL.md on disk.

export class SkillImprover {
  constructor(
    private registry: SkillRegistry,
    private model: OllamaAdapter,
    private modelName: string,
  ) {}

  // ── Improvement ─────────────────────────────────────────────────────────────

  /**
   * Create a new skill SKILL.md from a task description and its outcome.
   * Returns the generated content (does not write to disk — caller decides where).
   */
  async createFromTask(taskDescription: string, taskResult: string): Promise<string> {
    const prompt = [
      "You are helping create a reusable skill file for an AI coding assistant.",
      "A skill is a SKILL.md file that gives the assistant a methodology for a type of task.",
      "",
      "Task the user just completed:",
      taskDescription,
      "",
      "How it went / what worked:",
      taskResult,
      "",
      "Generate a SKILL.md with:",
      "1. YAML frontmatter (name, description, version: 1.0.0, author: auto-generated, metadata.tags)",
      "2. A concise methodology the assistant should follow for this type of task",
      "3. Step-by-step process, key rules, and output format",
      "",
      "Output only the raw SKILL.md content. No explanations.",
    ].join("\n");

    const response = await this.model.chat(this.modelName, [
      { role: "user", content: prompt },
    ]);

    return response.content;
  }

  /**
   * Improve an existing skill's SKILL.md based on user feedback.
   * Writes the improved content to disk and updates the registry.
   */
  async improve(skillName: string, feedback: string): Promise<ImprovementResult | null> {
    const skill = this.registry.get(skillName);
    if (!skill || skill.source.type !== "directory") return null;

    const skillMdPath = join(skill.location, "SKILL.md");
    if (!existsSync(skillMdPath)) return null;

    const previousContent = readFileSync(skillMdPath, "utf-8");

    const prompt = [
      "You are improving a skill file for an AI coding assistant.",
      "A skill is a SKILL.md that gives the assistant a methodology for a type of task.",
      "",
      "Current SKILL.md content:",
      "```",
      previousContent,
      "```",
      "",
      "User feedback / what to improve:",
      feedback,
      "",
      "Rewrite the SKILL.md incorporating this feedback.",
      "Keep the same YAML frontmatter structure (bump version by 0.0.1).",
      "Output only the raw SKILL.md content. No explanations.",
    ].join("\n");

    const response = await this.model.chat(this.modelName, [
      { role: "user", content: prompt },
    ]);

    const newContent = response.content;

    // Write back to disk
    writeFileSync(skillMdPath, newContent, "utf-8");

    // Update in-memory content
    this.registry.updateContent(skillName, newContent);

    // Generate change summary
    const summaryPrompt = `Summarize in one sentence what changed between these two SKILL.md versions:\n\nBefore:\n${previousContent.slice(0, 500)}\n\nAfter:\n${newContent.slice(0, 500)}`;
    const summaryRes = await this.model.chat(this.modelName, [
      { role: "user", content: summaryPrompt },
    ]);

    const updatedSkill = this.registry.get(skillName)!;
    return {
      skill: updatedSkill,
      previousContent,
      newContent,
      changesSummary: summaryRes.content.trim(),
    };
  }

  // ── Usage tracking ──────────────────────────────────────────────────────────

  incrementUsage(skillName: string): void {
    this.registry.incrementUsage(skillName);
  }

  updateRating(skillName: string, rating: number): void {
    this.registry.updateRating(skillName, rating);
  }

  enableAutoImproving(skillName: string): void {
    this.registry.setAutoImproving(skillName, true);
  }

  disableAutoImproving(skillName: string): void {
    this.registry.setAutoImproving(skillName, false);
  }
}
