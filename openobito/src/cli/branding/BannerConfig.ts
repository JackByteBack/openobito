export interface BannerConfig {
  enabled: boolean
  style: "full" | "minimal" | "quiet"
  width: 30 | 50 | 80
  animation: "none" | "fade" | "slide" | "typewriter"
  animationSpeed: "fast" | "normal" | "slow"
  showStats: boolean
  showTips: boolean
  theme: "default" | "dark" | "obito" | "custom"
  customTheme: {
    primary: string
    accent: string
    ascii: string
  } | undefined
}

export const DEFAULT_CONFIG: BannerConfig = {
  enabled: true,
  style: "full",
  width: 50,
  animation: "fade",
  animationSpeed: "normal",
  showStats: true,
  showTips: true,
  theme: "obito",
  customTheme: undefined,
}
