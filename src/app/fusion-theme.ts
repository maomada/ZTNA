import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

export const fusionTheme = defineTheme({
  name: "fusion",
  extends: neutralTheme,
  color: { accent: "#2563eb", neutralStyle: "cool", contrast: "standard" },
  typography: {
    scale: { base: 16, ratio: 1.2 },
    body: { family: "Inter", fallbacks: "-apple-system, system-ui, sans-serif" },
  },
});
