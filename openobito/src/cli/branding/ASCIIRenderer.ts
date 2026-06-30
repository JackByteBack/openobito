import chalk from "chalk"
import type { BannerConfig } from "./BannerConfig.js"
import { DEFAULT_CONFIG } from "./BannerConfig.js"

type Chalky = typeof chalk

export interface ColorScheme {
  ascii: (text: string) => string
  title: Chalky
  subtitle: Chalky
  text: Chalky
  muted: Chalky
  info: Chalky
}

export class ASCIIRenderer {
  private scheme: ColorScheme

  constructor(scheme: ColorScheme) {
    this.scheme = scheme
  }

  renderFull(ascii: string, config: BannerConfig, version = "0.0.0"): string {
    const lines: string[] = []
    lines.push("")
    lines.push(this.scheme.ascii(ascii))
    lines.push(this.scheme.muted("─".repeat(config.width + 4)))
    lines.push(this.scheme.title.bold(`OPENOBITO v${version}`))
    lines.push(this.scheme.subtitle("Safe • Local • Intelligent"))
    lines.push("")

    if (config.showStats) {
      lines.push(this.scheme.info(this.getStats()))
    }

    if (config.showTips) {
      lines.push("")
      lines.push(this.scheme.muted("Type /help for commands | /doctor for health"))
      lines.push(this.scheme.muted("Type /chat to start conversation"))
    }

    lines.push("")
    return lines.join("\n")
  }

  renderMinimal(ascii: string): string {
    return [
      "",
      this.scheme.ascii(ascii),
      this.scheme.title.bold("OPENOBITO"),
      "",
    ].join("\n")
  }

  renderHelp(ascii: string, version = "0.0.0"): string {
    const base = this.renderFull(ascii, { ...DEFAULT_CONFIG, showTips: false }, version)
    return [
      base,
      "",
      this.scheme.info.bold("Available Commands:"),
      this.scheme.muted("  /help            Show all commands"),
      this.scheme.muted("  /model list      List available models"),
      this.scheme.muted("  /skills          Show skills"),
      this.scheme.muted("  /doctor          Health check"),
      this.scheme.muted("  /chat            Start interactive mode"),
      "",
    ].join("\n")
  }

  private getStats(): string {
    const model = "Model: mistral:latest"
    const memory = "Memory: 0 sessions | 0 KB"
    const time = `Started: ${new Date().toLocaleTimeString()}`
    return `${model} | ${memory} | ${time}`
  }
}
