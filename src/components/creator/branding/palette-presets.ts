export interface BrandPalette {
  id: string;
  name: string;
  vibe: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  text: string;
}

export const CURATED_PALETTES: BrandPalette[] = [
  {
    id: "zambia-copper",
    name: "Copper & Heritage",
    vibe: "Warm, energetic, rooted in African innovation",
    primary: "#fd5523",
    secondary: "#062e39",
    accent: "#f59e0b",
    surface: "#fffaf6",
    text: "#062e39",
  },
  {
    id: "emerald-growth",
    name: "Emerald Horizon",
    vibe: "Prestigious, growth, wealth of knowledge",
    primary: "#059669",
    secondary: "#064e3b",
    accent: "#34d399",
    surface: "#f0fdf4",
    text: "#064e3b",
  },
  {
    id: "cyber-cyan",
    name: "Future Cyber",
    vibe: "Tech, cutting-edge AI, modern software",
    primary: "#06b6d4",
    secondary: "#0f172a",
    accent: "#38bdf8",
    surface: "#0a0f1d",
    text: "#f8fafc",
  },
  {
    id: "royal-sapphire",
    name: "Royal Oxford",
    vibe: "Ivy League, high academia, elite standards",
    primary: "#2563eb",
    secondary: "#1e3a8a",
    accent: "#d97706",
    surface: "#f8fafc",
    text: "#0f172a",
  },
  {
    id: "creative-violet",
    name: "Velvet Renaissance",
    vibe: "Design, creative arts, expressive mastery",
    primary: "#8b5cf6",
    secondary: "#581c87",
    accent: "#ec4899",
    surface: "#faf5ff",
    text: "#3b0764",
  },
  {
    id: "terracotta-earth",
    name: "Warm Terracotta",
    vibe: "Editorial, storytelling, human warmth",
    primary: "#c2410c",
    secondary: "#431407",
    accent: "#fbbf24",
    surface: "#fffbf5",
    text: "#292524",
  },
  {
    id: "obsidian-gold",
    name: "Obsidian Gold",
    vibe: "Executive, luxury, high-ticket mastery",
    primary: "#eab308",
    secondary: "#09090b",
    accent: "#facc15",
    surface: "#121215",
    text: "#fafafa",
  },
  {
    id: "minimal-slate",
    name: "Minimal Monochrome",
    vibe: "Clean, distraction-free, Swiss design",
    primary: "#0f172a",
    secondary: "#475569",
    accent: "#64748b",
    surface: "#f8fafc",
    text: "#020617",
  },
];

/**
 * Calculates relative luminance to estimate WCAG contrast against light (#ffffff) and dark (#0f172a).
 */
export function getContrastRatio(hex: string): { onWhite: number; onDark: number; rating: "AAA" | "AA" | "Check" } {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return { onWhite: 4.5, onDark: 4.5, rating: "AA" };

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  const whiteLum = 1.0;
  const darkLum = 0.01;

  const onWhite = (whiteLum + 0.05) / (lum + 0.05);
  const onDark = (lum + 0.05) / (darkLum + 0.05);

  let rating: "AAA" | "AA" | "Check" = "Check";
  if (onWhite >= 7 || onDark >= 7) rating = "AAA";
  else if (onWhite >= 4.5 || onDark >= 4.5) rating = "AA";

  return {
    onWhite: Number(onWhite.toFixed(1)),
    onDark: Number(onDark.toFixed(1)),
    rating,
  };
}
