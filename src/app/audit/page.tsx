import { Badge } from "@astryxdesign/core/Badge";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Table } from "@astryxdesign/core/Table";
import { Heading } from "@astryxdesign/core/Heading";

import { AppFrame } from "../console-frame";
import { PageHeader } from "../page-header";
import { auditColumns, networkAccessColumns } from "@/lib/console-columns";
import { buildConsoleData } from "@/lib/console-rows";
import { loadFusionStore } from "@/lib/fusion-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "统一审计 · Fusion 控制平面" };

export default async function AuditPage() {
  const data = buildConsoleData(await loadFusionStore());

  return (
    <AppFrame>
      <PageHeader
        crumbs={[{ label: "Fusion", href: "/" }, { label: "统一审计" }]}
        title="统一审计"
        description="网络决策保留用户、设备、授权、请求和目标上下文；控制平面变更按最新优先保留。"
      />
      <Section padding={0}>
        <VStack gap={3} padding={4}>
          <HStack gap={2} vAlign="center">
            <Heading level={2}>网络访问事件</Heading>
            <Badge label={data.networkAccessRows.length} />
          </HStack>
        </VStack>
        {data.networkAccessRows.length === 0 ? (
          <VStack padding={4} paddingBlockStart={0}>
            <EmptyState title="暂无网络访问事件" description="数据平面上报连接事件后，将在此显示策略决策。" isCompact />
          </VStack>
        ) : (
          <Table data={data.networkAccessRows} columns={networkAccessColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
        )}
      </Section>
      <Section padding={0}>
        <VStack gap={3} padding={4}>
          <HStack gap={2} vAlign="center">
            <Heading level={2}>控制平面变更</Heading>
            <Badge label={data.auditRows.length} />
          </HStack>
        </VStack>
        {data.auditRows.length === 0 ? (
          <VStack padding={4} paddingBlockStart={0}>
            <EmptyState title="暂无控制平面变更" description="成功的控制平面和 Teleport 变更会记录在这里。" isCompact />
          </VStack>
        ) : (
          <Table data={data.auditRows} columns={auditColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
        )}
      </Section>
    </AppFrame>
  );
}
