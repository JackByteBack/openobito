export function typewriter(lines: string[], speed: number): void {
  lines.forEach((line, idx) => {
    setTimeout(() => {
      let out = ""
      for (let i = 0; i < line.length; i++) {
        const ch = line[i] ?? ""
        setTimeout(() => {
          out += ch
          process.stdout.write(ch)
        }, i * (speed / 10))
      }
      setTimeout(() => process.stdout.write("\n"), line.length * (speed / 10))
    }, idx * speed * 2)
  })
}
