import type { SkillInfo, SkillFilter, SkillMatch } from "./types.js";

// ─── Skill registry ───────────────────────────────────────────────────────────

export class SkillRegistry {
  private skills = new Map<string, SkillInfo>();

  // ── Registration ────────────────────────────────────────────────────────────

  register(skill: SkillInfo): void {
    this.skills.set(skill.name, skill);
  }

  registerAll(skills: SkillInfo[]): void {
    for (const s of skills) this.register(s);
  }

  unregister(name: string): void {
    this.skills.delete(name);
  }

  /** Replace all registered skills (used on reload). */
  replaceAll(skills: SkillInfo[]): void {
    this.skills.clear();
    for (const s of skills) this.register(s);
  }

  // ── Lookup ───────────────────────────────────────────────────────────────────

  get(name: string): SkillInfo | null {
    return this.skills.get(name) ?? this.getByAlias(name);
  }

  private getByAlias(query: string): SkillInfo | null {
    const lower = query.toLowerCase();
    for (const skill of this.skills.values()) {
      if (skill.name.toLowerCase() === lower) return skill;
    }
    return null;
  }

  has(name: string): boolean {
    return this.get(name) !== null;
  }

  // ── Listing ──────────────────────────────────────────────────────────────────

  list(filter?: SkillFilter): SkillInfo[] {
    let result = Array.from(this.skills.values());

    if (filter?.tag) {
      const t = filter.tag.toLowerCase();
      result = result.filter((s) => s.tags.some((tag) => tag.toLowerCase() === t));
    }
    if (filter?.source) {
      result = result.filter((s) => s.source.type === filter.source);
    }
    if (filter?.minRating !== undefined) {
      result = result.filter((s) => (s.rating ?? 0) >= filter.minRating!);
    }
    if (filter?.hasBeenUsed !== undefined) {
      result = filter.hasBeenUsed
        ? result.filter((s) => s.usageCount > 0)
        : result.filter((s) => s.usageCount === 0);
    }
    if (filter?.autoImproving !== undefined) {
      result = result.filter((s) => s.autoImproving === filter.autoImproving);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  count(): number {
    return this.skills.size;
  }

  // ── Usage / ranking ──────────────────────────────────────────────────────────

  getMostUsed(limit = 5): SkillInfo[] {
    return Array.from(this.skills.values())
      .filter((s) => s.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  getRecentlyUsed(limit = 5): SkillInfo[] {
    return Array.from(this.skills.values())
      .filter((s) => s.lastUsed !== undefined)
      .sort((a, b) => (b.lastUsed?.getTime() ?? 0) - (a.lastUsed?.getTime() ?? 0))
      .slice(0, limit);
  }

  getTopRated(limit = 5): SkillInfo[] {
    return Array.from(this.skills.values())
      .filter((s) => s.rating !== undefined)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, limit);
  }

  // ── Fuzzy search ─────────────────────────────────────────────────────────────

  /**
   * Full-text fuzzy search across skill name, description, and tags.
   * Returns results sorted by relevance score descending.
   */
  search(query: string): SkillInfo[] {
    if (!query.trim()) return this.list();
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    const scored: Array<{ skill: SkillInfo; score: number }> = [];

    for (const skill of this.skills.values()) {
      const score = this.scoreSkill(skill, tokens);
      if (score > 0) scored.push({ skill, score });
    }

    return scored.sort((a, b) => b.score - a.score).map((s) => s.skill);
  }

  /** Search returning full match records (name + score + reason). */
  searchWithReasons(query: string, limit = 5): SkillMatch[] {
    if (!query.trim()) return [];
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches: SkillMatch[] = [];

    for (const skill of this.skills.values()) {
      const { score, reason } = this.scoreSkillDetailed(skill, tokens);
      if (score > 0) matches.push({ skill, score, reason });
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // ── Mutation (usage tracking) ─────────────────────────────────────────────────

  incrementUsage(name: string): void {
    const skill = this.skills.get(name);
    if (!skill) return;
    skill.usageCount += 1;
    skill.lastUsed = new Date();
  }

  updateRating(name: string, rating: number): void {
    const skill = this.skills.get(name);
    if (!skill) return;
    skill.rating = Math.max(1, Math.min(5, rating));
  }

  updateContent(name: string, newContent: string): void {
    const skill = this.skills.get(name);
    if (!skill) return;
    skill.content = newContent;
  }

  setAutoImproving(name: string, value: boolean): void {
    const skill = this.skills.get(name);
    if (!skill) return;
    skill.autoImproving = value;
  }

  // ── Private scoring ──────────────────────────────────────────────────────────

  private scoreSkill(skill: SkillInfo, tokens: string[]): number {
    return this.scoreSkillDetailed(skill, tokens).score;
  }

  private scoreSkillDetailed(skill: SkillInfo, tokens: string[]): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    const nameL = skill.name.toLowerCase();
    const descL = skill.description.toLowerCase();
    const tagsL = skill.tags.map((t) => t.toLowerCase());

    for (const token of tokens) {
      // Exact name match — strongest signal
      if (nameL === token) { score += 1.0; reasons.push(`exact name: "${token}"`); continue; }
      // Name starts with token
      if (nameL.startsWith(token)) { score += 0.8; reasons.push(`name prefix: "${token}"`); continue; }
      // Name contains token
      if (nameL.includes(token)) { score += 0.6; reasons.push(`name match: "${token}"`); continue; }
      // Tag exact match
      if (tagsL.includes(token)) { score += 0.7; reasons.push(`tag: "${token}"`); continue; }
      // Tag partial match
      if (tagsL.some((t) => t.includes(token))) { score += 0.5; reasons.push(`tag partial: "${token}"`); continue; }
      // Description contains token
      if (descL.includes(token)) { score += 0.3; reasons.push(`description: "${token}"`); }
    }

    // Boost for popular / well-rated skills
    if (skill.usageCount > 10) score += 0.1;
    if ((skill.rating ?? 0) >= 4) score += 0.1;

    return {
      score,
      reason: reasons.slice(0, 2).join(", ") || "partial match",
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const globalRegistry = new SkillRegistry();
