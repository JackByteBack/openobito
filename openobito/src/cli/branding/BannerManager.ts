import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { ASCIIRenderer } from "./ASCIIRenderer.js"
import type { ColorScheme } from "./ASCIIRenderer.js"
import type { BannerConfig } from "./BannerConfig.js"
import { DEFAULT_CONFIG } from "./BannerConfig.js"
import { obitoTheme, darkTheme, defaultTheme } from "./themes/obito.js"
import { fadeIn } from "./animations/fade.js"
import { slideIn } from "./animations/slide.js"
import { typewriter } from "./animations/typewriter.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

const FALLBACK_ASCII = [
  "x=====xxx=====+ :++++;x+::;+x===+++=++==========xxXX$XxXXXXXXXXxx=xxxxx+===",
  "==x=======+::;;  ::.::;x===xxXXXx==xx=x=xxxx=++xxXXXXXXX$$$Xxx======xxx====",
  "======+;;;++;;;:. :+;+=xxxxxxx===++=++===xxxxxxxxxx====XX$$x=++:+==+xxxx==x",
  "===++++=xxxxxx=;;: ;xxx====++++;:.::::.::;+++++++++=====XXxXxx=+x=xxXxxx==x",
  "+++=xxxXX=+;;+;+==; :+;;::..:;:..;+::::.  .. .:;+===xXXx===X==XXXXXXx=++;;=",
  "==xxxXXx=+;.:..:;::: :;.  .:;;....;;:++;...  ...+==XX=xXXx=XXX$$$$XXXxxxxxx",
  "XXx=x=+:::;;+::;:::;; .:;::+++...:;;:;+:. ;:.   :+=xX$$$$$X=XxxXXXXXXXXXXxx",
  "xx==+++;;:.;;+xxXXXXx: ;=+;;;+..:::::;;:::+;:::   ;=xX$$$$X==Xx=XXXxXXXXXxx",
  "++++=xx=;;=xxXXXXXXX=+; ::;=xx=...::::;;:+=;:.. .;;;xX$$$$XX+xXx=xXXXXxxxxx",
  "+===x=====xxXXXx=xx=x==+ ;xxXXX+...::;++====;::;+:;+=xxx$X=XXxXX=+xXxxxxxxx",
  "==========xxxXXx=+.=xx=x+:++:;+=;..;=xXXXxxx=:.+;:;+;=xX$$xx$x+xX++xXXXXxxx",
  "xXXXXxxxxxxx=xxxx==xx=xxx=.;:;+xxxXXXXXXXXxxx;;.   ::::;=X$XXx;;x=+=xXXxxxx",
  "xxxXXXXXXX$XXXXXxxxXXXxx==XxxxxXXXX$XXXXXXX$XX+;::+;   .::;x$X;;x=++=xxx===",
  "======xxxXXX$XxX$XXXXX$$$X$$XxxXXX$$X$$$$$$$$Xx==xxX+:.    +xx;+x=+==x=====",
  "xxx==++==xxXXXxx======xX$$$$$$XXXX$$X$$$$$XX=:..:+=xx++;;;:::;==x==========",
  "xxxxxxxxxxxXXXXx===xxxxX$$$XXx$$$$$$$$$$X==;:.   :;+XxxXXxxxxxx=xxxxxxxxxxx",
  "=x=xxxxxx===+==xXXXXX$$$$$XxxXXXX$$$$$$$X===+;:..:+xXXX$$$XXxxxxxxxxx====++",
  "xxxxXxxxx==;:;;;XXXXXXXX$X$X$$$$$$$$X$$$$XXX$XXxxxXX=xxXXX=++;;;++++==++;;;",
  "==xx==xxx==;+===xXxxxxxx==+==xxxxXXXX$$$X$$$$$$$$$$XxXXXXx+++++++++=======+",
  "++====xxxx=;:+xxxx==xx=;;;...+:;++==xXxXXXX$$$$$XXXXXXXxxxxxxxxxxxxxxx=====",
].join("\n")

