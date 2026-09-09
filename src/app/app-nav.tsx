"use client";

import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { KeyRound, LayoutDashboard, Laptop, Radar, ScrollText, Server, ShieldCheck, Waypoints } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const navSections: Array<{ title?: string; items: NavItem[] }> = [
  {
    items: [{ label: "概览", href: "/", icon: LayoutDashboard }],
  },
  {
    title: "控制平面",
    items: [
      { label: "资产", href: "/assets", icon: Server },
      { label: "发现审核", href: "/discovery", icon: Radar },
      { label: "设备", href: "/devices", icon: Laptop },
      { label: "站点与路由器组", href: "/sites", icon: Waypoints },
    ],
  },
  {
    title: "访问控制",
    items: [
      { label: "静态权限", href: "/access", icon: ShieldCheck },
      { label: "申请与授权", href: "/grants", icon: KeyRound },
    ],
  },
  {
    title: "活动",
    items: [{ label: "统一审计", href: "/audit", icon: ScrollText }],
  },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <SideNav
      collapsible
      header={<SideNavHeading heading="Fusion" superheading="ZTNA / PAM 控制平面" headingHref="/" />}>
      {navSections.map((section) => (
        <SideNavSection
          key={section.title ?? "root"}
          title={section.title ?? "概览"}
          isHeaderHidden={section.title === undefined}>
          {section.items.map((item) => (
            <SideNavItem
              key={item.href}
              label={item.label}
              href={item.href}
              as={Link}
              icon={item.icon}
              isSelected={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
            />
          ))}
        </SideNavSection>
      ))}
    </SideNav>
  );
}
