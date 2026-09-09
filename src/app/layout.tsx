import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Fusion Control Plane",
  description: "Asset-aware ZTNA and PAM control plane",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-astryx-theme="neutral">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
