import { Badge } from "@astryxdesign/core/Badge";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";

import { AppFrame } from "./console-frame";
import { LinkButton } from "./console/link-button";
import { OverviewTiles } from "./console/overview-tiles";
import { PageHeader } from "./page-header";
import { auditColumns, networkAccessColumns } from "@/lib/console-columns";
import { buildConsoleData } from "@/lib/console-rows";
import { loadFusionStore } from "@/lib/fusion-view";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const data = buildConsoleData(await loadFusionStore());
  const { counts } = data;

  const tiles = [
    { label: "站点", value: counts.sites, description: "网络命名空间", icon: "sites" as const },
    { label: "受管资产", value: counts.managedAssets, description: "稳定的资产标识", icon: "assets" as const },
    { label: "待导入发现", value: counts.unmanagedDiscoveries, description: "等待管理员审核", icon: "discovery" as const },
    { label: "待审批申请", value: counts.pendingRequests, description: "等待 Teleport 审批", icon: "requests" as const },
    { label: "生效授权", value: counts.activeGrants, description: "受 TTL 约束的临时访问", icon: "grants" as const },
    { label: "有效规则", value: counts.accessRules, description: "编译后的网络规则", icon: "rules" as const },
  ];

  return (
    <AppFrame>
      <PageHeader crumbs={[{ label: "概览" }]} title="概览" description="控制平面的资产、访问与活动状态总览。" />
      <HStack gap={2} vAlign="center" wrap="wrap">
        <StatusDot
          variant={counts.accessRules > 0 ? "success" : "neutral"}
          label={counts.accessRules > 0 ? "编译正常" : "默认拒绝"}
        />
        <Text>{data.policyMessage}</Text>
      </HStack>
      <OverviewTiles tiles={tiles} />
      <Section padding={0}>
        <VStack gap={3} padding={4}>
          <HStack hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={2} vAlign="center">
              <Heading level={2}>网络访问事件</Heading>
              <Badge label={data.networkAccessRows.length} />
            </HStack>
            <LinkButton label="查看全部" href="/audit" />
          </HStack>
          <Text color="secondary">数据平面上报的最近连接决策。</Text>
        </VStack>
        {data.networkAccessRows.length === 0 ? (
          <VStack padding={4} paddingBlockStart={0}>
            <EmptyState title="暂无网络访问事件" description="数据平面上报连接事件后，将在此显示策略决策。" isCompact />
          </VStack>
        ) : (
          <Table
            data={data.networkAccessRows.slice(0, 8)}
            columns={networkAccessColumns}
            density="compact"
            dividers="rows"
            hasHover
            idKey="id"
            textOverflow="truncate"
          />
        )}
      </Section>
      <Section padding={0}>
        <VStack gap={3} padding={4}>
          <HStack hAlign="between" vAlign="center" wrap="wrap">
            <HStack gap={2} vAlign="center">
              <Heading level={2}>控制平面变更</Heading>
              <Badge label={data.auditRows.length} />
            </HStack>
            <LinkButton label="查看全部" href="/audit" />
          </HStack>
          <Text color="secondary">最近的控制平面和 Teleport 状态变更。</Text>
        </VStack>
        {data.auditRows.length === 0 ? (
          <VStack padding={4} paddingBlockStart={0}>
            <EmptyState title="暂无控制平面变更" description="成功的控制平面和 Teleport 变更会记录在这里。" isCompact />
          </VStack>
        ) : (
          <Table
            data={data.auditRows.slice(0, 8)}
            columns={auditColumns}
            density="compact"
            dividers="rows"
            hasHover
            idKey="id"
            textOverflow="truncate"
          />
        )}
      </Section>
    </AppFrame>
  );
}

