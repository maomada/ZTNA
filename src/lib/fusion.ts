import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

import { compileAccessGrant, compileStaticAssetPermission } from "./policy";

export type EndpointType = "ipv4" | "ipv6" | "dns";
export type AssetStatus = "managed" | "disabled";
export type DiscoverySource = "manual" | "arp" | "dhcp" | "dns" | "mdns" | "cloud" | "cmdb" | "agent_scan";
export type DiscoveryStatus = "unmanaged" | "imported";
export type ServiceProtocol = "tcp" | "udp";
export type GrantScope = "site" | "asset" | "service";
export type AccessGrantStatus = "active" | "revoked" | "expired";
export type AccessGrantSource = "manual" | "teleport";
export type AccessRequestStatus = "pending";
export type AccessMethod =
  | "netbird"
  | "teleport"
  | "teleport_database"
  | "teleport_ssh"
  | "teleport_kubernetes"
  | "teleport_application"
  | "teleport_rdp";

export interface Site {
  id: string;
  name: string;
  description: string;
  networkId: string;
  labels: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface RouterGroup {
  id: string;
  siteId: string;
  name: string;
  peerIds: string[];
  netbirdGroupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  name: string;
  subjectId: string;
  peerId: string;
  netbirdGroupId: string;
  managed: boolean;
  labels: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  siteId: string;
  routerGroupId: string;
  name: string;
  hostname?: string;
  labels: Record<string, string>;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Endpoint {
  id: string;
  assetId: string;
  address: string;
  type: EndpointType;
  primary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  assetId: string;
  name: string;
  protocol: ServiceProtocol;
  port: number;
  accessMethod: AccessMethod;
  exposable: boolean;
  labels: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkResource {
  id: string;
  siteId: string;
  networkId: string;
  routerGroupId: string;
  assetId: string;
  endpointId: string;
  name: string;
  address: string;
  type: "ip" | "domain";
  destination: string;
  syncState: "desired" | "synced" | "failed";
  netbirdResourceId?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointWithResource extends Endpoint {
  networkResource: NetworkResource;
}

export interface AssetDetail extends Asset {
  endpoints: EndpointWithResource[];
  services: Service[];
}

export interface DiscoveredAsset {
  id: string;
  siteId: string;
  routerGroupId: string;
  address: string;
  type: EndpointType;
  hostname?: string;
  source: DiscoverySource;
  labels: Record<string, string>;
  status: DiscoveryStatus;
  discoveredAt: string;
  importedAssetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  resourceType:
    | "site"
    | "router_group"
    | "device"
    | "asset"
    | "endpoint"
    | "network_resource"
    | "service"
    | "static_permission"
    | "access_grant"
    | "access_request"
    | "discovery"
    | "network_policy";
  resourceId: string;
  origin: "control_plane" | "teleport";
  details: Record<string, string>;
  occurredAt: string;
}

export interface NetworkAccessEvent {
  id: string;
  userId: string;
  deviceId: string;
  grantId?: string;
  requestId?: string;
  reviewerId?: string;
  siteId?: string;
  assetId?: string;
  serviceId?: string;
  routerPeerId: string;
  destination: string;
  protocol: ServiceProtocol;
  port: number;
  startedAt: string;
  endedAt?: string;
  decision: "allow" | "deny";
}

export interface StaticAssetPermission {
  id: string;
  subjectId: string;
  devicePeerId: string;
  assetId: string;
  scope: "asset" | "service";
  serviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessGrant {
  id: string;
  subjectId: string;
  devicePeerId: string;
  scope: GrantScope;
  siteId: string;
  assetIds: string[];
  serviceIds: string[];
  validFrom: string;
  validUntil: string;
  requestId?: string;
  reviewerId?: string;
  source: AccessGrantSource;
  reason: string;
  status: AccessGrantStatus;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequest {
  id: string;
  subjectId: string;
  devicePeerId: string;
  scope: GrantScope;
  siteId: string;
  assetId?: string;
  serviceId?: string;
  reason: string;
  validUntil: string;
  status: AccessRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CompiledAccess {
  id: string;
  source: "static_asset_permission" | "access_grant";
  scope: GrantScope;
  authorizationId: string;
  subjectId: string;
  devicePeerId: string;
  siteId: string;
  assetId: string;
  endpointId: string;
  serviceId: string;
  sourcePeerIds: string[];
  networkId: string;
  destination: string;
  protocol: ServiceProtocol;
  ports: number[];
  routerPeerIds: string[];
  validUntil: string | null;
  requestId?: string;
  reviewerId?: string;
}

export interface EffectiveNetworkMap {
  devicePeerId: string;
  subjectId: string;
  revision: string;
  generatedAt: string;
  accessRules: CompiledAccess[];
}

export interface FusionState {
  sites: Site[];
  routerGroups: RouterGroup[];
  devices: Device[];
  assets: Asset[];
  endpoints: Endpoint[];
  services: Service[];
  networkResources: NetworkResource[];
  staticAssetPermissions: StaticAssetPermission[];
  accessGrants: AccessGrant[];
  accessRequests: AccessRequest[];
  discoveredAssets: DiscoveredAsset[];
  auditEvents: AuditEvent[];
  networkAccessEvents: NetworkAccessEvent[];
}

export class FusionError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 404 | 409 | 422 | 503,
  ) {
    super(message);
    this.name = "FusionError";
  }
}

export function authorizeNetworkAuditIngest(request: Request): void {
  const expected = process.env.NETWORK_AUDIT_INGEST_SECRET;
  if (expected === undefined || expected === "") {
    throw new FusionError("网络审计数据采集尚未配置。", 503);
  }

  const received = request.headers.get("x-network-audit-secret");
  if (received === null) {
    throw new FusionError("网络审计数据采集未获授权。", 401);
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new FusionError("网络审计数据采集未获授权。", 401);
  }
}

function isFusionState(value: unknown): value is FusionState {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const state = value as Record<string, unknown>;
  return [
    "sites",
    "routerGroups",
    "devices",
    "assets",
    "endpoints",
    "services",
    "networkResources",
    "staticAssetPermissions",
    "accessGrants",
    "accessRequests",
    "discoveredAssets",
    "auditEvents",
    "networkAccessEvents",
  ].every((key) => Array.isArray(state[key]));
}

type Input = Record<string, unknown>;

const accessMethods: readonly AccessMethod[] = [
  "netbird",
  "teleport",
  "teleport_database",
  "teleport_ssh",
  "teleport_kubernetes",
  "teleport_application",
  "teleport_rdp",
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function timestamp(value = new Date()): string {
  return value.toISOString();
}

function asInput(value: unknown): Input {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new FusionError("请求体必须是 JSON 对象。", 400);
  }

  return value as Input;
}

function requiredString(input: Input, key: string): string {
  const value = input[key];

  if (typeof value !== "string" || value.trim() === "") {
    throw new FusionError(`${key} 必须是非空字符串。`, 422);
  }

  return value.trim();
}

function optionalString(input: Input, key: string): string | undefined {
  if (!(key in input)) {
    return undefined;
  }

  return requiredString(input, key);
}

function requiredDate(input: Input, key: string): Date {
  const value = new Date(requiredString(input, key));
  if (Number.isNaN(value.getTime())) {
    throw new FusionError(`${key} 必须是有效的 ISO 时间戳。`, 422);
  }

  return value;
}

function nullableString(input: Input, key: string): string | undefined {
  if (!(key in input)) {
    return undefined;
  }

  if (input[key] === null) {
    return "";
  }

  return requiredString(input, key);
}

function optionalBoolean(input: Input, key: string): boolean | undefined {
  if (!(key in input)) {
    return undefined;
  }

  if (typeof input[key] !== "boolean") {
    throw new FusionError(`${key} 必须是布尔值。`, 422);
  }

  return input[key] as boolean;
}

function optionalLabels(input: Input, key: string): Record<string, string> | undefined {
  if (!(key in input)) {
    return undefined;
  }

  const value = input[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new FusionError(`${key} 必须是值均为字符串的对象。`, 422);
  }

  const labels: Record<string, string> = {};
  for (const [label, labelValue] of Object.entries(value)) {
    if (label.trim() === "" || typeof labelValue !== "string") {
      throw new FusionError(`${key} 必须是值均为字符串的对象。`, 422);
    }

    labels[label.trim()] = labelValue;
  }

  return labels;
}

function stringArray(input: Input, key: string): string[] {
  const value = input[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new FusionError(`${key} 必须是非空字符串数组。`, 422);
  }

  const items = value.map((item) => item.trim());
  if (new Set(items).size !== items.length) {
    throw new FusionError(`${key} 不得包含重复项。`, 422);
  }

  return items;
}

function enumValue<T extends string>(
  input: Input,
  key: string,
  values: readonly T[],
  fallback?: T,
): T {
  if (!(key in input) && fallback !== undefined) {
    return fallback;
  }

  const value = requiredString(input, key).toLowerCase();
  if (!values.includes(value as T)) {
    throw new FusionError(`${key} 必须是以下值之一：${values.join(", ")}。`, 422);
  }

  return value as T;
}

function optionalEnum<T extends string>(input: Input, key: string, values: readonly T[]): T | undefined {
  if (!(key in input)) {
    return undefined;
  }

  return enumValue(input, key, values);
}

function port(input: Input, key: string): number {
  const value = input[key];
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 65_535) {
    throw new FusionError(`${key} 必须是介于 1 和 65535 之间的整数。`, 422);
  }

  return value as number;
}

function optionalPort(input: Input, key: string): number | undefined {
  return key in input ? port(input, key) : undefined;
}

function normalizedAddress(type: EndpointType, value: string): string {
  if (type === "ipv4" && isIP(value) !== 4) {
    throw new FusionError("address 必须是有效的 IPv4 地址。", 422);
  }

  if (type === "ipv6" && isIP(value) !== 6) {
    throw new FusionError("address 必须是有效的 IPv6 地址。", 422);
  }

  if (type === "dns") {
    const address = value.toLowerCase();
    const dnsName = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!dnsName.test(address)) {
      throw new FusionError("address 必须是有效的 DNS 名称。", 422);
    }

    return address;
  }

  return value;
}

function destinationFor(endpoint: Endpoint): string {
  if (endpoint.type === "ipv4") {
    return `${endpoint.address}/32`;
  }

  if (endpoint.type === "ipv6") {
    return `${endpoint.address}/128`;
  }

  return endpoint.address;
}

function compareByName<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name);
}

export class FusionStore {
  private readonly sites = new Map<string, Site>();
  private readonly routerGroups = new Map<string, RouterGroup>();
  private readonly devices = new Map<string, Device>();
  private readonly assets = new Map<string, Asset>();
  private readonly endpoints = new Map<string, Endpoint>();
  private readonly services = new Map<string, Service>();
  private readonly networkResources = new Map<string, NetworkResource>();
  private readonly staticAssetPermissions = new Map<string, StaticAssetPermission>();
  private readonly accessGrants = new Map<string, AccessGrant>();
  private readonly accessRequests = new Map<string, AccessRequest>();
  private readonly discoveredAssets = new Map<string, DiscoveredAsset>();
  private readonly auditEvents = new Map<string, AuditEvent>();
  private readonly networkAccessEvents = new Map<string, NetworkAccessEvent>();
  private readonly now: () => Date;

