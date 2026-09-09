import { Badge } from "@astryxdesign/core/Badge";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";

import { PermissionConsole } from "../console/permission-console";
import { NetworkMapDialog } from "../console/network-map-dialog";
import { AppFrame } from "../console-frame";
import { PageHeader } from "../page-header";
import { accessColumns } from "@/lib/console-columns";
import { buildConsoleData } from "@/lib/console-rows";
import { loadFusionStore } from "@/lib/fusion-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "静态权限 · Fusion 控制平面" };

export default async function AccessPage() {
  const data = buildConsoleData(await loadFusionStore());

  return (
    <AppFrame>
      <PageHeader
        crumbs={[{ label: "Fusion", href: "/" }, { label: "静态权限" }]}
        title="静态权限"
        description="静态权限永不过期，将一个主体和受管设备绑定到一个资产；临时访问请通过申请与审批流程获得。静态权限与 AccessGrant 共用同一个编译器。"
      />
      <Section padding={0}>
        <PermissionConsole
          title="静态权限"
          rows={data.permissionRows}
          devices={data.deviceOptions}
          assets={data.managedAssetOptions}
        />
      </Section>
      <Section padding={0}>
        <VStack gap={3} padding={4}>
          <HStack hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={2} vAlign="center">
              <Heading level={2}>有效访问规则</Heading>
              <Badge label={data.accessRows.length} />
            </HStack>
            <NetworkMapDialog devices={data.deviceOptions} />
          </HStack>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <StatusDot
              variant={data.accessRows.length > 0 ? "success" : "neutral"}
              label={data.accessRows.length > 0 ? "编译正常" : "默认拒绝"}
            />
            <Text>{data.policyMessage}</Text>
          </HStack>
        </VStack>
        {data.accessRows.length === 0 ? (
          <VStack padding={4} paddingBlockStart={0}>
            <EmptyState title="暂无有效访问权限" description="创建静态权限或获批的 AccessGrant 后，规则会显示在这里。" isCompact />
          </VStack>
        ) : (
          <Table data={data.accessRows} columns={accessColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
        )}
      </Section>
    </AppFrame>
  );
}
