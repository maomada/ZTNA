import { AppShell } from "@astryxdesign/core/AppShell";
import { VStack } from "@astryxdesign/core/Stack";
import type { ReactNode } from "react";

import { AppNav } from "./app-nav";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell
      contentPadding={6}
      height="auto"
      variant="wash"
      mobileNav={{ breakpoint: "md" }}
      sideNav={<AppNav />}>
      <VStack gap={6}>{children}</VStack>
    </AppShell>
  );
}
