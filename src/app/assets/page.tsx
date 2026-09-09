import { Section } from "@astryxdesign/core/Section";

import { AssetConsole } from "../console/asset-console";
import { AppFrame } from "../console-frame";
import { PageHeader } from "../page-header";
import { buildConsoleData } from "@/lib/console-rows";
import { loadFusionStore } from "@/lib/fusion-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "资产 · Fusion 控制平面" };

export default async function AssetsPage() {
  const data = buildConsoleData(await loadFusionStore());

  return (
    <AppFrame>
      <PageHeader
        crumbs={[{ label: "Fusion", href: "/" }, { label: "资产" }]}
        title="资产"
        description="将可通过路由器对等节点到达的设备建模为稳定资产；每个端点会编译为限定在站点与路由器组范围内的网络资源，IPv4 编译为 /32，IPv6 为 /128，DNS 保留域名。"
      />
      <Section padding={0}>
        <AssetConsole
          title="资产清单"
          rows={data.assetRows}
          assets={data.assetDetails}
          sites={data.siteOptions}
          routerGroups={data.routerGroupOptions}
        />
      </Section>
    </AppFrame>
  );
}
