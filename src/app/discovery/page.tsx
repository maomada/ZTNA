import { Section } from "@astryxdesign/core/Section";

import { DiscoveryConsole } from "../console/discovery-console";
import { AppFrame } from "../console-frame";
import { PageHeader } from "../page-header";
import { buildConsoleData } from "@/lib/console-rows";
import { loadFusionStore } from "@/lib/fusion-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "发现审核 · Fusion 控制平面" };

export default async function DiscoveryPage() {
  const data = buildConsoleData(await loadFusionStore());

  return (
    <AppFrame>
      <PageHeader
        crumbs={[{ label: "Fusion", href: "/" }, { label: "发现审核" }]}
        title="发现审核"
        description="发现记录只是观测结果，并非可信资产。管理员显式导入后，其端点才会成为网络资源；导入不会创建权限或 AccessGrant。"
      />
      <Section padding={0}>
        <DiscoveryConsole title="发现记录" rows={data.discoveryRows} sites={data.siteOptions} routerGroups={data.routerGroupOptions} />
      </Section>
    </AppFrame>
  );
}
