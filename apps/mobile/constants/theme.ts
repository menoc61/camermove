/** Brand tokens — source of truth is docs/DESIGN-SYSTEM.md §2/§3. */
export const colors = {
  ink: "#0E0E0E",
  ink1: "#2A2A2A",
  ink2: "#6B6B6B",
  paper: "#F5F4F1",
  surface1: "#FFFFFF",
  surface2: "#ECEAE5",
  surface3: "#DCD9D2",
  line: "#D8D4CC",
  wood: "#B89B7B",
  woodDark: "#6F5638",
  woodLight: "#DCC6A8",
  stone: "#8C8A85",
} as const;

export type ColorName = keyof typeof colors;

/** Swiss/Bauhaus: square corners everywhere. */
export const radius = 0;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  eyebrow: { size: 11, weight: "500" as const, tracking: 0.22, uppercase: true },
  display: { size: 40, weight: "500" as const, tracking: -0.035 },
  h2: { size: 28, weight: "500" as const, tracking: -0.025 },
  h3: { size: 22, weight: "500" as const, tracking: -0.02 },
  body: { size: 16, weight: "400" as const, tracking: 0 },
} as const;
