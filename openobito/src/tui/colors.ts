// ─── OpenAgent color palette (Hermes-inspired cyan/purple) ───────────────────
// Hex values are passed directly to Ink's <Text color> / <Box borderColor>,
// which accept hex strings on truecolor terminals.

export const colors = {
  primary: "#00D9FF", // cyan
  accent: "#7C3AED", // purple
  success: "#10B981", // green
  warning: "#F59E0B", // amber
  error: "#EF4444", // red
  thinking: "#64748B", // slate / muted
  text: "#F1F5F9", // light
  textDim: "#94A3B8", // dimmed light
  border: "#334155", // slate border
  bgAccent: "#1E293B", // panel background hint
} as const;

export type ColorName = keyof typeof colors;

// Role → color mapping for messages
export const roleColors = {
  user: colors.primary,
  assistant: colors.text,
  system: colors.thinking,
  tool: colors.accent,
  error: colors.error,
} as const;

// Risk level → color (permission system)
export const riskColors = {
  low: colors.success,
  medium: colors.warning,
  high: "#FB923C", // orange
  critical: colors.error,
} as const;

export function riskColor(level: string): string {
  return (riskColors as Record<string, string>)[level] ?? colors.text;
}
