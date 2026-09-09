import { AppShell } from "@astryxdesign/core/AppShell";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Section } from "@astryxdesign/core/Section";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { proportional, Table } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";

import { AccessRequestForm } from "./access-request-form";
import { FusionStore } from "@/lib/fusion";
import { fusionRepository } from "@/lib/fusion-repository";

export const dynamic = "force-dynamic";

interface AssetRow extends Record<string, unknown> {
  id: string;
  name: string;
  site: string;
  routerGroup: string;
  endpoint: string;
  networkResource: string;
  services: string;
  status: string;
}

interface AccessRow extends Record<string, unknown> {
  id: string;
  source: string;
  requestId: string;
  subject: string;
  devicePeer: string;
  scope: string;
  asset: string;
  destination: string;
  service: string;
  routerPeers: string;
  expires: string;
}

interface DiscoveryRow extends Record<string, unknown> {
  id: string;
  site: string;
  endpoint: string;
  source: string;
  discovered: string;
  status: string;
}

interface AuditRow extends Record<string, unknown> {
  id: string;
  occurred: string;
  action: string;
  origin: string;
  resource: string;
  details: string;
}

interface RequestRow extends Record<string, unknown> {
  id: string;
  subject: string;
  devicePeer: string;
  scope: string;
  target: string;
  validUntil: string;
  status: string;
}

interface NetworkAccessRow extends Record<string, unknown> {
  id: string;
  occurred: string;
  decision: string;
  user: string;
  device: string;
  request: string;
  reviewer: string;
  grant: string;
  target: string;
  router: string;
}

interface DeviceRow extends Record<string, unknown> {
  id: string;
  name: string;
  subject: string;
  peer: string;
  netbirdGroup: string;
  status: string;
}

const scopeLabels: Record<string, string> = {
  site: "站点",
  asset: "资产",
  service: "服务",
};

const discoverySourceLabels: Record<string, string> = {
  manual: "手动录入",
  arp: "ARP 邻居发现",
  dhcp: "DHCP",
  dns: "DNS",
  mdns: "mDNS",
  cloud: "云服务",
  cmdb: "CMDB",
  agent_scan: "代理扫描",
};

const auditActionLabels: Record<string, string> = {
  "site.created": "站点已创建",
  "router_group.created": "路由器组已创建",
  "device.created": "设备已创建",
  "asset.created": "资产已创建",
  "asset.updated": "资产已更新",
  "asset.deleted": "资产已删除",
  "endpoint.created": "端点已创建",
  "network_resource.desired": "网络资源待同步",
  "network_resource.synced": "网络资源已同步",
  "network_resource.sync_failed": "网络资源同步失败",
  "service.created": "服务已创建",
  "service.updated": "服务已更新",
  "service.deleted": "服务已删除",
  "static_permission.created": "静态权限已创建",
  "static_permission.deleted": "静态权限已删除",
  "access_request.created": "访问申请已创建",
  "access_grant.created": "访问授权已创建",
  "access_grant.revoked": "访问授权已撤销",
  "access_grant.deleted": "访问授权已删除",
  "access_grant.expired": "访问授权已过期",
  "discovery.created": "发现记录已创建",
  "discovery.imported": "发现记录已导入",
  "network_policy.synced": "网络策略已同步",
  "network_policy.sync_failed": "网络策略同步失败",
};

const auditResourceLabels: Record<string, string> = {
  site: "站点",
  router_group: "路由器组",
  device: "设备",
  asset: "资产",
  endpoint: "端点",
  network_resource: "网络资源",
  service: "服务",
  static_permission: "静态权限",
  access_grant: "访问授权",
  access_request: "访问申请",
  discovery: "发现记录",
  network_policy: "网络策略",
};

const auditDetailLabels: Record<string, string> = {
  networkId: "网络 ID",
  siteId: "站点 ID",
  peerId: "对等节点 ID",
  assetId: "资产 ID",
  destination: "目标地址",
  source: "来源",
  scope: "范围",
  subjectId: "主体 ID",
  devicePeerId: "设备对等节点 ID",
  requestId: "请求 ID",
  netbirdResourceId: "NetBird 资源 ID",
  routerGroupId: "路由器组 ID",
  ruleCount: "规则数",
};

