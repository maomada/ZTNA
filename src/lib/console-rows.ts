import type { FusionStore } from "./fusion";

export interface AssetRow extends Record<string, unknown> {
  id: string;
  name: string;
  site: string;
  routerGroup: string;
  endpoint: string;
  networkResource: string;
  services: string;
  status: string;
}

export interface DiscoveryRow extends Record<string, unknown> {
  id: string;
  site: string;
  endpoint: string;
  source: string;
  discovered: string;
  statusKey: "unmanaged" | "imported";
  status: string;
  suggestedName: string;
  hostname?: string;
}

export interface DeviceRow extends Record<string, unknown> {
  id: string;
  name: string;
  subject: string;
  peer: string;
  netbirdGroup: string;
  status: string;
}

export interface SiteListItem {
  id: string;
  name: string;
  networkId: string;
  description: string;
}

export interface RouterGroupListItem {
  id: string;
  name: string;
  site: string;
  peerIds: string[];
  netbirdGroupId?: string;
}

export interface PermissionRow extends Record<string, unknown> {
  id: string;
  subject: string;
  devicePeer: string;
  asset: string;
  scope: string;
  service: string;
  createdAt: string;
}

export interface RequestRow extends Record<string, unknown> {
  id: string;
  reason: string;
  subject: string;
  devicePeer: string;
  scope: string;
  target: string;
  validUntil: string;
}

export interface GrantRow extends Record<string, unknown> {
  id: string;
  source: string;
  subject: string;
  devicePeer: string;
  scope: string;
  target: string;
  validUntil: string;
  status: string;
  canRevoke: boolean;
}

