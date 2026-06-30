import chalk from "chalk";

// ─── OpenAgent theme (Hermes-inspired) ───────────────────────────────────────

export const theme = {
  primary: chalk.cyan,
  secondary: chalk.blue,
  accent: chalk.magenta,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  muted: chalk.gray,
  bold: chalk.bold,

  user: chalk.cyan.bold,
  assistant: chalk.green,
  system: chalk.gray.italic,
  tool: chalk.yellow,

  banner: chalk.cyan.bold,
  prompt: chalk.cyan("> "),

  riskLow: chalk.green,
  riskMedium: chalk.yellow,
  riskHigh: chalk.red,
  riskCritical: chalk.red.bold,

  format: {
    separator: chalk.gray("─".repeat(60)),
    userLabel: chalk.cyan.bold("You"),
    agentLabel: chalk.green.bold("OpenAgent"),
    toolLabel: chalk.yellow.bold("Tool"),
    errorLabel: chalk.red.bold("Error"),
  },
} as const;

type ChalkFn = typeof chalk.red;

export function riskColor(level: string): ChalkFn {
  switch (level) {
    case "low": return theme.riskLow;
    case "medium": return theme.riskMedium;
    case "high": return theme.riskHigh;
    case "critical": return theme.riskCritical;
    default: return chalk.white;
  }
}