  constructor({ seed = true, now = () => new Date() }: { seed?: boolean; now?: () => Date } = {}) {
    this.now = now;
    if (seed) {
      this.seed();
    }
  }

  static fromState(value: unknown, { now = () => new Date() }: { now?: () => Date } = {}): FusionStore {
    if (!isFusionState(value)) {
      throw new FusionError("已持久化的 Fusion 状态无效。", 503);
    }

    const store = new FusionStore({ seed: false, now });
    for (const site of value.sites) {
      store.sites.set(site.id, clone(site));
    }
    for (const routerGroup of value.routerGroups) {
      store.routerGroups.set(routerGroup.id, clone(routerGroup));
    }
    for (const device of value.devices) {
      store.devices.set(device.id, clone(device));
    }
    for (const asset of value.assets) {
      store.assets.set(asset.id, clone(asset));
    }
    for (const endpoint of value.endpoints) {
      store.endpoints.set(endpoint.id, clone(endpoint));
    }
    for (const service of value.services) {
      store.services.set(service.id, clone(service));
    }
    for (const resource of value.networkResources) {
      store.networkResources.set(resource.endpointId, clone(resource));
    }
    for (const permission of value.staticAssetPermissions) {
      store.staticAssetPermissions.set(permission.id, clone(permission));
    }
    for (const grant of value.accessGrants) {
      store.accessGrants.set(grant.id, clone(grant));
    }
    for (const request of value.accessRequests) {
      store.accessRequests.set(request.id, clone(request));
    }
    for (const discovered of value.discoveredAssets) {
      store.discoveredAssets.set(discovered.id, clone(discovered));
    }
    for (const event of value.auditEvents) {
      store.auditEvents.set(event.id, clone(event));
    }
    for (const event of value.networkAccessEvents) {
      store.networkAccessEvents.set(event.id, clone(event));
    }

    return store;
  }

