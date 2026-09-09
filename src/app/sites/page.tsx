import { Section } from "@astryxdesign/core/Section";

import { SiteConsole } from "../console/site-console";
import { AppFrame } from "../console-frame";
import { PageHeader } from "../page-header";
import { buildConsoleData } from "@/lib/console-rows";
import { loadFusionStore } from "@/lib/fusion-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "站点与路由器组 · Fusion 控制平面" };

export default async function SitesPage() {
  const data = buildConsoleData(await loadFusionStore());

  return (
    <AppFrame>
      <PageHeader
        crumbs={[{ label: "Fusion", href: "/" }, { label: "站点与路由器组" }]}
        title="站点与路由器组"
        description="站点是网络命名空间；路由器组声明可达对等节点，资产经由路由器组解析编译范围。缺少 netbirdGroupId 的路由器组无法参与 NetBird 资源同步。"
      />
      <Section padding={0}>
        <SiteConsole title="网络拓扑" sites={data.siteListItems} routerGroups={data.routerGroupListItems} />
      </Section>
    </AppFrame>
  );
}
