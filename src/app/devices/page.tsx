import { Section } from "@astryxdesign/core/Section";

import { DeviceConsole } from "../console/device-console";
import { AppFrame } from "../console-frame";
import { PageHeader } from "../page-header";
import { buildConsoleData } from "@/lib/console-rows";
import { loadFusionStore } from "@/lib/fusion-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "设备 · Fusion 控制平面" };

export default async function DevicesPage() {
  const data = buildConsoleData(await loadFusionStore());

  return (
    <AppFrame>
      <PageHeader
        crumbs={[{ label: "Fusion", href: "/" }, { label: "设备" }]}
        title="设备"
        description="每项直接网络授权都会将一个主体和受管设备绑定到已有的单对等节点 NetBird 组；Fusion 会在强制执行前验证该组。"
      />
      <Section padding={0}>
        <DeviceConsole title="设备注册" rows={data.deviceRows} />
      </Section>
    </AppFrame>
  );
}