  exportState(): FusionState {
    return {
      sites: [...this.sites.values()].map(clone),
      routerGroups: [...this.routerGroups.values()].map(clone),
      devices: [...this.devices.values()].map(clone),
      assets: [...this.assets.values()].map(clone),
      endpoints: [...this.endpoints.values()].map(clone),
      services: [...this.services.values()].map(clone),
      networkResources: [...this.networkResources.values()].map(clone),
      staticAssetPermissions: [...this.staticAssetPermissions.values()].map(clone),
      accessGrants: [...this.accessGrants.values()].map(clone),
      accessRequests: [...this.accessRequests.values()].map(clone),
      discoveredAssets: [...this.discoveredAssets.values()].map(clone),
      auditEvents: [...this.auditEvents.values()].map(clone),
      networkAccessEvents: [...this.networkAccessEvents.values()].map(clone),
    };
  }

  listSites(): Site[] {
    return [...this.sites.values()].sort(compareByName).map(clone);
  }

  listAuditEvents(): AuditEvent[] {
    return [...this.auditEvents.values()].reverse().map(clone);
  }

  listNetworkAccessEvents(): NetworkAccessEvent[] {
    return [...this.networkAccessEvents.values()].reverse().map(clone);
  }

  getSite(siteId: string): Site {
    return clone(this.requireSite(siteId));
  }