const FILENAMES: Record<number, string> = { 30: "obito-small.txt", 50: "obito.txt", 80: "obito-full.txt" }

export class BannerManager {
  private config: BannerConfig
  private asciiArt: Map<number, string> = new Map()
  private renderer: ASCIIRenderer

  constructor(customConfig?: Partial<BannerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig }

    const themes: Record<string, ColorScheme> = { obito: obitoTheme, dark: darkTheme, default: defaultTheme }
    const theme = themes[this.config.theme] ?? obitoTheme
    this.renderer = new ASCIIRenderer(theme)

    this.loadASCII()
  }

  private loadASCII(): void {
    for (const [width, fname] of Object.entries(FILENAMES)) {
      try {
        const p = join(__dirname, "assets", fname)
        if (existsSync(p)) {
          this.asciiArt.set(Number(width), readFileSync(p, "utf-8").trim())
        }
      } catch { /* ignore */ }
    }
    if (this.asciiArt.size === 0) {
      this.asciiArt.set(50, FALLBACK_ASCII)
    }
  }

  private _getASCII(): string {
    return this.asciiArt.get(this.config.width) ?? this.asciiArt.get(50) ?? FALLBACK_ASCII
  }

  display(): void {
    if (!this.config.enabled) return

    const ascii = this._getASCII()
    let output: string

    switch (this.config.style) {
      case "minimal":
        output = this.renderer.renderMinimal(ascii)
        break
      case "quiet":
        return
      default:
        output = this.renderer.renderFull(ascii, this.config, this.getVersion())
    }

    if (this.config.animation !== "none") {
      const speed =
        this.config.animationSpeed === "fast" ? 10
        : this.config.animationSpeed === "slow" ? 50
        : 25
      const lines = output.split("\n")
      switch (this.config.animation) {
        case "fade":
          fadeIn(lines, speed)
          break
        case "slide":
          slideIn(lines, speed)
          break
        case "typewriter":
          typewriter(lines, speed)
          break
        default:
          console.log(output)
      }
    } else {
      console.log(output)
    }
  }

  showBanner(args: string[] = []): void {
    if (args.includes("--help")) {
      console.log([
        "/banner              Show current banner",
        "/banner --full       Show full version",
        "/banner --minimal    Show minimal version",
        "/banner --art        Show ASCII art only",
        "/banner --help       Show this help",
      ].join("\n"))
      return
    }

    const origStyle = this.config.style

    if (args.includes("--full")) this.config.style = "full"
    else if (args.includes("--minimal")) this.config.style = "minimal"

    if (args.includes("--art")) {
      if (this.config.animation !== "none") {
        const speed = this.config.animationSpeed === "fast" ? 10 : this.config.animationSpeed === "slow" ? 50 : 25
        const lines = this._getASCII().split("\n")
        switch (this.config.animation) {
          case "fade": fadeIn(lines, speed); break
          case "slide": slideIn(lines, speed); break
          case "typewriter": typewriter(lines, speed); break
          default: console.log(this._getASCII())
        }
      } else {
        console.log(this._getASCII())
      }
      return
    }

    this.display()
    this.config.style = origStyle
  }

  displayBanner(): void {
    this.display()
  }

  displayASCII(): void {
    console.log(this._getASCII())
  }

  getASCII(): string {
    return this._getASCII()
  }

  getVersion(): string {
    for (const rel of ["../../../package.json", "../../package.json", "../package.json", "package.json"]) {
      try {
        const pkgPath = join(__dirname, rel)
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string }
        if (pkg.version) return pkg.version
      } catch { continue }
    }
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string }
      if (pkg.version) return pkg.version
    } catch { /* ignore */ }
    return "0.0.0"
  }

  updateConfig(newConfig: Partial<BannerConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): BannerConfig {
    return { ...this.config }
  }
}
