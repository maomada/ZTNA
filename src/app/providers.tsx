"use client";

import { Theme } from "@astryxdesign/core/theme";
import { fusionTheme } from "./fusion";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <Theme theme={fusionTheme}>{children}</Theme>;
}
