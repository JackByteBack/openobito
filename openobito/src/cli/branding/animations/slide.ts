export function slideIn(lines: string[], speed: number): void {
  lines.forEach((line, idx) => {
    setTimeout(() => console.log(line), idx * speed)
  })
}