export interface AccessRow extends Record<string, unknown> {
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

export interface AuditRow extends Record<string, unknown> {
  id: string;
  occurred: string;
  action: string;
  origin: string;
  resource: string;
  details: string;
}

export interface NetworkAccessRow extends Record<string, unknown> {
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

export function buildConsoleData(store: FusionStore) {
  const sites = store.listSites();
  const routerGroups = store.listRouterGroups();
  const assets = store.listAssets();
  const permissions = store.listStaticAssetPermissions();
  const grants = store.listAccessGrants();
  const accessRequests = store.listAccessRequests();
  const devices = store.listDevices();
  const discoveries = store.listDiscoveredAssets();

  const activeGrants = grants.filter((grant) => grant.status === "active");
  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  const routerGroupNames = new Map(routerGroups.map((routerGroup) => [routerGroup.id, routerGroup.name]));
  const assetNames = new Map(assets.map((asset) => [asset.id, asset.name]));
  const serviceNames = new Map(assets.flatMap((asset) => asset.services).map((service) => [service.id, service.name]));

  const assetRows: AssetRow[] = assets.map((asset) => ({
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
    statusKey: discovered.status,
    status:
      discovered.status === "imported"
        ? `已导入为 ${assetNames.get(discovered.importedAssetId ?? "") ?? discovered.importedAssetId ?? "未知资产"}`
        : "未受管，等待管理员导入",
    suggestedName: discovered.hostname ?? discovered.address,
    hostname: discovered.hostname,
  }));

  const deviceRows: DeviceRow[] = devices.map((device) => ({
    id: device.id,
    name: device.name,
    subject: device.subjectId,
    peer: device.peerId,
    netbirdGroup: device.netbirdGroupId,
    status: device.managed ? "受管" : "未受管",
  }));

  const siteListItems: SiteListItem[] = sites.map((site) => ({
    id: site.id,
    name: site.name,
    networkId: site.networkId,
    description: site.description,
  }));

  const routerGroupListItems: RouterGroupListItem[] = routerGroups.map((routerGroup) => ({
    id: routerGroup.id,
    name: routerGroup.name,
    site: siteNames.get(routerGroup.siteId) ?? routerGroup.siteId,
    peerIds: routerGroup.peerIds,
    netbirdGroupId: routerGroup.netbirdGroupId,
  }));

  const permissionRows: PermissionRow[] = permissions.map((permission) => ({
    id: permission.id,
    subject: permission.subjectId,
    devicePeer: permission.devicePeerId,
    asset: assetNames.get(permission.assetId) ?? permission.assetId,
    scope: labelFrom(scopeLabels, permission.scope),
    service: permission.serviceId === undefined ? "全部已暴露服务" : serviceNames.get(permission.serviceId) ?? permission.serviceId,
    createdAt: permission.createdAt,
  }));

  const requestRows: RequestRow[] = accessRequests.map((request) => ({
    id: request.id,
    reason: request.reason,
    subject: request.subjectId,
    devicePeer: request.devicePeerId,
    scope: labelFrom(scopeLabels, request.scope),
    target:
      request.scope === "site"
        ? siteNames.get(request.siteId) ?? request.siteId
        : request.scope === "asset"
          ? assetNames.get(request.assetId ?? "") ?? request.assetId ?? "未知资产"
          : `${assetNames.get(request.assetId ?? "") ?? request.assetId ?? "未知资产"} / ${serviceNames.get(request.serviceId ?? "") ?? request.serviceId ?? "未知服务"}`,
    validUntil: request.validUntil,
  }));

  const grantRows: GrantRow[] = grants.map((grant) => ({
    id: grant.id,
    source: grant.source === "teleport" ? "Teleport" : "手动创建",
    subject: grant.subjectId,
    devicePeer: grant.devicePeerId,
    scope: labelFrom(scopeLabels, grant.scope),
    target:
      grant.scope === "site"
        ? siteNames.get(grant.siteId) ?? grant.siteId
        : grant.assetIds.map((assetId) => assetNames.get(assetId) ?? assetId).join(", ") || "未知资产",
    validUntil: grant.validUntil,
    status: grant.status === "active" ? "生效中" : grant.status === "revoked" ? "已撤销" : "已过期",
    canRevoke: grant.status === "active",
  }));

  const accessRows: AccessRow[] = [
    ...permissions.flatMap((permission) =>
      store.getCompiledAccessForPermission(permission.id).map((access) => ({
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
      store.getCompiledAccessForGrant(grant.id).map((access) => ({
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

  const auditRows: AuditRow[] = store.listAuditEvents().map((event) => ({
    id: event.id,
    occurred: event.occurredAt,
    action: labelFrom(auditActionLabels, event.action),
    origin: event.origin === "teleport" ? "Teleport" : "控制平面",
    resource: `${labelFrom(auditResourceLabels, event.resourceType)} ${event.resourceId}`,
    details: Object.entries(event.details)
      .map(([key, value]) => auditDetail(key, value))
      .join(" "),
  }));

  const networkAccessRows: NetworkAccessRow[] = store.listNetworkAccessEvents().map((event) => {
    const service = serviceNames.get(event.serviceId ?? "") ?? "未知服务";
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
      target: `${asset} / ${service} / ${event.destination}:${event.port}`,
      router: event.routerPeerId,
    };
  });

  const siteOptions = sites.map((site) => ({ id: site.id, name: site.name }));
  const routerGroupOptions = routerGroups.map((routerGroup) => ({ id: routerGroup.id, siteId: routerGroup.siteId, name: routerGroup.name }));
  const deviceOptions = devices.map((device) => ({
    id: device.id,
    name: device.name,
    subjectId: device.subjectId,
    peerId: device.peerId,
    managed: device.managed,
  }));
  const managedAssetOptions = assets
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
    }));

  const policyMessage =
    permissions.length === 0 && activeGrants.length === 0
      ? "不存在静态权限或有效的 AccessGrant，所有设备对等节点默认拒绝。"
      : accessRows.length === 0
        ? "存在授权，但无法编译出任何受管且可通过 NetBird 暴露的服务。"
        : `${accessRows.length} 条有效规则由静态权限和有效 AccessGrant 编译而成。`;

  return {
    counts: {
      sites: sites.length,
      managedAssets: assets.filter((asset) => asset.status === "managed").length,
      unmanagedDiscoveries: discoveries.filter((discovered) => discovered.status === "unmanaged").length,
      pendingRequests: accessRequests.length,
      activeGrants: activeGrants.length,
      managedDevices: devices.filter((device) => device.managed).length,
      accessRules: accessRows.length,
      events: networkAccessRows.length,
    },
    assetRows,
    assetDetails: assets,
    discoveryRows,
    deviceRows,
    siteListItems,
    routerGroupListItems,
    permissionRows,
    requestRows,
    grantRows,
    accessRows,
    auditRows,
    networkAccessRows,
    siteOptions,
    routerGroupOptions,
    deviceOptions,
    managedAssetOptions,
    policyMessage,
  };
}

export type ConsoleData = ReturnType<typeof buildConsoleData>;
