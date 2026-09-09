import { Section } from "@astryxdesign/core/Section";

import { AccessConsole } from "../console/access-console";
import { AppFrame } from "../console-frame";
import { PageHeader } from "../page-header";
import { buildConsoleData } from "@/lib/console-rows";
import { loadFusionStore } from "@/lib/fusion-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "申请与授权 · Fusion 控制平面" };

export default async function GrantsPage() {
  const data = buildConsoleData(await loadFusionStore());

  return (
    <AppFrame>
      <PageHeader
        crumbs={[{ label: "Fusion", href: "/" }, { label: "申请与授权" }]}
        title="申请与授权"
        description="提交申请只会记录待审批记录；AccessGrant 只能由 Teleport 审批创建，网络规则随之编译，并受授权 TTL 约束。"
      />
      <Section padding={0}>
        <AccessConsole
          title="访问请求"
          requestRows={data.requestRows}
          grantRows={data.grantRows}
          sites={data.siteOptions}
          assets={data.managedAssetOptions}
          devices={data.deviceOptions}
        />
      </Section>
    </AppFrame>
  );
}
