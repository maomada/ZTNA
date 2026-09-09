import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Fusion 控制平面",
  description: "面向资产的 ZTNA 与 PAM 控制平面",
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