  createSite(value: unknown): Site {
    const input = asInput(value);
    const now = timestamp();
    const site: Site = {
      id: id("site"),
      name: requiredString(input, "name"),
      description: optionalString(input, "description") ?? "",
      networkId: requiredString(input, "networkId"),
      labels: optionalLabels(input, "labels") ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.sites.set(site.id, site);
    this.recordAudit("site.created", "site", site.id, { networkId: site.networkId });
    return clone(site);
  }

  getRouterGroup(routerGroupId: string): RouterGroup {
    return clone(this.requireRouterGroup(routerGroupId));
  }

  listRouterGroups(): RouterGroup[] {
    return [...this.routerGroups.values()].sort(compareByName).map(clone);
  }

  createRouterGroup(value: unknown): RouterGroup {
    const input = asInput(value);
    const siteId = requiredString(input, "siteId");
    this.requireSite(siteId);

    const name = requiredString(input, "name");
    if ([...this.routerGroups.values()].some((group) => group.siteId === siteId && group.name === name)) {
      throw new FusionError("该站点中已存在同名路由器组。", 409);
    }

    const now = timestamp();
    const routerGroup: RouterGroup = {
      id: id("rgrp"),
      siteId,
      name,
      peerIds: stringArray(input, "peerIds"),
      netbirdGroupId: optionalString(input, "netbirdGroupId"),
      createdAt: now,
      updatedAt: now,
    };

    this.routerGroups.set(routerGroup.id, routerGroup);
    this.recordAudit("router_group.created", "router_group", routerGroup.id, { siteId: routerGroup.siteId });
    return clone(routerGroup);
  }

  listDevices(): Device[] {
    return [...this.devices.values()].sort(compareByName).map(clone);
  }

  getDevice(deviceId: string): Device {
    return clone(this.requireDevice(deviceId));
  }

  createDevice(value: unknown): Device {
    const input = asInput(value);
    const subjectId = requiredString(input, "subjectId");
    const peerId = requiredString(input, "peerId");
    const netbirdGroupId = requiredString(input, "netbirdGroupId");
    if ([...this.devices.values()].some((device) => device.peerId === peerId)) {
      throw new FusionError("已存在使用此 peerId 的设备。", 409);
    }
    if ([...this.devices.values()].some((device) => device.netbirdGroupId === netbirdGroupId)) {
      throw new FusionError("已存在使用此 netbirdGroupId 的设备。", 409);
    }

    const now = timestamp();
    const device: Device = {
      id: id("dev"),
      name: requiredString(input, "name"),
      subjectId,
      peerId,
      netbirdGroupId,
      managed: optionalBoolean(input, "managed") ?? true,
      labels: optionalLabels(input, "labels") ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.devices.set(device.id, device);
    this.recordAudit("device.created", "device", device.id, { subjectId: device.subjectId, peerId: device.peerId });
    return clone(device);
  }

  getManagedDeviceForSubjectPeer(subjectId: string, peerId: string): Device {
    const device = [...this.devices.values()].find(
      (candidate) => candidate.subjectId === subjectId && candidate.peerId === peerId,
    );
    if (device === undefined) {
      throw new FusionError("NetBird 策略同步需要已注册的设备。", 422);
    }
    if (!device.managed) {
      throw new FusionError("NetBird 策略同步要求使用受管设备。", 422);
    }

    return clone(device);
  }

  listAssets(): AssetDetail[] {
    return [...this.assets.values()].sort(compareByName).map((asset) => this.assetDetail(asset));
  }

  getAsset(assetId: string): AssetDetail {
    return this.assetDetail(this.requireAsset(assetId));
  }

  createAsset(value: unknown): AssetDetail {
    const input = asInput(value);
    const siteId = requiredString(input, "siteId");
    const routerGroupId = requiredString(input, "routerGroupId");
    this.requireSite(siteId);
    this.assertRouterGroupBelongsToSite(routerGroupId, siteId);

    const name = requiredString(input, "name");
    this.assertAssetNameAvailable(siteId, name);

    const hostname = optionalString(input, "hostname");
    const now = timestamp();
    const asset: Asset = {
      id: id("ast"),
      siteId,
      routerGroupId,
      name,
      hostname,
      labels: optionalLabels(input, "labels") ?? {},
      status: enumValue(input, "status", ["managed", "disabled"] as const, "managed"),
      createdAt: now,
      updatedAt: now,
    };

    this.assets.set(asset.id, asset);
    this.recordAudit("asset.created", "asset", asset.id, { siteId: asset.siteId });
    return this.assetDetail(asset);
  }

  updateAsset(assetId: string, value: unknown): AssetDetail {
    const asset = this.requireAsset(assetId);
    const input = asInput(value);
    const name = optionalString(input, "name");
    const routerGroupId = optionalString(input, "routerGroupId");

    if (name !== undefined && name !== asset.name) {
      this.assertAssetNameAvailable(asset.siteId, name, asset.id);
      asset.name = name;
    }

    if (routerGroupId !== undefined) {
      this.assertRouterGroupBelongsToSite(routerGroupId, asset.siteId);
      asset.routerGroupId = routerGroupId;
      this.updateResourceRouterGroup(asset.id, routerGroupId);
    }

    const hostname = nullableString(input, "hostname");
    if (hostname !== undefined) {
      asset.hostname = hostname || undefined;
    }

    const labels = optionalLabels(input, "labels");
    if (labels !== undefined) {
      asset.labels = labels;
    }

    const status = optionalEnum(input, "status", ["managed", "disabled"] as const);
    if (status !== undefined) {
      asset.status = status;
    }

    asset.updatedAt = timestamp();
    this.recordAudit("asset.updated", "asset", asset.id, { siteId: asset.siteId });
    return this.assetDetail(asset);
  }

  deleteAsset(assetId: string): void {
    const asset = this.requireAsset(assetId);
    const removedServiceIds = new Set(
      [...this.services.values()]
        .filter((service) => service.assetId === assetId)
        .map((service) => service.id),
    );

    for (const endpoint of this.endpoints.values()) {
      if (endpoint.assetId === assetId) {
        this.networkResources.delete(endpoint.id);
        this.endpoints.delete(endpoint.id);
      }
    }

    for (const service of this.services.values()) {
      if (service.assetId === assetId) {
        this.services.delete(service.id);
      }
    }

    for (const permission of this.staticAssetPermissions.values()) {
      if (permission.assetId === assetId) {
        this.staticAssetPermissions.delete(permission.id);
      }
    }

    this.removeAssetFromGrants(assetId, removedServiceIds);
    for (const discovered of this.discoveredAssets.values()) {
      if (discovered.importedAssetId === assetId) {
        discovered.status = "unmanaged";
        discovered.importedAssetId = undefined;
        discovered.updatedAt = timestamp();
      }
    }

    this.assets.delete(assetId);
    this.recordAudit("asset.deleted", "asset", assetId, { siteId: asset.siteId });
  }

  addEndpoint(assetId: string, value: unknown): EndpointWithResource {
    const asset = this.requireAsset(assetId);
    const input = asInput(value);
    const type = enumValue(input, "type", ["ipv4", "ipv6", "dns"] as const);
    const address = normalizedAddress(type, requiredString(input, "address"));

    if (this.endpointExistsInSite(asset.siteId, address, type)) {
      throw new FusionError("该站点中已存在使用此地址的端点。", 409);
    }

    const existingEndpoints = this.endpointsForAsset(asset.id);
    const primary = optionalBoolean(input, "primary") ?? existingEndpoints.length === 0;
    if (primary) {
      for (const endpoint of existingEndpoints) {
        endpoint.primary = false;
        endpoint.updatedAt = timestamp();
      }
    }

    const now = timestamp();
    const endpoint: Endpoint = {
      id: id("endp"),
      assetId: asset.id,
      address,
      type,
      primary,
      createdAt: now,
      updatedAt: now,
    };
    const resource: NetworkResource = {
      id: id("nres"),
      siteId: asset.siteId,
      networkId: this.requireSite(asset.siteId).networkId,
      routerGroupId: asset.routerGroupId,
      assetId: asset.id,
      endpointId: endpoint.id,
      name: `${asset.name}-${endpoint.id.slice(-8)}`,
      address: endpoint.address,
      type: endpoint.type === "dns" ? "domain" : "ip",
      destination: destinationFor(endpoint),
      syncState: "desired",
      createdAt: now,
      updatedAt: now,
    };

    this.endpoints.set(endpoint.id, endpoint);
    this.networkResources.set(endpoint.id, resource);
    asset.updatedAt = now;
    this.recordAudit("endpoint.created", "endpoint", endpoint.id, { assetId: asset.id, destination: resource.destination });

    return { ...clone(endpoint), networkResource: clone(resource) };
  }

  listDiscoveredAssets(): DiscoveredAsset[] {
    return [...this.discoveredAssets.values()]
      .sort((left, right) => left.discoveredAt.localeCompare(right.discoveredAt))
      .map(clone);
  }

  createDiscoveredAsset(value: unknown): DiscoveredAsset {
    const input = asInput(value);
    const siteId = requiredString(input, "siteId");
    const routerGroupId = requiredString(input, "routerGroupId");
    this.requireSite(siteId);
    this.assertRouterGroupBelongsToSite(routerGroupId, siteId);

    const type = enumValue(input, "type", ["ipv4", "ipv6", "dns"] as const);
    const address = normalizedAddress(type, requiredString(input, "address"));
    if (
      [...this.discoveredAssets.values()].some(
        (discovered) =>
          discovered.siteId === siteId &&
          discovered.type === type &&
          discovered.address === address &&
          discovered.status === "unmanaged",
      )
    ) {
      throw new FusionError("该站点中已发现此未受管端点。", 409);
    }

    const now = timestamp();
    const discovered: DiscoveredAsset = {
      id: id("disc"),
      siteId,
      routerGroupId,
      address,
      type,
      hostname: optionalString(input, "hostname"),
      source: enumValue(
        input,
        "source",
        ["manual", "arp", "dhcp", "dns", "mdns", "cloud", "cmdb", "agent_scan"] as const,
        "manual",
      ),
      labels: optionalLabels(input, "labels") ?? {},
      status: "unmanaged",
      discoveredAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.discoveredAssets.set(discovered.id, discovered);
    this.recordAudit("discovery.created", "discovery", discovered.id, {
      siteId: discovered.siteId,
      source: discovered.source,
    });
    return clone(discovered);
  }

  importDiscoveredAsset(discoveredId: string, value: unknown): AssetDetail {
    const discovered = this.requireDiscoveredAsset(discoveredId);
    if (discovered.status !== "unmanaged") {
      throw new FusionError("已发现的资产已被导入。", 409);
    }

    const input = asInput(value);
    const assetInput: Input = {
      siteId: discovered.siteId,
      routerGroupId: discovered.routerGroupId,
      name: requiredString(input, "name"),
      labels: optionalLabels(input, "labels") ?? discovered.labels,
    };
    const hostname = optionalString(input, "hostname") ?? discovered.hostname;
    if (hostname !== undefined) {
      assetInput.hostname = hostname;
    }

    if (this.endpointExistsInSite(discovered.siteId, discovered.address, discovered.type)) {
      throw new FusionError("该站点中已存在使用此地址的受管端点。", 409);
    }

    const asset = this.createAsset(assetInput);
    this.addEndpoint(asset.id, {
      address: discovered.address,
      type: discovered.type,
      primary: true,
    });
    discovered.status = "imported";
    discovered.importedAssetId = asset.id;
    discovered.updatedAt = timestamp();
    this.recordAudit("discovery.imported", "discovery", discovered.id, { assetId: asset.id });

    return this.getAsset(asset.id);
  }

  addService(assetId: string, value: unknown): Service {
    this.requireAsset(assetId);
    const input = asInput(value);
    const now = timestamp();
    const service: Service = {
      id: id("svc"),
      assetId,
      name: requiredString(input, "name"),
      protocol: enumValue(input, "protocol", ["tcp", "udp"] as const),
      port: port(input, "port"),
      accessMethod: enumValue(input, "accessMethod", accessMethods, "netbird"),
      exposable: optionalBoolean(input, "exposable") ?? false,
      labels: optionalLabels(input, "labels") ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.services.set(service.id, service);
    this.requireAsset(assetId).updatedAt = now;
    this.recordAudit("service.created", "service", service.id, { assetId: service.assetId });
    return clone(service);
  }

  getService(serviceId: string): Service {
    return clone(this.requireService(serviceId));
  }

  updateService(serviceId: string, value: unknown): Service {
    const service = this.requireService(serviceId);
    const input = asInput(value);
    const name = optionalString(input, "name");
    const protocol = optionalEnum(input, "protocol", ["tcp", "udp"] as const);
    const servicePort = optionalPort(input, "port");
    const accessMethod = optionalEnum(input, "accessMethod", accessMethods);
    const exposable = optionalBoolean(input, "exposable");
    const labels = optionalLabels(input, "labels");

    if (name !== undefined) {
      service.name = name;
    }
    if (protocol !== undefined) {
      service.protocol = protocol;
    }
    if (servicePort !== undefined) {
      service.port = servicePort;
    }
    if (accessMethod !== undefined) {
      service.accessMethod = accessMethod;
    }
    if (exposable !== undefined) {
      service.exposable = exposable;
    }
    if (labels !== undefined) {
      service.labels = labels;
    }

    const now = timestamp();
    service.updatedAt = now;
    this.requireAsset(service.assetId).updatedAt = now;
    this.recordAudit("service.updated", "service", service.id, { assetId: service.assetId });
    return clone(service);
  }

  deleteService(serviceId: string): void {
    const service = this.requireService(serviceId);
    this.services.delete(serviceId);
    for (const permission of this.staticAssetPermissions.values()) {
      if (permission.serviceId === serviceId) {
        this.staticAssetPermissions.delete(permission.id);
      }
    }
    for (const grant of this.accessGrants.values()) {
      if (!grant.serviceIds.includes(serviceId)) {
        continue;
      }

      if (grant.scope === "service") {
        this.accessGrants.delete(grant.id);
      } else {
        grant.serviceIds = grant.serviceIds.filter((id) => id !== serviceId);
        grant.updatedAt = timestamp(this.now());
      }
    }
    this.requireAsset(service.assetId).updatedAt = timestamp();
    this.recordAudit("service.deleted", "service", serviceId, { assetId: service.assetId });
  }

  listStaticAssetPermissions(): StaticAssetPermission[] {
    return [...this.staticAssetPermissions.values()]
      .sort(
        (left, right) =>
          left.subjectId.localeCompare(right.subjectId) ||
          left.devicePeerId.localeCompare(right.devicePeerId) ||
          left.assetId.localeCompare(right.assetId),
      )
      .map(clone);
  }

  createStaticAssetPermission(value: unknown): StaticAssetPermission {
    const input = asInput(value);
    const subjectId = requiredString(input, "subjectId");
    const devicePeerId = requiredString(input, "devicePeerId");
    const assetId = requiredString(input, "assetId");
    const serviceId = optionalString(input, "serviceId");
    const asset = this.requireAsset(assetId);

    if (asset.status !== "managed") {
      throw new FusionError("静态权限只能以受管资产为目标。", 422);
    }
    this.getManagedDeviceForSubjectPeer(subjectId, devicePeerId);

    if (serviceId !== undefined) {
      const service = this.requireService(serviceId);
      if (service.assetId !== assetId) {
        throw new FusionError("服务必须属于获准访问的资产。", 422);
      }
      if (!service.exposable || service.accessMethod !== "netbird") {
        throw new FusionError("服务权限只能以可通过 NetBird 暴露的服务为目标。", 422);
      }
    }

    const scope = serviceId === undefined ? "asset" : "service";
    if (
      [...this.staticAssetPermissions.values()].some(
        (permission) =>
          permission.subjectId === subjectId &&
          permission.devicePeerId === devicePeerId &&
          permission.assetId === assetId &&
          (permission.scope === "asset" || scope === "asset" || permission.serviceId === serviceId),
      )
    ) {
      throw new FusionError("此设备已拥有与该资产重叠的静态访问权限。", 409);
    }

    const now = timestamp();
    const permission: StaticAssetPermission = {
      id: id("sap"),
      subjectId,
      devicePeerId,
      assetId,
      scope,
      serviceId,
      createdAt: now,
      updatedAt: now,
    };

    this.staticAssetPermissions.set(permission.id, permission);
    this.recordAudit("static_permission.created", "static_permission", permission.id, {
      assetId: permission.assetId,
      subjectId: permission.subjectId,
      devicePeerId: permission.devicePeerId,
    });
    return clone(permission);
  }

  deleteStaticAssetPermission(permissionId: string): void {
    const permission = this.requireStaticAssetPermission(permissionId);
    this.staticAssetPermissions.delete(permissionId);
    this.recordAudit("static_permission.deleted", "static_permission", permissionId, { assetId: permission.assetId });
  }

  getCompiledAccessForPermission(permissionId: string): CompiledAccess[] {
    return this.compilePermission(this.requireStaticAssetPermission(permissionId));
  }

  listAccessRequests(): AccessRequest[] {
    return [...this.accessRequests.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(clone);
  }

  createAccessRequest(value: unknown): AccessRequest {
    const input = asInput(value);
    const subjectId = requiredString(input, "subjectId");
    const devicePeerId = requiredString(input, "devicePeerId");
    const scope = enumValue(input, "scope", ["site", "asset", "service"] as const);
    const validUntil = requiredDate(input, "validUntil");
    const now = this.now();
    if (validUntil.getTime() <= now.getTime()) {
      throw new FusionError("validUntil 必须是未来时间。", 422);
    }
    this.getManagedDeviceForSubjectPeer(subjectId, devicePeerId);

    let siteId: string;
    let assetId: string | undefined;
    let serviceId: string | undefined;
    if (scope === "site") {
      siteId = requiredString(input, "siteId");
      this.requireSite(siteId);
      const siteAssetIds = [...this.assets.values()]
        .filter((asset) => asset.siteId === siteId && asset.status === "managed")
        .map((asset) => asset.id);
      if (this.netbirdExposableServiceIds(siteAssetIds).length === 0) {
        throw new FusionError("所请求的站点不存在可通过 NetBird 暴露的服务。", 422);
      }
    } else {
      assetId = requiredString(input, "assetId");
      const asset = this.requireManagedAsset(assetId);
      siteId = asset.siteId;
      if (scope === "service") {
        serviceId = requiredString(input, "serviceId");
        this.requireExposableNetBirdService(asset.id, serviceId);
      } else if (this.netbirdExposableServiceIds([asset.id]).length === 0) {
        throw new FusionError("所请求的资产不存在可通过 NetBird 暴露的服务。", 422);
      }
    }

    const nowTimestamp = timestamp(now);
    const request: AccessRequest = {
      id: id("req"),
      subjectId,
      devicePeerId,
      scope,
      siteId,
      assetId,
      serviceId,
      reason: requiredString(input, "reason"),
      validUntil: timestamp(validUntil),
      status: "pending",
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
    };
    this.accessRequests.set(request.id, request);
    this.recordAudit("access_request.created", "access_request", request.id, {
      scope: request.scope,
      subjectId: request.subjectId,
      devicePeerId: request.devicePeerId,
    });

    return clone(request);
  }

  listAccessGrants(): AccessGrant[] {
    this.refreshExpiredGrants();
    return [...this.accessGrants.values()]
      .sort(
        (left, right) =>
          left.validUntil.localeCompare(right.validUntil) ||
          left.subjectId.localeCompare(right.subjectId),
      )
      .map(clone);
  }

  getAccessGrant(grantId: string): AccessGrant {
    const grant = this.requireAccessGrant(grantId);
    this.isGrantActive(grant);
    return clone(grant);
  }

  createAccessGrant(value: unknown): AccessGrant {
    const input = asInput(value);
    const subjectId = requiredString(input, "subjectId");
    const devicePeerId = requiredString(input, "devicePeerId");
    const scope = enumValue(input, "scope", ["site", "asset", "service"] as const);
    const source = enumValue(input, "source", ["manual", "teleport"] as const, "manual");
    const requestId = optionalString(input, "requestId");
    const reviewerId = optionalString(input, "reviewerId");
    const now = this.now();
    const validUntil = requiredDate(input, "validUntil");

    if (validUntil.getTime() <= now.getTime()) {
      throw new FusionError("validUntil 必须是未来时间。", 422);
    }
    this.getManagedDeviceForSubjectPeer(subjectId, devicePeerId);

    let siteId: string;
    let assetIds: string[];
    let serviceIds: string[];
    if (scope === "site") {
      siteId = requiredString(input, "siteId");
      this.requireSite(siteId);
      assetIds = [...this.assets.values()]
        .filter((asset) => asset.siteId === siteId && asset.status === "managed")
        .map((asset) => asset.id);
      serviceIds = this.netbirdExposableServiceIds(assetIds);
    } else {
      const assetId = requiredString(input, "assetId");
      const asset = this.requireManagedAsset(assetId);
      siteId = asset.siteId;
      assetIds = [asset.id];
      if (scope === "service") {
        const serviceId = requiredString(input, "serviceId");
        this.requireExposableNetBirdService(asset.id, serviceId);
        serviceIds = [serviceId];
      } else {
        serviceIds = this.netbirdExposableServiceIds(assetIds);
      }
    }

    if (serviceIds.length === 0) {
      throw new FusionError("此授权范围内不存在可通过 NetBird 暴露的服务。", 422);
    }

    if (source === "teleport" && (requestId === undefined || reviewerId === undefined)) {
      throw new FusionError("Teleport 授权需要 requestId 和 reviewerId。", 422);
    }
    if (
      source === "teleport" &&
      [...this.accessGrants.values()].some(
        (grant) => grant.source === "teleport" && grant.requestId === requestId,
      )
    ) {
      throw new FusionError("此请求已存在 Teleport 授权。", 409);
    }

    const nowTimestamp = timestamp(now);
    const grant: AccessGrant = {
      id: id("grant"),
      subjectId,
      devicePeerId,
      scope,
      siteId,
      assetIds,
      serviceIds,
      validFrom: nowTimestamp,
      validUntil: timestamp(validUntil),
      requestId,
      reviewerId,
      source,
      reason: optionalString(input, "reason") ?? "",
      status: "active",
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
    };

    this.accessGrants.set(grant.id, grant);
    this.recordAudit(
      "access_grant.created",
      "access_grant",
      grant.id,
      { scope: grant.scope, subjectId: grant.subjectId, devicePeerId: grant.devicePeerId },
      grant.source === "teleport" ? "teleport" : "control_plane",
    );
    return clone(grant);
  }

  revokeAccessGrant(grantId: string): AccessGrant {
    const grant = this.requireAccessGrant(grantId);
    if (this.isGrantActive(grant)) {
      const now = timestamp(this.now());
      grant.status = "revoked";
      grant.revokedAt = now;
      grant.updatedAt = now;
      this.recordAudit(
        "access_grant.revoked",
        "access_grant",
        grant.id,
        { requestId: grant.requestId ?? "", subjectId: grant.subjectId },
        grant.source === "teleport" ? "teleport" : "control_plane",
      );
    }

    return clone(grant);
  }

  deleteAccessGrant(grantId: string): void {
    const grant = this.requireAccessGrant(grantId);
    this.accessGrants.delete(grantId);
    this.recordAudit(
      "access_grant.deleted",
      "access_grant",
      grantId,
      { subjectId: grant.subjectId },
      grant.source === "teleport" ? "teleport" : "control_plane",
    );
  }

  getCompiledAccessForGrant(grantId: string): CompiledAccess[] {
    return this.compileGrant(this.requireAccessGrant(grantId));
  }

  getAccessGrantForTeleportRequest(requestId: string): AccessGrant | undefined {
    const grant = [...this.accessGrants.values()].find(
      (candidate) => candidate.source === "teleport" && candidate.requestId === requestId,
    );
    if (grant === undefined) {
      return undefined;
    }

    this.isGrantActive(grant);
    return clone(grant);
  }

  revokeAccessGrantsForTeleportRequest(requestId: string): AccessGrant[] {
    return [...this.accessGrants.values()]
      .filter((grant) => grant.source === "teleport" && grant.requestId === requestId)
      .map((grant) => this.revokeAccessGrant(grant.id));
  }

  listCompiledAccess(devicePeerId: string, subjectId: string): CompiledAccess[] {
    const peerId = devicePeerId.trim();
    if (peerId === "") {
      throw new FusionError("devicePeerId 必须是非空字符串。", 422);
    }

    const subject = subjectId.trim();
    if (subject === "") {
      throw new FusionError("subjectId 必须是非空字符串。", 422);
    }

    return [
      ...[...this.staticAssetPermissions.values()]
       .filter((permission) => permission.devicePeerId === peerId && permission.subjectId === subject)
       .flatMap((permission) => this.compilePermission(permission)),
      ...[...this.accessGrants.values()]
        .filter((grant) => grant.devicePeerId === peerId && grant.subjectId === subject)
        .flatMap((grant) => this.compileGrant(grant)),
    ]
      .sort(
        (left, right) =>
          left.destination.localeCompare(right.destination) ||
          left.protocol.localeCompare(right.protocol) ||
          left.ports[0] - right.ports[0] ||
          left.authorizationId.localeCompare(right.authorizationId),
      );
  }

  listEffectiveAccess(): CompiledAccess[] {
    return [
      ...[...this.staticAssetPermissions.values()].flatMap((permission) => this.compilePermission(permission)),
      ...[...this.accessGrants.values()].flatMap((grant) => this.compileGrant(grant)),
    ].sort(
      (left, right) =>
        left.destination.localeCompare(right.destination) ||
        left.protocol.localeCompare(right.protocol) ||
        left.ports[0] - right.ports[0] ||
        left.authorizationId.localeCompare(right.authorizationId),
    );
  }

  recordNetworkAccessEvent(value: unknown): NetworkAccessEvent {
    const input = asInput(value);
    const userId = requiredString(input, "userId");
    const deviceId = requiredString(input, "deviceId");
    const destination = requiredString(input, "destination");
    const protocol = enumValue(input, "protocol", ["tcp", "udp"] as const);
    const connectionPort = port(input, "port");
    const routerPeerId = requiredString(input, "routerPeerId");
    const startedAt = "startedAt" in input ? requiredDate(input, "startedAt") : this.now();
    const endedAt = "endedAt" in input ? requiredDate(input, "endedAt") : undefined;
    if (endedAt !== undefined && endedAt.getTime() < startedAt.getTime()) {
      throw new FusionError("endedAt 不得早于 startedAt。", 422);
    }

    const access = this.listCompiledAccess(deviceId, userId).find(
      (rule) =>
        rule.destination === destination &&
        rule.protocol === protocol &&
        rule.ports.includes(connectionPort) &&
        rule.routerPeerIds.includes(routerPeerId),
    );
    const event: NetworkAccessEvent = {
      id: id("nace"),
      userId,
      deviceId,
      grantId: access?.source === "access_grant" ? access.authorizationId : undefined,
      requestId: access?.requestId,
      reviewerId: access?.reviewerId,
      siteId: access?.siteId,
      assetId: access?.assetId,
      serviceId: access?.serviceId,
      routerPeerId,
      destination,
      protocol,
      port: connectionPort,
      startedAt: timestamp(startedAt),
      endedAt: endedAt === undefined ? undefined : timestamp(endedAt),
      decision: access === undefined ? "deny" : "allow",
    };
    this.networkAccessEvents.set(event.id, event);
    return clone(event);
  }

  getEffectiveNetworkMap(devicePeerId: string, subjectId: string): EffectiveNetworkMap {
    const normalizedPeerId = devicePeerId.trim();
    const normalizedSubjectId = subjectId.trim();
    const accessRules = this.listCompiledAccess(normalizedPeerId, normalizedSubjectId);
    const revision = createHash("sha256")
      .update(JSON.stringify(accessRules))
      .digest("hex");

    return {
      devicePeerId: normalizedPeerId,
      subjectId: normalizedSubjectId,
      revision,
      generatedAt: timestamp(this.now()),
      accessRules,
    };
  }

  listNetworkResources(): NetworkResource[] {
    return [...this.networkResources.values()].sort((left, right) => left.destination.localeCompare(right.destination)).map(clone);
  }

  getNetworkResource(resourceId: string): NetworkResource {
    return clone(this.requireNetworkResource(resourceId));
  }

  getNetworkResourceForEndpoint(endpointId: string): NetworkResource {
    const resource = this.networkResources.get(endpointId);
    if (resource === undefined) {
      throw new FusionError("未找到网络资源。", 404);
    }

    return clone(resource);
  }

  markNetworkResourceSynced(resourceId: string, netbirdResourceId: string): NetworkResource {
    const resource = this.requireNetworkResource(resourceId);

    resource.syncState = "synced";
    resource.netbirdResourceId = netbirdResourceId;
    resource.lastSyncedAt = timestamp(this.now());
    resource.updatedAt = timestamp(this.now());
    this.recordAudit("network_resource.synced", "network_resource", resource.id, { netbirdResourceId });
    return clone(resource);
  }

  markNetworkResourceSyncFailed(resourceId: string): NetworkResource {
    const resource = this.requireNetworkResource(resourceId);

    resource.syncState = "failed";
    resource.updatedAt = timestamp(this.now());
    this.recordAudit("network_resource.sync_failed", "network_resource", resource.id, {});
    return clone(resource);
  }

  recordNetBirdPolicySynced(policyId: string, ruleCount: number): void {
    this.recordAudit("network_policy.synced", "network_policy", policyId, { ruleCount: String(ruleCount) });
  }

  recordNetBirdPolicySyncFailed(policyId: string): void {
    this.recordAudit("network_policy.sync_failed", "network_policy", policyId, {});
  }

  private recordAudit(
    action: string,
    resourceType: AuditEvent["resourceType"],
    resourceId: string,
    details: Record<string, string>,
    origin: AuditEvent["origin"] = "control_plane",
  ): void {
    const event: AuditEvent = {
      id: id("audit"),
      action,
      resourceType,
      resourceId,
      origin,
      details,
      occurredAt: timestamp(this.now()),
    };
    this.auditEvents.set(event.id, event);
  }

  private requireSite(siteId: string): Site {
    const site = this.sites.get(siteId);
    if (!site) {
      throw new FusionError("未找到站点。", 404);
    }

    return site;
  }

  private requireRouterGroup(routerGroupId: string): RouterGroup {
    const routerGroup = this.routerGroups.get(routerGroupId);
    if (!routerGroup) {
      throw new FusionError("未找到路由器组。", 404);
    }

    return routerGroup;
  }

  private requireDevice(deviceId: string): Device {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new FusionError("未找到设备。", 404);
    }

    return device;
  }

  private requireAsset(assetId: string): Asset {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new FusionError("未找到资产。", 404);
    }

    return asset;
  }

  private requireService(serviceId: string): Service {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new FusionError("未找到服务。", 404);
    }

    return service;
  }

  private requireStaticAssetPermission(permissionId: string): StaticAssetPermission {
    const permission = this.staticAssetPermissions.get(permissionId);
    if (!permission) {
      throw new FusionError("未找到静态资产权限。", 404);
    }

    return permission;
  }

  private requireAccessGrant(grantId: string): AccessGrant {
    const grant = this.accessGrants.get(grantId);
    if (!grant) {
      throw new FusionError("未找到访问授权。", 404);
    }

    return grant;
  }

  private requireNetworkResource(resourceId: string): NetworkResource {
    const resource = [...this.networkResources.values()].find((candidate) => candidate.id === resourceId);
    if (!resource) {
      throw new FusionError("未找到网络资源。", 404);
    }

    return resource;
  }

  private requireDiscoveredAsset(discoveredId: string): DiscoveredAsset {
    const discovered = this.discoveredAssets.get(discoveredId);
    if (!discovered) {
      throw new FusionError("未找到已发现的资产。", 404);
    }

    return discovered;
  }

  private requireManagedAsset(assetId: string): Asset {
    const asset = this.requireAsset(assetId);
    if (asset.status !== "managed") {
      throw new FusionError("访问授权只能以受管资产为目标。", 422);
    }

    return asset;
  }

  private requireExposableNetBirdService(assetId: string, serviceId: string): Service {
    const service = this.requireService(serviceId);
    if (service.assetId !== assetId) {
      throw new FusionError("服务必须属于获准访问的资产。", 422);
    }
    if (!service.exposable || service.accessMethod !== "netbird") {
      throw new FusionError("服务权限只能以可通过 NetBird 暴露的服务为目标。", 422);
    }

    return service;
  }

  private assertRouterGroupBelongsToSite(routerGroupId: string, siteId: string): void {
    if (this.requireRouterGroup(routerGroupId).siteId !== siteId) {
      throw new FusionError("路由器组必须属于该资产所在的站点。", 422);
    }
  }

  private assertAssetNameAvailable(siteId: string, name: string, ignoredAssetId?: string): void {
    if (
      [...this.assets.values()].some(
        (asset) => asset.siteId === siteId && asset.name === name && asset.id !== ignoredAssetId,
      )
    ) {
      throw new FusionError("该站点中已存在同名资产。", 409);
    }
  }

  private endpointsForAsset(assetId: string): Endpoint[] {
    return [...this.endpoints.values()].filter((endpoint) => endpoint.assetId === assetId);
  }

  private netbirdExposableServiceIds(assetIds: string[]): string[] {
    const assetIdSet = new Set(assetIds);
    return [...this.services.values()]
      .filter(
        (service) =>
          assetIdSet.has(service.assetId) &&
          service.exposable &&
          service.accessMethod === "netbird",
      )
      .map((service) => service.id);
  }

  private endpointExistsInSite(siteId: string, address: string, type: EndpointType): boolean {
    return [...this.endpoints.values()].some((endpoint) => {
      const asset = this.assets.get(endpoint.assetId);
      return asset?.siteId === siteId && endpoint.address === address && endpoint.type === type;
    });
  }

  private updateResourceRouterGroup(assetId: string, routerGroupId: string): void {
    for (const resource of this.networkResources.values()) {
      if (resource.assetId === assetId && resource.routerGroupId !== routerGroupId) {
        resource.routerGroupId = routerGroupId;
        resource.syncState = "desired";
        resource.updatedAt = timestamp();
        this.recordAudit("network_resource.desired", "network_resource", resource.id, { routerGroupId });
      }
    }
  }

  private refreshExpiredGrants(): void {
    for (const grant of this.accessGrants.values()) {
      this.isGrantActive(grant);
    }
  }

  private isGrantActive(grant: AccessGrant): boolean {
    if (grant.status !== "active") {
      return false;
    }

    const now = this.now();
    if (new Date(grant.validUntil).getTime() <= now.getTime()) {
      // ponytail: 在策略编译时评估过期；生产环境应在 TTL 边界安排受保护的策略同步。
      grant.status = "expired";
      grant.updatedAt = timestamp(now);
      this.recordAudit(
        "access_grant.expired",
        "access_grant",
        grant.id,
        { requestId: grant.requestId ?? "", subjectId: grant.subjectId },
        grant.source === "teleport" ? "teleport" : "control_plane",
      );
      return false;
    }

    return true;
  }

  private removeAssetFromGrants(assetId: string, removedServiceIds: Set<string>): void {
    const now = timestamp(this.now());
    for (const grant of this.accessGrants.values()) {
      if (!grant.assetIds.includes(assetId)) {
        continue;
      }

      if (grant.scope !== "site") {
        this.accessGrants.delete(grant.id);
        continue;
      }

      grant.assetIds = grant.assetIds.filter((id) => id !== assetId);
      grant.serviceIds = grant.serviceIds.filter((id) => !removedServiceIds.has(id));
      grant.updatedAt = now;
      if (grant.assetIds.length === 0) {
        grant.status = "revoked";
        grant.revokedAt = now;
      }
    }
  }

  private compilePermission(permission: StaticAssetPermission): CompiledAccess[] {
    const asset = this.requireAsset(permission.assetId);
    return compileStaticAssetPermission(
      permission,
      this.assetDetail(asset),
      this.requireRouterGroup(asset.routerGroupId),
    );
  }

  private compileGrant(grant: AccessGrant): CompiledAccess[] {
    if (!this.isGrantActive(grant)) {
      return [];
    }

    const targets = grant.assetIds.flatMap((assetId) => {
      const asset = this.assets.get(assetId);
      return asset
        ? [{ asset: this.assetDetail(asset), routerGroup: this.requireRouterGroup(asset.routerGroupId) }]
        : [];
    });

    return compileAccessGrant(grant, targets);
  }

  private assetDetail(asset: Asset): AssetDetail {
    const endpoints = this.endpointsForAsset(asset.id)
      .sort((left, right) => Number(right.primary) - Number(left.primary) || left.address.localeCompare(right.address))
      .map((endpoint) => ({
        ...clone(endpoint),
        networkResource: clone(this.networkResources.get(endpoint.id)!),
      }));
    const services = [...this.services.values()]
      .filter((service) => service.assetId === asset.id)
      .sort(compareByName)
      .map(clone);

    return { ...clone(asset), endpoints, services };
  }

  private seed(): void {
    const site = this.createSite({
      name: "东京 IDC",
      description: "东京的主要生产站点。",
      networkId: "net_tokyo_idc",
      labels: { environment: "production", region: "ap-northeast-1" },
    });
    const routerGroup = this.createRouterGroup({
      siteId: site.id,
      name: "东京路由器组",
      peerIds: ["router-tokyo-01", "router-tokyo-02"],
    });
    const mysql = this.createAsset({
      siteId: site.id,
      routerGroupId: routerGroup.id,
      name: "mysql-prod-01",
      hostname: "mysql-prod-01.internal",
      labels: { role: "database", tier: "production" },
    });
    this.addEndpoint(mysql.id, { address: "10.20.30.15", type: "ipv4", primary: true });
    this.addService(mysql.id, {
      name: "MySQL",
      protocol: "tcp",
      port: 3306,
      accessMethod: "netbird",
      exposable: true,
    });

    const redis = this.createAsset({
      siteId: site.id,
      routerGroupId: routerGroup.id,
      name: "redis-prod-01",
      hostname: "redis-prod-01.internal",
      labels: { role: "cache", tier: "production" },
    });
    this.addEndpoint(redis.id, { address: "10.20.30.16", type: "ipv4", primary: true });
    this.addService(redis.id, {
      name: "Redis",
      protocol: "tcp",
      port: 6379,
      accessMethod: "netbird",
      exposable: true,
    });
    this.auditEvents.clear();
  }
}

// ponytail: 内存状态足以支撑第一阶段切片；部署多实例前应替换为事务性持久化。
export const fusionStore = new FusionStore();
