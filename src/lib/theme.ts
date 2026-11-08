import type { AppearanceSettings } from "@/lib/types";

export type AppTheme = {
  backgroundStart: string;
  backgroundEnd: string;
  card: string;
  cardMuted: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  outline: string;
  glass: string;
};

const nightTwilight: AppTheme = {
  backgroundStart: "#0A1520",
  backgroundEnd: "#0F2A3D",
  card: "rgba(26,26,46,0.92)",
  cardMuted: "rgba(18,35,52,0.72)",
  textPrimary: "#F8FAFC",
  textSecondary: "#8B9DC3",
  accent: "#00D4FF",
  success: "#00FF88",
  warning: "#FF8C42",
  danger: "#FB7185",
  outline: "rgba(255,255,255,0.12)",
  glass: "rgba(255,255,255,0.08)",
};

const nightAmethyst: AppTheme = {
  backgroundStart: "#0C1445",
  backgroundEnd: "#2C1E5E",
  card: "rgba(28,37,89,0.92)",
  cardMuted: "rgba(41,24,81,0.72)",
  textPrimary: "#F8FAFC",
  textSecondary: "#A3B1D6",
  accent: "#4F5BD5",
  success: "#4CD964",
  warning: "#FFCC00",
  danger: "#FB7185",
  outline: "rgba(255,255,255,0.12)",
  glass: "rgba(255,255,255,0.08)",
};

const sunset: AppTheme = {
  backgroundStart: "#FF9966",
  backgroundEnd: "#FF5E62",
  card: "rgba(255,255,255,0.88)",
  cardMuted: "rgba(255,255,255,0.58)",
  textPrimary: "#2D1B2E",
  textSecondary: "#5C4B5E",
  accent: "#2B1C40",
  success: "#34C759",
  warning: "#FF9500",
  danger: "#EF4444",
  outline: "rgba(45,27,46,0.1)",
  glass: "rgba(255,255,255,0.24)",
};

export function getTheme(
  appearance: AppearanceSettings,
  deviceScheme?: "light" | "dark" | "unspecified" | null,
): AppTheme {
  if (
    appearance.themeMode === "Sunset" ||
    (appearance.themeMode === "System" && deviceScheme === "light")
  ) {
    return sunset;
  }

  if (appearance.colorPalette === "Amethyst") {
    return nightAmethyst;
  }

  return nightTwilight;
}
