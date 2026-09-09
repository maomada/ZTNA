import { timingSafeEqual } from "node:crypto";

import { FusionError, FusionStore } from "./fusion";
import type { Device, NetworkResource, RouterGroup } from "./fusion";

interface RemoteResource {
  id: string;
  description?: string;
}

interface RemoteGroupPeer {
  id: string;
}

interface RemoteGroup {
  id: string;
  peers?: RemoteGroupPeer[];
}

interface RemotePolicyRule {
  id?: string;
  description?: string;
}

interface RemotePolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  source_posture_checks?: string[];
  rules: RemotePolicyRule[];
}

export interface NetworkResourceSyncResult {
  item: NetworkResource;
  error?: string;
}

export interface NetBirdPolicySyncResult {
  id: string;
  ruleCount: number;
}

export interface NetBirdConnectorOptions {
  apiUrl: string;
  token: string;
  fetch?: typeof fetch;
}

export class NetBirdConnector {
  private readonly request: typeof fetch;
  private readonly groups = new Map<string, RemoteGroup>();

  constructor(private readonly options: NetBirdConnectorOptions) {
    this.request = options.fetch ?? fetch;
  }

  static fromEnvironment(): NetBirdConnector {
    const token = process.env.NETBIRD_API_TOKEN;
    if (token === undefined || token === "") {
      throw new FusionError("NetBird API 令牌尚未配置。", 503);
    }

    return new NetBirdConnector({ apiUrl: process.env.NETBIRD_API_URL ?? "https://api.netbird.io/api", token });
  }

  async syncResource(resource: NetworkResource, routerGroup: RouterGroup): Promise<string> {
    if (routerGroup.netbirdGroupId === undefined) {
      throw new FusionError("资源同步前，RouterGroup 必须设置 netbirdGroupId。", 422);
    }
    await this.requireGroup(routerGroup.netbirdGroupId);

    const path = `/networks/${encodeURIComponent(resource.networkId)}/resources`;
    const remoteResources = await this.api(path);
    if (!Array.isArray(remoteResources) || !remoteResources.every(isRemoteResource)) {
      throw new FusionError("NetBird API 返回了无效的资源列表。", 503);
    }

    const description = `Fusion resource ${resource.id}`;
    const existing = remoteResources.find((candidate) => candidate.description === description);
    const body = {
      name: resource.name,
      description,
      address: resource.destination,
      enabled: true,
      groups: [routerGroup.netbirdGroupId],
    };
    const remote = await this.api(existing === undefined ? path : `${path}/${encodeURIComponent(existing.id)}`, {
      method: existing === undefined ? "POST" : "PUT",
      body: JSON.stringify(body),
    });
    if (!isRemoteResource(remote)) {
      throw new FusionError("NetBird API 返回了无效的资源。", 503);
    }

    return remote.id;
  }

  async syncEffectivePolicy(store: FusionStore, policyId: string): Promise<NetBirdPolicySyncResult> {
    const deviceGroups = new Map<string, Device>();
    const desiredRules = store.listEffectiveAccess().map((access) => {
      const device = store.getManagedDeviceForSubjectPeer(access.subjectId, access.devicePeerId);
      deviceGroups.set(device.netbirdGroupId, device);
      const resource = store.getNetworkResourceForEndpoint(access.endpointId);
      if (resource.netbirdResourceId === undefined) {
        throw new FusionError("策略同步前必须先同步网络资源。", 422);
      }

      const description = `Fusion access ${access.id}`;
      return {
        name: description,
        description,
        enabled: true,
        action: "accept",
        // NetBird 网络资源只允许从源到目标的策略。
        bidirectional: false,
        protocol: access.protocol,
        ports: access.ports.map(String),
        sources: [device.netbirdGroupId],
        destinationResource: {
          id: resource.netbirdResourceId,
          type: resource.type === "domain" ? "domain" : "host",
        },
      };
    });
    await Promise.all([...deviceGroups.values()].map((device) => this.requireDeviceGroup(device)));
    const remote = await this.api(`/policies/${encodeURIComponent(policyId)}`);
    if (!isRemotePolicy(remote)) {
      throw new FusionError("NetBird API 返回了无效的策略。", 503);
    }
    if (remote.rules.some((rule) => !isFusionPolicyRule(rule))) {
      throw new FusionError("NetBird Fusion 策略不得包含非 Fusion 规则。", 422);
    }

    const existingRuleIds = new Map<string, string>(
      remote.rules.flatMap((rule): Array<[string, string]> =>
        rule.description === undefined || rule.id === undefined ? [] : [[rule.description, rule.id]],
      ),
    );
    const rules = desiredRules.map((rule) => ({
      ...(existingRuleIds.has(rule.description) ? { id: existingRuleIds.get(rule.description) } : {}),
      ...rule,
    }));
    const updated = await this.api(`/policies/${encodeURIComponent(policyId)}`, {
      method: "PUT",
      body: JSON.stringify({
        name: remote.name,
        description: remote.description ?? "",
        enabled: true,
        source_posture_checks: remote.source_posture_checks ?? [],
        rules,
      }),
    });
    if (!isRemotePolicy(updated) || updated.id !== policyId) {
      throw new FusionError("NetBird API 返回了无效的策略。", 503);
    }

    return { id: updated.id, ruleCount: rules.length };
  }

