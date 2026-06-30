import chalk from "chalk"
import type { ColorScheme } from "../ASCIIRenderer.js"

export const obitoTheme: ColorScheme = {
  ascii: (text: string) => chalk.hex("#00D9FF").bold(text),
  title: chalk.hex("#7C3AED").bold,
  subtitle: chalk.hex("#00D9FF"),
  text: chalk.white,
  muted: chalk.gray,
  info: chalk.hex("#7C3AED"),
}

export const darkTheme: ColorScheme = {
  ascii: (text: string) => chalk.yellow.bold(text),
  title: chalk.yellow.bold,
  subtitle: chalk.yellow,
  text: chalk.white,
  muted: chalk.gray,
  info: chalk.cyan,
}

export const defaultTheme: ColorScheme = {
  ascii: (text: string) => chalk.cyan.bold(text),
  title: chalk.cyan.bold,
  subtitle: chalk.cyan,
  text: chalk.white,
  muted: chalk.gray,
  info: chalk.blue,
}