function labelFrom(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

function auditDetail(key: string, value: string): string {
  const translatedValue = key === "scope" ? labelFrom(scopeLabels, value) : key === "source" ? labelFrom(discoverySourceLabels, value) : value;
  return `${labelFrom(auditDetailLabels, key)}=${translatedValue}`;
}

const columns: TableColumn<AssetRow>[] = [
  { key: "name", header: "资产", width: proportional(1) },
  { key: "site", header: "站点", width: proportional(1) },
  { key: "routerGroup", header: "路由器组", width: proportional(1) },
  { key: "endpoint", header: "端点", width: proportional(1) },
  { key: "networkResource", header: "网络资源", width: proportional(1) },
  { key: "services", header: "可暴露服务", width: proportional(2) },
  { key: "status", header: "状态", width: proportional(1) },
];

const accessColumns: TableColumn<AccessRow>[] = [
  { key: "source", header: "授权来源", width: proportional(1) },
  { key: "requestId", header: "请求", width: proportional(1) },
  { key: "subject", header: "主体", width: proportional(1) },
  { key: "devicePeer", header: "设备对等节点", width: proportional(1) },
  { key: "scope", header: "范围", width: proportional(1) },
  { key: "asset", header: "资产", width: proportional(1) },
  { key: "destination", header: "目标地址", width: proportional(1) },
  { key: "service", header: "获准服务", width: proportional(1) },
  { key: "routerPeers", header: "路由器对等节点", width: proportional(2) },
  { key: "expires", header: "过期时间", width: proportional(1) },
];

const discoveryColumns: TableColumn<DiscoveryRow>[] = [
  { key: "site", header: "站点", width: proportional(1) },
  { key: "endpoint", header: "观测端点", width: proportional(2) },
  { key: "source", header: "来源", width: proportional(1) },
  { key: "discovered", header: "发现时间", width: proportional(1) },
  { key: "status", header: "审核状态", width: proportional(2) },
];

const auditColumns: TableColumn<AuditRow>[] = [
  { key: "occurred", header: "发生时间", width: proportional(1) },
  { key: "action", header: "操作", width: proportional(1) },
  { key: "origin", header: "来源", width: proportional(1) },
  { key: "resource", header: "资源", width: proportional(2) },
  { key: "details", header: "详情", width: proportional(2) },
];

const requestColumns: TableColumn<RequestRow>[] = [
  { key: "subject", header: "主体", width: proportional(1) },
  { key: "devicePeer", header: "设备对等节点", width: proportional(1) },
  { key: "scope", header: "范围", width: proportional(1) },
  { key: "target", header: "目标", width: proportional(2) },
  { key: "validUntil", header: "有效期至", width: proportional(1) },
  { key: "status", header: "状态", width: proportional(1) },
];

const networkAccessColumns: TableColumn<NetworkAccessRow>[] = [
  { key: "occurred", header: "开始时间", width: proportional(1) },
  { key: "decision", header: "决策", width: proportional(1) },
  { key: "user", header: "用户", width: proportional(1) },
  { key: "device", header: "设备", width: proportional(1) },
  { key: "request", header: "Teleport 请求", width: proportional(1) },
  { key: "reviewer", header: "审批人", width: proportional(1) },
  { key: "grant", header: "访问授权", width: proportional(1) },
  { key: "target", header: "资产 / 服务 / 目标地址", width: proportional(2) },
  { key: "router", header: "路由器对等节点", width: proportional(1) },
];

const deviceColumns: TableColumn<DeviceRow>[] = [
  { key: "name", header: "设备", width: proportional(1) },
  { key: "subject", header: "主体", width: proportional(1) },
  { key: "peer", header: "NetBird 对等节点", width: proportional(1) },
  { key: "netbirdGroup", header: "专用组", width: proportional(2) },
  { key: "status", header: "注册状态", width: proportional(1) },
];

export default async function Home() {
  const fusionStore = FusionStore.fromState(
    await fusionRepository.mutate((store) => {
      store.listAccessGrants();
      return store.exportState();
    }),
  );
  const sites = fusionStore.listSites();
  const routerGroups = fusionStore.listRouterGroups();
  const assets = fusionStore.listAssets();
  const resources = fusionStore.listNetworkResources();
  const permissions = fusionStore.listStaticAssetPermissions();
  const grants = fusionStore.listAccessGrants();
  const accessRequests = fusionStore.listAccessRequests();
  const devices = fusionStore.listDevices();
  const discoveries = fusionStore.listDiscoveredAssets();
  const auditEvents = fusionStore.listAuditEvents();
  const networkAccessEvents = fusionStore.listNetworkAccessEvents();
  const activeGrants = grants.filter((grant) => grant.status === "active");
  const mapAuthorization = permissions[0] ?? activeGrants[0];
  const networkMap =
    mapAuthorization === undefined
      ? undefined
      : fusionStore.getEffectiveNetworkMap(mapAuthorization.devicePeerId, mapAuthorization.subjectId);
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  const routerGroupNames = new Map(routerGroups.map((routerGroup) => [routerGroup.id, routerGroup.name]));
  const assetNames = new Map(assets.map((asset) => [asset.id, asset.name]));
  const rows: AssetRow[] = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    site: siteNames.get(asset.siteId) ?? asset.siteId,
    routerGroup: routerGroupNames.get(asset.routerGroupId) ?? asset.routerGroupId,
    endpoint: asset.endpoints.map((endpoint) => endpoint.address).join(", ") || "无端点",
    networkResource: asset.endpoints.map((endpoint) => endpoint.networkResource.destination).join(", ") || "未编译",
    services:
      asset.services
        .filter((service) => service.exposable)
        .map((service) => `${service.name} ${service.protocol.toUpperCase()}/${service.port}`)
        .join(", ") || "无可暴露服务",
    status: asset.status === "managed" ? "受管" : "已禁用",
  }));
  const discoveryRows: DiscoveryRow[] = discoveries.map((discovered) => ({
    id: discovered.id,
    site: siteNames.get(discovered.siteId) ?? discovered.siteId,
    endpoint: `${discovered.type.toUpperCase()} ${discovered.address}`,
    source: labelFrom(discoverySourceLabels, discovered.source),
    discovered: discovered.discoveredAt,
    status:
      discovered.status === "unmanaged"
        ? "未受管：尚无资产、网络资源或授权"
        : `已导入为 ${assetNames.get(discovered.importedAssetId ?? "") ?? discovered.importedAssetId ?? "未知资产"}`,
  }));
  const auditRows: AuditRow[] = auditEvents.map((event) => ({
    id: event.id,
    occurred: event.occurredAt,
    action: labelFrom(auditActionLabels, event.action),
    origin: event.origin === "teleport" ? "Teleport" : "控制平面",
    resource: `${labelFrom(auditResourceLabels, event.resourceType)} ${event.resourceId}`,
    details: Object.entries(event.details)
      .map(([key, value]) => auditDetail(key, value))
      .join(" "),
  }));
  const requestRows: RequestRow[] = accessRequests.map((request) => ({
    id: request.id,
    subject: request.subjectId,
    devicePeer: request.devicePeerId,
    scope: labelFrom(scopeLabels, request.scope),
    target:
      request.scope === "site"
        ? siteNames.get(request.siteId) ?? request.siteId
          : request.scope === "asset"
           ? assetNames.get(request.assetId ?? "") ?? request.assetId ?? "未知资产"
           : `${assetNames.get(request.assetId ?? "") ?? request.assetId ?? "未知资产"} / ${assets
               .flatMap((asset) => asset.services)
               .find((service) => service.id === request.serviceId)?.name ?? request.serviceId ?? "未知服务"}`,
    validUntil: request.validUntil,
    status: "等待审批",
  }));
  const networkAccessRows: NetworkAccessRow[] = networkAccessEvents.map((event) => {
    const service = assets.flatMap((asset) => asset.services).find((candidate) => candidate.id === event.serviceId);
    const asset = assetNames.get(event.assetId ?? "") ?? event.assetId ?? "未知资产";

    return {
      id: event.id,
      occurred: event.startedAt,
      decision: event.decision === "allow" ? "允许" : "拒绝",
      user: event.userId,
      device: event.deviceId,
      request: event.requestId ?? "不适用",
      reviewer: event.reviewerId ?? "不适用",
      grant: event.grantId ?? "静态策略或已拒绝",
      target: `${asset} / ${service?.name ?? "未知服务"} / ${event.destination}:${event.port}`,
      router: event.routerPeerId,
    };
  });
  const deviceRows: DeviceRow[] = devices.map((device) => ({
    id: device.id,
    name: device.name,
    subject: device.subjectId,
    peer: device.peerId,
    netbirdGroup: device.netbirdGroupId,
    status: device.managed ? "受管" : "未受管",
  }));
  const accessRows: AccessRow[] = [
    ...permissions.flatMap((permission) =>
      fusionStore.getCompiledAccessForPermission(permission.id).map((access) => ({
        id: access.id,
        source: "静态权限",
        requestId: "不适用",
        subject: access.subjectId,
        devicePeer: access.devicePeerId,
        scope: labelFrom(scopeLabels, access.scope),
        asset: assetNames.get(access.assetId) ?? access.assetId,
        destination: access.destination,
        service: `${access.protocol.toUpperCase()}/${access.ports.join(", ")}`,
        routerPeers: access.routerPeerIds.join(", "),
        expires: "永不过期",
      })),
    ),
    ...activeGrants.flatMap((grant) =>
      fusionStore.getCompiledAccessForGrant(grant.id).map((access) => ({
        id: access.id,
        source: grant.source === "teleport" ? "Teleport 授权" : "访问授权",
        requestId: access.requestId ?? "手动创建",
        subject: access.subjectId,
        devicePeer: access.devicePeerId,
        scope: labelFrom(scopeLabels, access.scope),
        asset: assetNames.get(access.assetId) ?? access.assetId,
        destination: access.destination,
        service: `${access.protocol.toUpperCase()}/${access.ports.join(", ")}`,
        routerPeers: access.routerPeerIds.join(", "),
        expires: access.validUntil ?? "永不过期",
      })),
    ),
  ];
  const policyStatus = accessRows.length > 0 ? "success" : "neutral";
  const policyMessage =
    permissions.length === 0 && activeGrants.length === 0
      ? "不存在静态权限或有效的 AccessGrant。所有设备对等节点默认拒绝。"
      : accessRows.length === 0
        ? "存在授权，但无法编译出任何受管且可通过 NetBird 暴露的服务。"
        : `${accessRows.length} 条有效规则由静态权限和有效 AccessGrant 编译而成。`;

  return (
    <AppShell
      contentPadding={4}
      height="auto"
      mobileNav={{ breakpoint: "md" }}
      sideNav={
        <SideNav
          collapsible
          header={<SideNavHeading heading="Fusion 控制" superheading="ZTNA / PAM" headingHref="/" />}>
          <SideNavSection title="控制平面" isHeaderHidden>
            <SideNavItem label="资产" href="/" isSelected />
            <SideNavItem label="发现审核" href="#discovery" />
            <SideNavItem label="设备" href="#devices" />
            <SideNavItem label="站点" href="#sites" />
            <SideNavItem label="路由器组" href="#router-groups" />
          </SideNavSection>
          <SideNavSection title="访问生命周期">
            <SideNavItem label="资产权限" href="#asset-permissions" />
            <SideNavItem label="申请访问" href="#request-access" />
            <SideNavItem label="访问授权" href="#effective-access" />
            <SideNavItem label="统一审计" href="#audit" />
          </SideNavSection>
        </SideNav>
      }
      variant="section">
      <VStack gap={6}>
        <VStack gap={2}>
          <Heading level={1}>资产登记</Heading>
          <Text color="secondary">
            将可通过路由器对等节点到达的设备建模为稳定资产，再将每个端点编译为限定范围的网络资源。
          </Text>
          <HStack gap={2} vAlign="center">
            <StatusDot variant="accent" label="资产层已启用" />
            <Text type="supporting">静态权限与有效 AccessGrant 会一同编译。未匹配的设备对等节点仍默认拒绝。</Text>
          </HStack>
        </VStack>

        <HStack gap={3} wrap="wrap">
          <Card>
            <VStack gap={1}>
              <Text type="supporting">站点</Text>
              <Heading level={2}>{sites.length}</Heading>
              <Text color="secondary">网络命名空间</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">受管资产</Text>
              <Heading level={2}>{assets.filter((asset) => asset.status === "managed").length}</Heading>
              <Text color="secondary">稳定的资产标识</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">未受管发现</Text>
              <Heading level={2}>{discoveries.filter((discovered) => discovered.status === "unmanaged").length}</Heading>
              <Text color="secondary">等待管理员导入</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">待同步资源</Text>
              <Heading level={2}>{resources.length}</Heading>
              <Text color="secondary">等待 NetBird 同步</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">静态权限</Text>
              <Heading level={2}>{permissions.length}</Heading>
              <Text color="secondary">主体与设备绑定</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">受管设备</Text>
              <Heading level={2}>{devices.filter((device) => device.managed).length}</Heading>
              <Text color="secondary">可接受 NetBird 强制执行</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">有效访问授权</Text>
              <Heading level={2}>{activeGrants.length}</Heading>
              <Text color="secondary">受 TTL 约束的临时访问</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">待审批访问申请</Text>
              <Heading level={2}>{accessRequests.length}</Heading>
              <Text color="secondary">等待审批，尚未授权</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={1}>
              <Text type="supporting">有效网络映射</Text>
              <Heading level={2}>{networkMap?.accessRules.length ?? 0}</Heading>
              <Text color="secondary">
                {networkMap === undefined
                  ? "等待设备绑定的授权"
                  : `版本 ${networkMap.revision.slice(0, 12)}`}
              </Text>
            </VStack>
          </Card>
        </HStack>

        <Section id="sites" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>资产清单</Heading>
              <Text color="secondary">
                资产按站点分组，并先经由路由器组解析，再将每个端点编译为网络资源。
              </Text>
            </VStack>
          </VStack>
          {rows.length === 0 ? (
            <EmptyState title="暂无资产" description="请先通过管理 API 创建资产，或导入发现记录。" isCompact />
          ) : (
            <Table data={rows} columns={columns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
          )}
        </Section>

        <Section id="discovery" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>发现审核</Heading>
              <Text color="secondary">
                发现记录只是观测结果，并非可信资产。管理员必须显式导入记录，其端点才会成为网络资源。
              </Text>
            </VStack>
            <HStack gap={2} vAlign="center">
              <StatusDot variant="neutral" label="发现不会创建授权" />
              <Text type="supporting">导入不会创建权限或 AccessGrant。</Text>
            </HStack>
          </VStack>
          {discoveryRows.length === 0 ? (
            <EmptyState title="暂无发现记录" description="暂未收到待审核的资产发现结果。" isCompact />
          ) : (
            <Table
              data={discoveryRows}
              columns={discoveryColumns}
              density="compact"
              dividers="rows"
              hasHover
              idKey="id"
              textOverflow="truncate"
            />
          )}
        </Section>

        <Section id="devices" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>设备注册</Heading>
              <Text color="secondary">
                每项直接网络授权都将一个主体和受管设备绑定到已有的单对等节点 NetBird 组。Fusion 会在强制执行前验证该组。
              </Text>
            </VStack>
          </VStack>
          {deviceRows.length === 0 ? (
            <EmptyState title="暂无已注册设备" description="注册受管设备后，才能申请和执行网络访问授权。" isCompact />
          ) : (
            <Table
              data={deviceRows}
              columns={deviceColumns}
              density="compact"
              dividers="rows"
              hasHover
              idKey="id"
              textOverflow="truncate"
            />
          )}
        </Section>

        <Section id="request-access" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>申请访问</Heading>
              <Text color="secondary">
                为一台设备申请站点、资产或精确服务，并设置有限 TTL。提交只会记录待审批申请；必须由 Teleport 审批创建 AccessGrant 后，网络规则才会生效。
              </Text>
            </VStack>
            <AccessRequestForm
              sites={sites.map((site) => ({ id: site.id, name: site.name }))}
              assets={assets
                .filter((asset) => asset.status === "managed")
                .map((asset) => ({
                  id: asset.id,
                  siteId: asset.siteId,
                  name: asset.name,
                  services: asset.services.map((service) => ({
                    id: service.id,
                    name: service.name,
                    protocol: service.protocol,
                    port: service.port,
                    accessMethod: service.accessMethod,
                    exposable: service.exposable,
                  })),
                }))}
              devices={devices.map((device) => ({
                id: device.id,
                name: device.name,
                subjectId: device.subjectId,
                peerId: device.peerId,
                managed: device.managed,
              }))}
            />
          </VStack>
          {requestRows.length === 0 ? (
            <EmptyState title="暂无访问申请" description="提交申请后，会在此等待 Teleport 审批。" isCompact />
          ) : (
            <Table data={requestRows} columns={requestColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
          )}
        </Section>

        <Section id="effective-access" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>有效资产访问权限</Heading>
              <Text color="secondary">
                静态权限与有效 AccessGrant 共用同一个编译器。Teleport 授权会保留请求 ID。资产范围会编译已暴露的 NetBird 服务；服务范围会编译一个精确的协议和端口。由 Teleport 管理的服务不会生成直接网络规则。
              </Text>
            </VStack>
            <HStack gap={2} vAlign="center">
              <StatusDot variant={policyStatus} label={policyMessage} />
              <Text type="supporting">{policyMessage}</Text>
            </HStack>
          </VStack>
          {accessRows.length === 0 ? (
            <EmptyState title="暂无有效访问权限" description="创建静态权限或获批的 AccessGrant 后，规则会显示在这里。" isCompact />
          ) : (
            <Table
              data={accessRows}
              columns={accessColumns}
              density="compact"
              dividers="rows"
              hasHover
              idKey="id"
              textOverflow="truncate"
            />
          )}
        </Section>

        <Section id="audit" padding={0}>
          <VStack gap={3} padding={4}>
            <VStack gap={1}>
              <Heading level={2}>统一审计</Heading>
              <Text color="secondary">
                网络决策会保留用户、设备、访问授权、Teleport 请求、目标地址、服务和路由器对等节点上下文，同时提供控制平面状态变更记录。
              </Text>
            </VStack>
          </VStack>
          <VStack gap={2} padding={4}>
            <Heading level={3}>网络访问事件</Heading>
            <Text type="supporting">上报时会根据当前有效策略重新计算允许或拒绝结果。</Text>
          </VStack>
          {networkAccessRows.length === 0 ? (
            <EmptyState title="暂无网络访问事件" description="数据平面上报连接事件后，将在此显示策略决策。" isCompact />
          ) : (
            <Table
              data={networkAccessRows}
              columns={networkAccessColumns}
              density="compact"
              dividers="rows"
              hasHover
              idKey="id"
              textOverflow="truncate"
            />
          )}
          <VStack gap={2} padding={4}>
            <Heading level={3}>控制平面变更</Heading>
            <Text type="supporting">成功的控制平面和 Teleport 状态变更按最新优先保留。</Text>
          </VStack>
          {auditRows.length === 0 ? (
            <EmptyState title="暂无控制平面变更" description="成功的控制平面和 Teleport 变更会记录在这里。" isCompact />
          ) : (
            <Table data={auditRows} columns={auditColumns} density="compact" dividers="rows" hasHover idKey="id" textOverflow="truncate" />
          )}
        </Section>

        <Section id="asset-permissions" variant="transparent">
          <VStack gap={1}>
            <Heading level={2}>静态权限边界</Heading>
            <Text color="secondary">
              静态权限永不过期。对于由审批支持的临时访问，请通过管理 API 创建带有请求 ID、原因和 `validUntil` 的 AccessGrant。
            </Text>
          </VStack>
        </Section>

        <Section id="router-groups" variant="muted">
          <VStack gap={2}>
            <Heading level={2}>NetBird 资源边界</Heading>
            <Text>
              IPv4 端点编译为 `/32`，IPv6 端点编译为 `/128`，DNS 端点保留其域名目标。目标状态按站点、网络和路由器组划分命名空间，因此地址永远不会被当作资产标识。
            </Text>
            <Text color="secondary">
              `/api/network-map` 会生成设备专属的授权版本。在配置管理 API 凭据和目标账户前，不会创建远端 NetBird 资源。
            </Text>
          </VStack>
        </Section>
      </VStack>
    </AppShell>
  );
}
