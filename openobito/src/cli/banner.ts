import chalk from "chalk";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, "branding/assets");

export class BannerManager {
  private version: string;
  private art: string;

  constructor(version?: string) {
    this.version = version ?? this.readVersion();
    this.art = this.readArt();
  }

  private readVersion(): string {
    try {
      const pkgPath = join(__dirname, "../../package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
      return pkg.version;
    } catch {
      return "0.0.0";
    }
  }

  private readArt(): string {
    const artPath = join(ASSETS_DIR, "obito.txt");
    if (existsSync(artPath)) {
      return readFileSync(artPath, "utf8").trimEnd();
    }
    return "";
  }

  render(): string {
    const v = chalk.cyan.bold(`v${this.version}`);
    const tag = chalk.gray("  Your local AI. Always safe.");

    if (this.art) {
      const colored = chalk.cyan(this.art);
      return `\n${colored}\n\n  OpenObito ${v}${tag}\n`;
    }

    // Fallback box banner
    return chalk.cyan.bold(`
  ╔═══════════════════════════════╗
  ║     OpenObito ${`v${this.version}`.padEnd(14)}    ║
  ║  Your local AI. Always safe.  ║
  ╚═══════════════════════════════╝
`);
  }

  displayBanner(): void {
    process.stdout.write(this.render());
  }

  getVersion(): string {
    return this.version;
  }
}