  private async api(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.request(`${this.options.apiUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Token ${this.options.token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new FusionError(`NetBird API 请求失败，状态码为 ${response.status}。`, 503);
    }

    return response.json();
  }

  private async requireGroup(groupId: string): Promise<void> {
    await this.getGroup(groupId);
  }

  private async requireDeviceGroup(device: Device): Promise<void> {
    const group = await this.getGroup(device.netbirdGroupId);
    if (group.peers?.length !== 1 || group.peers[0]?.id !== device.peerId) {
      throw new FusionError("NetBird 设备组必须且只能包含其已注册的对等节点。", 422);
    }
  }

  private async getGroup(groupId: string): Promise<RemoteGroup> {
    const cached = this.groups.get(groupId);
    if (cached !== undefined) {
      return cached;
    }

    const group = await this.api(`/groups/${encodeURIComponent(groupId)}`);
    if (!isRemoteGroup(group) || group.id !== groupId) {
      throw new FusionError("NetBird API 返回了无效的组。", 503);
    }

    this.groups.set(groupId, group);
    return group;
  }
}

export function authorizeNetBirdSync(request: Request): void {
  const expected = process.env.NETBIRD_SYNC_SECRET;
  if (expected === undefined || expected === "") {
    throw new FusionError("NetBird 同步尚未配置。", 503);
  }

  const received = request.headers.get("x-netbird-sync-secret");
  if (received === null) {
    throw new FusionError("未获授权的 NetBird 同步请求。", 401);
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new FusionError("未获授权的 NetBird 同步请求。", 401);
  }
}

export function netBirdPolicyIdFromEnvironment(): string {
  const policyId = process.env.NETBIRD_FUSION_POLICY_ID;
  if (policyId === undefined || policyId === "") {
    throw new FusionError("NetBird Fusion 策略 ID 尚未配置。", 503);
  }

  return policyId;
}

export async function syncNetworkResource(
  store: FusionStore,
  connector: NetBirdConnector,
  resourceId: string,
): Promise<NetworkResource> {
  const resource = store.getNetworkResource(resourceId);
  try {
    const netbirdResourceId = await connector.syncResource(resource, store.getRouterGroup(resource.routerGroupId));
    return store.markNetworkResourceSynced(resource.id, netbirdResourceId);
  } catch (error) {
    store.markNetworkResourceSyncFailed(resource.id);
    throw error;
  }
}

export async function syncAllNetworkResources(
  store: FusionStore,
  connector: NetBirdConnector,
): Promise<NetworkResourceSyncResult[]> {
  const results: NetworkResourceSyncResult[] = [];
  for (const resource of store.listNetworkResources()) {
    try {
      results.push({ item: await syncNetworkResource(store, connector, resource.id) });
    } catch (error) {
      results.push({
        item: store.getNetworkResource(resource.id),
        error: error instanceof Error ? error.message : "NetBird 同步失败。",
      });
    }
  }

  return results;
}

export async function syncNetBirdPolicy(
  store: FusionStore,
  connector: NetBirdConnector,
  policyId: string,
): Promise<NetBirdPolicySyncResult> {
  try {
    const result = await connector.syncEffectivePolicy(store, policyId);
    store.recordNetBirdPolicySynced(result.id, result.ruleCount);
    return result;
  } catch (error) {
    store.recordNetBirdPolicySyncFailed(policyId);
    throw error;
  }
}

export async function syncNetBirdPolicyAfterTeleport(
  store: FusionStore,
  connector?: NetBirdConnector,
): Promise<NetBirdPolicySyncResult | undefined> {
  if (process.env.NETBIRD_POLICY_SYNC_ON_TELEPORT !== "true") {
    return undefined;
  }

  return syncNetBirdPolicy(store, connector ?? NetBirdConnector.fromEnvironment(), netBirdPolicyIdFromEnvironment());
}

function isRemoteResource(value: unknown): value is RemoteResource {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const resource = value as Record<string, unknown>;
  return (
    typeof resource.id === "string" &&
    resource.id !== "" &&
    (resource.description === undefined || typeof resource.description === "string")
  );
}

function isRemoteGroup(value: unknown): value is RemoteGroup {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const group = value as Record<string, unknown>;
  return (
    typeof group.id === "string" &&
    group.id !== "" &&
    (group.peers === undefined || (Array.isArray(group.peers) && group.peers.every(isRemoteGroupPeer)))
  );
}

function isRemoteGroupPeer(value: unknown): value is RemoteGroupPeer {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).id === "string" &&
    (value as Record<string, unknown>).id !== ""
  );
}

function isRemotePolicy(value: unknown): value is RemotePolicy {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const policy = value as Record<string, unknown>;
  return (
    typeof policy.id === "string" &&
    policy.id !== "" &&
    typeof policy.name === "string" &&
    typeof policy.enabled === "boolean" &&
    (policy.description === undefined || typeof policy.description === "string") &&
    (policy.source_posture_checks === undefined ||
      (Array.isArray(policy.source_posture_checks) && policy.source_posture_checks.every((id) => typeof id === "string"))) &&
    Array.isArray(policy.rules) &&
    policy.rules.every(isRemotePolicyRule)
  );
}

function isRemotePolicyRule(value: unknown): value is RemotePolicyRule {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const rule = value as Record<string, unknown>;
  return (rule.id === undefined || typeof rule.id === "string") && (rule.description === undefined || typeof rule.description === "string");
}

function isFusionPolicyRule(rule: RemotePolicyRule): boolean {
  return rule.description?.startsWith("Fusion access ") ?? false;
}
