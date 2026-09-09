import assert from "node:assert/strict";
import test from "node:test";

import { authorizeNetworkAuditIngest, FusionError, FusionStore } from "./fusion";
import {
  authorizeNetBirdSync,
  NetBirdConnector,
  syncAllNetworkResources,
  syncNetBirdPolicy,
  syncNetBirdPolicyAfterTeleport,
} from "./netbird";
import { syncPersistedNetBirdPolicy, syncPersistedNetworkResource } from "./netbird-reconciliation";
import { applyTeleportAccessRequestEvent } from "./teleport";

function createSiteAndRouter(store: FusionStore, name: string, networkId: string): { siteId: string; routerGroupId: string } {
  const site = store.createSite({ name, networkId });
  const routerGroup = store.createRouterGroup({
    siteId: site.id,
    name: `${name} routers`,
    peerIds: [`${name.toLowerCase().replaceAll(" ", "-")}-router-01`],
  });

  return { siteId: site.id, routerGroupId: routerGroup.id };
}

function enrollDevice(store: FusionStore, subjectId = "alice", peerId = "alice-laptop"): void {
  store.createDevice({
    name: `${subjectId} device`,
    subjectId,
    peerId,
    netbirdGroupId: `grp_${peerId.replaceAll("-", "_")}`,
  });
}

function memoryRepository(store: FusionStore) {
  return {
    async read<T>(operation: (current: FusionStore) => T): Promise<T> {
      return operation(store);
    },
    async mutate<T>(operation: (current: FusionStore) => T): Promise<T> {
      return operation(store);
    },
  };
}

test("将 IPv4 端点映射为资产范围的 /32 网络资源", () => {
  const store = new FusionStore({ seed: false });
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });

  const endpoint = store.addEndpoint(asset.id, {
    address: "10.20.30.15",
    type: "ipv4",
  });

  assert.equal(endpoint.primary, true);
  assert.equal(endpoint.networkResource.destination, "10.20.30.15/32");
  assert.equal(endpoint.networkResource.networkId, "net_tokyo");
  assert.equal(endpoint.networkResource.routerGroupId, scope.routerGroupId);
  assert.equal(endpoint.networkResource.syncState, "desired");
});

test("从持久化快照恢复控制平面状态", () => {
  const store = new FusionStore({ seed: false });
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  const endpoint = store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });

  const restored = FusionStore.fromState(store.exportState());

  assert.deepEqual(restored.getAsset(asset.id), store.getAsset(asset.id));
  assert.equal(restored.getNetworkResource(endpoint.networkResource.id).destination, "10.20.30.15/32");
  assert.deepEqual(restored.listAuditEvents(), store.listAuditEvents());
});

test("通过文档化的 NetBird 资源 API 同步资产资源", async () => {
  const store = new FusionStore({ seed: false });
  const site = store.createSite({ name: "Tokyo", networkId: "net_tokyo" });
  const routerGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo routers",
    peerIds: ["tokyo-router-01"],
    netbirdGroupId: "grp_tokyo_routers",
  });
  const asset = store.createAsset({ siteId: site.id, routerGroupId: routerGroup.id, name: "mysql-prod-01" });
  const endpoint = store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/groups/grp_tokyo_routers")) {
        return new Response(JSON.stringify({ id: "grp_tokyo_routers" }), { status: 200 });
      }
      return new Response((init?.method ?? "GET") === "GET" ? "[]" : JSON.stringify({ id: "nb-resource-1" }), {
        status: 200,
      });
    },
  });

  const remoteId = await connector.syncResource(endpoint.networkResource, routerGroup);
  const synced = store.markNetworkResourceSynced(endpoint.networkResource.id, remoteId);

  assert.equal(remoteId, "nb-resource-1");
  assert.equal(calls[0].url, "https://netbird.example/api/groups/grp_tokyo_routers");
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Token token");
  assert.equal(calls[1].url, "https://netbird.example/api/networks/net_tokyo/resources");
  assert.equal(synced.syncState, "synced");
  assert.equal(synced.netbirdResourceId, remoteId);
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {
    name: endpoint.networkResource.name,
    description: `Fusion resource ${endpoint.networkResource.id}`,
    address: "10.20.30.15/32",
    enabled: true,
    groups: ["grp_tokyo_routers"],
  });
});

test("不会持久化过时的 NetBird 资源同步结果", async () => {
  const store = new FusionStore({ seed: false });
  const site = store.createSite({ name: "Tokyo", networkId: "net_tokyo" });
  const primaryRouterGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo routers",
    peerIds: ["tokyo-router-01"],
    netbirdGroupId: "grp_tokyo_routers",
  });
  const replacementRouterGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo replacement routers",
    peerIds: ["tokyo-router-02"],
    netbirdGroupId: "grp_tokyo_replacement_routers",
  });
  const asset = store.createAsset({ siteId: site.id, routerGroupId: primaryRouterGroup.id, name: "mysql-prod-01" });
  const endpoint = store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith(`/groups/${primaryRouterGroup.netbirdGroupId}`)) {
        return new Response(JSON.stringify({ id: primaryRouterGroup.netbirdGroupId }), { status: 200 });
      }
      if (requestUrl.endsWith("/resources") && init?.method === undefined) {
        store.updateAsset(asset.id, { routerGroupId: replacementRouterGroup.id });
        return new Response("[]", { status: 200 });
      }

      return new Response(JSON.stringify({ id: "nb-resource-1" }), { status: 200 });
    },
  });

  await assert.rejects(
    () => syncPersistedNetworkResource(endpoint.networkResource.id, memoryRepository(store), connector),
    (error: unknown) => error instanceof FusionError && error.status === 409,
  );

  const resource = store.getNetworkResource(endpoint.networkResource.id);
  assert.equal(resource.routerGroupId, replacementRouterGroup.id);
  assert.equal(resource.syncState, "desired");
  assert.equal(resource.netbirdResourceId, undefined);
});

test("无法验证 NetBird 组时不会写入资源", async () => {
  const store = new FusionStore({ seed: false });
  const site = store.createSite({ name: "Tokyo", networkId: "net_tokyo" });
  const routerGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo routers",
    peerIds: ["tokyo-router-01"],
    netbirdGroupId: "grp_tokyo_routers",
  });
  const asset = store.createAsset({ siteId: site.id, routerGroupId: routerGroup.id, name: "mysql-prod-01" });
  const endpoint = store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const calls: string[] = [];
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ id: "grp_unrelated" }), { status: 200 });
    },
  });

  await assert.rejects(
    () => connector.syncResource(endpoint.networkResource, routerGroup),
    (error: unknown) => error instanceof FusionError && error.status === 503,
  );

  assert.deepEqual(calls, ["https://netbird.example/api/groups/grp_tokyo_routers"]);
});

test("NetBird 同步需要独立密钥", () => {
  const previous = process.env.NETBIRD_SYNC_SECRET;
  try {
    delete process.env.NETBIRD_SYNC_SECRET;
    assert.throws(
      () => authorizeNetBirdSync(new Request("https://fusion.example/api/network-resources/sync")),
      (error: unknown) => error instanceof FusionError && error.status === 503,
    );

    process.env.NETBIRD_SYNC_SECRET = "sync-secret";
    assert.throws(
      () => authorizeNetBirdSync(new Request("https://fusion.example/api/network-resources/sync")),
      (error: unknown) => error instanceof FusionError && error.status === 401,
    );
    assert.throws(
      () =>
        authorizeNetBirdSync(
          new Request("https://fusion.example/api/network-resources/sync", {
            headers: { "x-netbird-sync-secret": "wrong-secret" },
          }),
        ),
      (error: unknown) => error instanceof FusionError && error.status === 401,
    );
    assert.doesNotThrow(() =>
      authorizeNetBirdSync(
        new Request("https://fusion.example/api/network-resources/sync", {
          headers: { "x-netbird-sync-secret": "sync-secret" },
        }),
      ),
    );
  } finally {
    if (previous === undefined) {
      delete process.env.NETBIRD_SYNC_SECRET;
    } else {
      process.env.NETBIRD_SYNC_SECRET = previous;
    }
  }
});

test("网络审计采集需要独立密钥", () => {
  const previous = process.env.NETWORK_AUDIT_INGEST_SECRET;
  try {
    delete process.env.NETWORK_AUDIT_INGEST_SECRET;
    assert.throws(
      () => authorizeNetworkAuditIngest(new Request("https://fusion.example/api/network-access-events")),
      (error: unknown) => error instanceof FusionError && error.status === 503,
    );

    process.env.NETWORK_AUDIT_INGEST_SECRET = "audit-secret";
    assert.throws(
      () => authorizeNetworkAuditIngest(new Request("https://fusion.example/api/network-access-events")),
      (error: unknown) => error instanceof FusionError && error.status === 401,
    );
    assert.throws(
      () =>
        authorizeNetworkAuditIngest(
          new Request("https://fusion.example/api/network-access-events", {
            headers: { "x-network-audit-secret": "wrong-secret" },
          }),
        ),
      (error: unknown) => error instanceof FusionError && error.status === 401,
    );
    assert.doesNotThrow(() =>
      authorizeNetworkAuditIngest(
        new Request("https://fusion.example/api/network-access-events", {
          headers: { "x-network-audit-secret": "audit-secret" },
        }),
      ),
    );
  } finally {
    if (previous === undefined) {
      delete process.env.NETWORK_AUDIT_INGEST_SECRET;
    } else {
      process.env.NETWORK_AUDIT_INGEST_SECRET = previous;
    }
  }
});

test("标记单个资源同步失败后继续批量 NetBird 同步", async () => {
  const store = new FusionStore({ seed: false });
  const site = store.createSite({ name: "Tokyo", networkId: "net_tokyo" });
  const routerGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo routers",
    peerIds: ["tokyo-router-01"],
    netbirdGroupId: "grp_tokyo_routers",
  });
  const firstAsset = store.createAsset({ siteId: site.id, routerGroupId: routerGroup.id, name: "mysql-prod-01" });
  const secondAsset = store.createAsset({ siteId: site.id, routerGroupId: routerGroup.id, name: "redis-prod-01" });
  const failed = store.addEndpoint(firstAsset.id, { address: "10.20.30.15", type: "ipv4" });
  const succeeded = store.addEndpoint(secondAsset.id, { address: "10.20.30.16", type: "ipv4" });
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async (url, init) => {
      if (String(url).endsWith("/groups/grp_tokyo_routers")) {
        return new Response(JSON.stringify({ id: "grp_tokyo_routers" }), { status: 200 });
      }
      if ((init?.method ?? "GET") === "GET") {
        return new Response("[]", { status: 200 });
      }

      const body = JSON.parse(String(init?.body)) as { address: string };
      return body.address === failed.networkResource.destination
        ? new Response("{}", { status: 503 })
        : new Response(JSON.stringify({ id: "nb-resource-2" }), { status: 200 });
    },
  });

  const results = await syncAllNetworkResources(store, connector);

  assert.equal(results.length, 2);
  assert.equal(store.getNetworkResource(failed.networkResource.id).syncState, "failed");
  assert.equal(store.getNetworkResource(succeeded.networkResource.id).syncState, "synced");
  assert.equal(results.find((result) => result.item.id === failed.networkResource.id)?.error, "NetBird API 请求失败，状态码为 503。");
  assert.ok(
    store
      .listAuditEvents()
      .some((event) => event.action === "network_resource.sync_failed" && event.resourceId === failed.networkResource.id),
  );
  assert.ok(
    store
      .listAuditEvents()
      .some((event) => event.action === "network_resource.synced" && event.resourceId === succeeded.networkResource.id),
  );
});

test("资产切换路由器组后将已同步资源标记为待同步", () => {
  const store = new FusionStore({ seed: false });
  const site = store.createSite({ name: "Tokyo", networkId: "net_tokyo" });
  const firstRouterGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo routers A",
    peerIds: ["tokyo-router-01"],
  });
  const secondRouterGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo routers B",
    peerIds: ["tokyo-router-02"],
  });
  const asset = store.createAsset({ siteId: site.id, routerGroupId: firstRouterGroup.id, name: "mysql-prod-01" });
  const endpoint = store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });

  store.markNetworkResourceSynced(endpoint.networkResource.id, "nb-resource-1");
  const updated = store.updateAsset(asset.id, { routerGroupId: secondRouterGroup.id });

  assert.equal(updated.endpoints[0].networkResource.routerGroupId, secondRouterGroup.id);
  assert.equal(updated.endpoints[0].networkResource.syncState, "desired");
  assert.ok(
    store
      .listAuditEvents()
      .some((event) => event.action === "network_resource.desired" && event.resourceId === endpoint.networkResource.id),
  );
});

test("将有效访问权限投影到专用 NetBird 策略，并在过期时移除", async () => {
  let current = new Date("2026-09-08T10:00:00.000Z");
  const store = new FusionStore({ seed: false, now: () => current });
  const device = store.createDevice({
    name: "Alice laptop",
    subjectId: "alice",
    peerId: "alice-laptop",
    netbirdGroupId: "grp_alice_laptop",
  });
  const site = store.createSite({ name: "Tokyo", networkId: "net_tokyo" });
  const routerGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo routers",
    peerIds: ["tokyo-router-01"],
  });
  const asset = store.createAsset({ siteId: site.id, routerGroupId: routerGroup.id, name: "mysql-prod-01" });
  const endpoint = store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const service = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  store.createAccessGrant({
    subjectId: device.subjectId,
    devicePeerId: device.peerId,
    scope: "service",
    assetId: asset.id,
    serviceId: service.id,
    validUntil: "2026-09-08T10:30:00.000Z",
  });
  store.markNetworkResourceSynced(endpoint.networkResource.id, "nb-resource-mysql");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/groups/grp_alice_laptop")) {
        return new Response(JSON.stringify({ id: "grp_alice_laptop", peers: [{ id: "alice-laptop" }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          id: "policy-fusion",
          name: "Fusion enforcement",
          description: "Managed by Fusion",
          enabled: true,
          source_posture_checks: [],
          rules: [],
        }),
        { status: 200 },
      );
    },
  });

  const first = await syncNetBirdPolicy(store, connector, "policy-fusion");

  assert.equal(first.ruleCount, 1);
  assert.equal(calls[0].url, "https://netbird.example/api/groups/grp_alice_laptop");
  assert.equal(calls[1].url, "https://netbird.example/api/policies/policy-fusion");
  assert.equal(calls[2].init?.method, "PUT");
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {
    name: "Fusion enforcement",
    description: "Managed by Fusion",
    enabled: true,
    source_posture_checks: [],
    rules: [
      {
        name: `Fusion access ${store.listEffectiveAccess()[0].id}`,
        description: `Fusion access ${store.listEffectiveAccess()[0].id}`,
        enabled: true,
        action: "accept",
        bidirectional: false,
        protocol: "tcp",
        ports: ["3306"],
        sources: ["grp_alice_laptop"],
        destinationResource: { id: "nb-resource-mysql", type: "host" },
      },
    ],
  });
  assert.ok(
    store
      .listAuditEvents()
      .some((event) => event.action === "network_policy.synced" && event.resourceId === "policy-fusion"),
  );

  current = new Date("2026-09-08T10:30:00.000Z");
  const expired = await syncNetBirdPolicy(store, connector, "policy-fusion");

  assert.equal(expired.ruleCount, 0);
  assert.deepEqual(JSON.parse(String(calls[4].init?.body)).rules, []);
});

test("授权变化后重试持久化 NetBird 策略同步", async () => {
  const store = new FusionStore({ seed: false });
  const device = store.createDevice({
    name: "Alice laptop",
    subjectId: "alice",
    peerId: "alice-laptop",
    netbirdGroupId: "grp_alice_laptop",
  });
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  const endpoint = store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const service = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const grant = store.createAccessGrant({
    subjectId: device.subjectId,
    devicePeerId: device.peerId,
    scope: "service",
    assetId: asset.id,
    serviceId: service.id,
    validUntil: "2030-09-08T10:30:00.000Z",
  });
  store.markNetworkResourceSynced(endpoint.networkResource.id, "nb-resource-mysql");
  let policyWrites = 0;
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async (url, init) => {
      if (String(url).endsWith("/groups/grp_alice_laptop")) {
        return new Response(JSON.stringify({ id: "grp_alice_laptop", peers: [{ id: "alice-laptop" }] }), { status: 200 });
      }
      if (init?.method === "PUT") {
        policyWrites += 1;
        if (policyWrites === 1) {
          store.revokeAccessGrant(grant.id);
        }
      }

      return new Response(
        JSON.stringify({
          id: "policy-fusion",
          name: "Fusion enforcement",
          description: "Managed by Fusion",
          enabled: true,
          source_posture_checks: [],
          rules: [],
        }),
        { status: 200 },
      );
    },
  });

  const result = await syncPersistedNetBirdPolicy("policy-fusion", memoryRepository(store), connector);

  assert.equal(policyWrites, 2);
  assert.equal(result.ruleCount, 0);
  assert.equal(store.listEffectiveAccess().length, 0);
  assert.ok(
    store
      .listAuditEvents()
      .some((event) => event.action === "network_policy.synced" && event.resourceId === "policy-fusion"),
  );
});

test("已注册设备组包含其他对等节点时默认拒绝", async () => {
  const store = new FusionStore({ seed: false });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  const endpoint = store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const service = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  store.createAccessGrant({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "service",
    assetId: asset.id,
    serviceId: service.id,
    validUntil: "2030-09-08T10:30:00.000Z",
  });
  store.markNetworkResourceSynced(endpoint.networkResource.id, "nb-resource-mysql");
  const calls: string[] = [];
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async (url) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({ id: "grp_alice_laptop", peers: [{ id: "alice-laptop" }, { id: "shared-peer" }] }),
        { status: 200 },
      );
    },
  });

  await assert.rejects(
    () => syncNetBirdPolicy(store, connector, "policy-fusion"),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );

  assert.deepEqual(calls, ["https://netbird.example/api/groups/grp_alice_laptop"]);
  assert.ok(
    store
      .listAuditEvents()
      .some((event) => event.action === "network_policy.sync_failed" && event.resourceId === "policy-fusion"),
  );
});

test("创建网络授权前需要受管且已注册的设备", () => {
  const store = new FusionStore({ seed: false });
  const site = store.createSite({ name: "Tokyo", networkId: "net_tokyo" });
  const routerGroup = store.createRouterGroup({
    siteId: site.id,
    name: "Tokyo routers",
    peerIds: ["tokyo-router-01"],
  });
  const asset = store.createAsset({ siteId: site.id, routerGroupId: routerGroup.id, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const service = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });

  assert.throws(
    () =>
      store.createAccessRequest({
        subjectId: "alice",
        devicePeerId: "alice-laptop",
        scope: "asset",
        assetId: asset.id,
        reason: "Production investigation",
        validUntil: "2030-09-08T10:30:00.000Z",
      }),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );
  assert.throws(
    () => store.createStaticAssetPermission({ subjectId: "alice", devicePeerId: "alice-laptop", assetId: asset.id }),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );
  assert.throws(
    () =>
      store.createAccessGrant({
        subjectId: "alice",
        devicePeerId: "alice-laptop",
        scope: "service",
        assetId: asset.id,
        serviceId: service.id,
        validUntil: "2030-09-08T10:30:00.000Z",
      }),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );

  store.createDevice({
    name: "Unmanaged Alice laptop",
    subjectId: "alice",
    peerId: "alice-laptop",
    netbirdGroupId: "grp_alice_laptop",
    managed: false,
  });
  assert.throws(
    () =>
      store.createAccessGrant({
        subjectId: "alice",
        devicePeerId: "alice-laptop",
        scope: "service",
        assetId: asset.id,
        serviceId: service.id,
        validUntil: "2030-09-08T10:30:00.000Z",
      }),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );
});

test("未显式启用前不会从 Teleport 同步 NetBird 策略", async () => {
  const previous = process.env.NETBIRD_POLICY_SYNC_ON_TELEPORT;
  const store = new FusionStore({ seed: false });
  let calls = 0;
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  });

  try {
    delete process.env.NETBIRD_POLICY_SYNC_ON_TELEPORT;
    assert.equal(await syncNetBirdPolicyAfterTeleport(store, connector), undefined);
    assert.equal(calls, 0);
  } finally {
    if (previous === undefined) {
      delete process.env.NETBIRD_POLICY_SYNC_ON_TELEPORT;
    } else {
      process.env.NETBIRD_POLICY_SYNC_ON_TELEPORT = previous;
    }
  }
});

test("允许不同站点命名空间中的重复地址", () => {
  const store = new FusionStore({ seed: false });
  const tokyo = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const osaka = createSiteAndRouter(store, "Osaka", "net_osaka");
  const tokyoAsset = store.createAsset({ ...tokyo, name: "nas-01" });
  const osakaAsset = store.createAsset({ ...osaka, name: "nas-01" });

  const first = store.addEndpoint(tokyoAsset.id, { address: "192.168.1.10", type: "ipv4" });
  const second = store.addEndpoint(osakaAsset.id, { address: "192.168.1.10", type: "ipv4" });

  assert.notEqual(first.networkResource.id, second.networkResource.id);
  assert.equal(first.networkResource.siteId, tokyo.siteId);
  assert.equal(second.networkResource.siteId, osaka.siteId);
});

test("拒绝同一站点内的重复端点", () => {
  const store = new FusionStore({ seed: false });
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const firstAsset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  const secondAsset = store.createAsset({ ...scope, name: "redis-prod-01" });
  store.addEndpoint(firstAsset.id, { address: "10.20.30.15", type: "ipv4" });

  assert.throws(
    () => store.addEndpoint(secondAsset.id, { address: "10.20.30.15", type: "ipv4" }),
    (error: unknown) => error instanceof FusionError && error.status === 409,
  );
});

test("要求资产路由器组属于所选站点", () => {
  const store = new FusionStore({ seed: false });
  const tokyo = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const osaka = createSiteAndRouter(store, "Osaka", "net_osaka");

  assert.throws(
    () => store.createAsset({ siteId: tokyo.siteId, routerGroupId: osaka.routerGroupId, name: "mysql-prod-01" }),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );
});

test("将可暴露服务限制在有效传输端口", () => {
  const store = new FusionStore({ seed: false });
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  const service = store.addService(asset.id, {
    name: "MySQL",
    protocol: "tcp",
    port: 3306,
    exposable: true,
  });

  assert.equal(service.accessMethod, "netbird");
  assert.equal(service.exposable, true);
  assert.throws(
    () => store.addService(asset.id, { name: "Invalid", protocol: "tcp", port: 65_536 }),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );
});

test("仅为绑定设备编译获准资产中可通过 NetBird 暴露的服务", () => {
  const store = new FusionStore({ seed: false });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const mysql = store.createAsset({ ...scope, name: "mysql-prod-01" });
  const redis = store.createAsset({ ...scope, name: "redis-prod-01" });
  store.addEndpoint(mysql.id, { address: "10.20.30.15", type: "ipv4" });
  store.addEndpoint(redis.id, { address: "10.20.30.16", type: "ipv4" });
  store.addService(mysql.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  store.addService(mysql.id, {
    name: "SSH",
    protocol: "tcp",
    port: 22,
    accessMethod: "teleport_ssh",
    exposable: true,
  });
  store.addService(redis.id, { name: "Redis", protocol: "tcp", port: 6379, exposable: true });
  const permission = store.createStaticAssetPermission({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    assetId: mysql.id,
  });

  const access = store.listCompiledAccess("alice-laptop", "alice");

  assert.equal(access.length, 1);
  assert.equal(access[0].authorizationId, permission.id);
  assert.equal(access[0].destination, "10.20.30.15/32");
  assert.equal(access[0].protocol, "tcp");
  assert.deepEqual(access[0].ports, [3306]);
  assert.deepEqual(access[0].sourcePeerIds, ["alice-laptop"]);
  assert.deepEqual(access[0].routerPeerIds, ["tokyo-router-01"]);
  assert.equal(store.listCompiledAccess("another-device", "alice").length, 0);
});

test("编译有效访问权限时要求同时提供主体和设备", () => {
  const store = new FusionStore({ seed: false });

  assert.throws(
    () => store.listCompiledAccess("alice-laptop", ""),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );
  assert.throws(
    () => store.getEffectiveNetworkMap("alice-laptop", ""),
    (error: unknown) => error instanceof FusionError && error.status === 422,
  );
});

test("没有可暴露 NetBird 服务时静态权限不生效", () => {
  const store = new FusionStore({ seed: false });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  store.addService(asset.id, { name: "SSH", protocol: "tcp", port: 22, exposable: false });
  store.createStaticAssetPermission({ subjectId: "alice", devicePeerId: "alice-laptop", assetId: asset.id });

  assert.equal(store.listCompiledAccess("alice-laptop", "alice").length, 0);
});

test("将服务范围权限收窄到所选协议和端口", () => {
  const store = new FusionStore({ seed: false });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "database-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const mysql = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  store.addService(asset.id, { name: "Admin", protocol: "tcp", port: 22, exposable: true });
  store.createStaticAssetPermission({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    assetId: asset.id,
    serviceId: mysql.id,
  });

  const access = store.listCompiledAccess("alice-laptop", "alice");

  assert.equal(access.length, 1);
  assert.equal(access[0].scope, "service");
  assert.equal(access[0].destination, "10.20.30.15/32");
  assert.deepEqual(access[0].ports, [3306]);
  assert.equal(access.some((rule) => rule.ports.includes(22)), false);
});

test("编译设备绑定访问授权并在撤销时移除规则", () => {
  const current = new Date("2026-09-08T10:00:00.000Z");
  const store = new FusionStore({ seed: false, now: () => current });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const mysql = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const grant = store.createAccessGrant({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "service",
    assetId: asset.id,
    serviceId: mysql.id,
    validUntil: "2026-09-08T10:30:00.000Z",
    requestId: "req-123",
    reason: "Production investigation",
  });

  const access = store.listCompiledAccess("alice-laptop", "alice");

  assert.equal(access.length, 1);
  assert.equal(access[0].source, "access_grant");
  assert.equal(access[0].authorizationId, grant.id);
  assert.equal(access[0].validUntil, "2026-09-08T10:30:00.000Z");
  assert.deepEqual(access[0].ports, [3306]);
  assert.equal(store.revokeAccessGrant(grant.id).status, "revoked");
  assert.equal(store.listCompiledAccess("alice-laptop", "alice").length, 0);
});

test("保持访问申请待审批而不创建网络授权", () => {
  const store = new FusionStore({ seed: false });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const mysql = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });

  const request = store.createAccessRequest({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "service",
    assetId: asset.id,
    serviceId: mysql.id,
    reason: "Production investigation",
    validUntil: "2030-09-08T10:30:00.000Z",
  });

  assert.equal(request.status, "pending");
  assert.equal(store.listAccessGrants().length, 0);
  assert.equal(store.listCompiledAccess("alice-laptop", "alice").length, 0);
  assert.ok(store.listAuditEvents().some((event) => event.action === "access_request.created" && event.resourceId === request.id));
});

test("根据有效策略记录网络决策而不信任上报方", () => {
  const store = new FusionStore({ seed: false });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const mysql = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const grant = store.createAccessGrant({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "service",
    assetId: asset.id,
    serviceId: mysql.id,
    validUntil: "2030-09-08T10:30:00.000Z",
  });

  const allowed = store.recordNetworkAccessEvent({
    userId: "alice",
    deviceId: "alice-laptop",
    routerPeerId: "tokyo-router-01",
    destination: "10.20.30.15/32",
    protocol: "tcp",
    port: 3306,
  });
  const denied = store.recordNetworkAccessEvent({
    userId: "alice",
    deviceId: "alice-laptop",
    routerPeerId: "tokyo-router-01",
    destination: "10.20.30.15/32",
    protocol: "tcp",
    port: 22,
  });

  assert.equal(allowed.decision, "allow");
  assert.equal(allowed.grantId, grant.id);
  assert.equal(allowed.assetId, asset.id);
  assert.equal(denied.decision, "deny");
  assert.equal(denied.grantId, undefined);
  assert.equal(store.listNetworkAccessEvents().length, 2);
});

test("运行文档化的 Teleport 到 NetBird MVP，包含限定范围且会过期的授权", async () => {
  let current = new Date("2026-09-08T10:00:00.000Z");
  const store = new FusionStore({ seed: false, now: () => current });
  store.createDevice({
    name: "Alice device",
    subjectId: "alice",
    peerId: "alice-device",
    netbirdGroupId: "grp_alice_device",
  });
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const mysql = store.createAsset({ ...scope, name: "mysql-prod" });
  const mysqlEndpoint = store.addEndpoint(mysql.id, { address: "10.20.30.15", type: "ipv4" });
  const mysqlService = store.addService(mysql.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const redis = store.createAsset({ ...scope, name: "redis-prod" });
  const redisEndpoint = store.addEndpoint(redis.id, { address: "10.20.30.16", type: "ipv4" });
  const redisService = store.addService(redis.id, { name: "Redis", protocol: "tcp", port: 6379, exposable: true });
  store.markNetworkResourceSynced(mysqlEndpoint.networkResource.id, "nb-resource-mysql");
  const policyCalls: Array<{ url: string; init?: RequestInit }> = [];
  const connector = new NetBirdConnector({
    apiUrl: "https://netbird.example/api",
    token: "token",
    fetch: async (url, init) => {
      policyCalls.push({ url: String(url), init });
      if (String(url).endsWith("/groups/grp_alice_device")) {
        return new Response(JSON.stringify({ id: "grp_alice_device", peers: [{ id: "alice-device" }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ id: "policy-fusion", name: "Fusion enforcement", enabled: true, rules: [] }),
        { status: 200 },
      );
    },
  });
  const connection = (destination: string, port: number) =>
    store.recordNetworkAccessEvent({
      userId: "alice",
      deviceId: "alice-device",
      routerPeerId: "tokyo-router-01",
      destination,
      protocol: "tcp",
      port,
    });

  assert.equal(connection(mysqlEndpoint.networkResource.destination, 3306).decision, "deny");
  assert.equal(connection(redisEndpoint.networkResource.destination, 6379).decision, "deny");

  applyTeleportAccessRequestEvent(store, {
    type: "approved",
    requestId: "req-123",
    reviewerId: "bob",
    subjectId: "alice",
    devicePeerId: "alice-device",
    scope: "service",
    assetId: mysql.id,
    serviceId: mysqlService.id,
    validUntil: "2026-09-08T10:30:00.000Z",
    reason: "Production investigation",
  });

  const allowed = connection(mysqlEndpoint.networkResource.destination, 3306);
  assert.equal(allowed.decision, "allow");
  assert.equal(allowed.requestId, "req-123");
  assert.equal(allowed.reviewerId, "bob");
  assert.equal(allowed.assetId, mysql.id);
  assert.equal(allowed.serviceId, mysqlService.id);
  assert.equal(connection(mysqlEndpoint.networkResource.destination, 22).decision, "deny");
  assert.equal(connection(redisEndpoint.networkResource.destination, redisService.port).decision, "deny");
  const policy = await syncNetBirdPolicy(store, connector, "policy-fusion");

  assert.equal(policy.ruleCount, 1);
  assert.equal(policyCalls[0].url, "https://netbird.example/api/groups/grp_alice_device");
  assert.equal(policyCalls[2].init?.method, "PUT");
  assert.deepEqual(JSON.parse(String(policyCalls[2].init?.body)).rules, [
    {
      name: `Fusion access ${store.listEffectiveAccess()[0].id}`,
      description: `Fusion access ${store.listEffectiveAccess()[0].id}`,
      enabled: true,
      action: "accept",
      bidirectional: false,
      protocol: "tcp",
      ports: ["3306"],
      sources: ["grp_alice_device"],
      destinationResource: { id: "nb-resource-mysql", type: "host" },
    },
  ]);
  assert.equal(policyCalls.some((call) => call.init?.method === "POST"), false);

  current = new Date("2026-09-08T10:30:00.000Z");
  assert.equal(connection(mysqlEndpoint.networkResource.destination, 3306).decision, "deny");
  assert.equal(store.getEffectiveNetworkMap("alice-device", "alice").accessRules.length, 0);
  assert.ok(store.listAuditEvents().some((event) => event.action === "access_grant.expired"));
  assert.equal((await syncNetBirdPolicy(store, connector, "policy-fusion")).ruleCount, 0);
  assert.deepEqual(JSON.parse(String(policyCalls[4].init?.body)).rules, []);
});

test("授权在 TTL 到期时失效，无需手动删除策略", () => {
  let current = new Date("2026-09-08T10:00:00.000Z");
  const store = new FusionStore({ seed: false, now: () => current });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const grant = store.createAccessGrant({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "asset",
    assetId: asset.id,
    validUntil: "2026-09-08T10:30:00.000Z",
  });

  assert.equal(store.listCompiledAccess("alice-laptop", "alice").length, 1);
  current = new Date("2026-09-08T10:30:00.000Z");
  assert.equal(store.listCompiledAccess("alice-laptop", "alice").length, 0);
  assert.equal(store.getAccessGrant(grant.id).status, "expired");
  assert.ok(store.listAuditEvents().some((event) => event.action === "access_grant.expired" && event.resourceId === grant.id));
});

test("在创建授权时快照站点范围资产和服务", () => {
  const current = new Date("2026-09-08T10:00:00.000Z");
  const store = new FusionStore({ seed: false, now: () => current });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const mysql = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(mysql.id, { address: "10.20.30.15", type: "ipv4" });
  store.addService(mysql.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const grant = store.createAccessGrant({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "site",
    siteId: scope.siteId,
    validUntil: "2026-09-08T10:30:00.000Z",
  });
  const redis = store.createAsset({ ...scope, name: "redis-prod-01" });
  store.addEndpoint(redis.id, { address: "10.20.30.16", type: "ipv4" });
  store.addService(redis.id, { name: "Redis", protocol: "tcp", port: 6379, exposable: true });

  const access = store.getCompiledAccessForGrant(grant.id);

  assert.deepEqual(grant.assetIds, [mysql.id]);
  assert.equal(access.length, 1);
  assert.equal(access[0].destination, "10.20.30.15/32");
  assert.equal(access.some((rule) => rule.destination === "10.20.30.16/32"), false);
});

test("将已批准的 Teleport 请求映射为一条幂等授权，并按请求 ID 撤销", () => {
  const current = new Date("2026-09-08T10:00:00.000Z");
  const store = new FusionStore({ seed: false, now: () => current });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const mysql = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const event = {
    type: "approved",
    requestId: "req-123",
    reviewerId: "bob",
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "service",
    assetId: asset.id,
    serviceId: mysql.id,
    validUntil: "2026-09-08T10:30:00.000Z",
    reason: "Production investigation",
  };

  const created = applyTeleportAccessRequestEvent(store, event);
  const duplicate = applyTeleportAccessRequestEvent(store, event);
  const access = store.listCompiledAccess("alice-laptop", "alice");

  assert.equal(created.action, "created");
  assert.equal(created.grants.length, 1);
  assert.equal(created.grants[0].source, "teleport");
  assert.equal(created.grants[0].requestId, "req-123");
  assert.equal(created.grants[0].reviewerId, "bob");
  assert.equal(duplicate.action, "unchanged");
  assert.equal(duplicate.grants[0].id, created.grants[0].id);
  assert.equal(store.listAccessGrants().length, 1);
  assert.equal(access.length, 1);
  assert.equal(access[0].requestId, "req-123");
  assert.equal(access[0].reviewerId, "bob");

  const revoked = applyTeleportAccessRequestEvent(store, { type: "revoked", requestId: "req-123" });

  assert.equal(revoked.action, "revoked");
  assert.equal(revoked.grants[0].status, "revoked");
  assert.equal(store.listCompiledAccess("alice-laptop", "alice").length, 0);
});

test("授权撤销时更改有效网络映射版本", () => {
  const current = new Date("2026-09-08T10:00:00.000Z");
  const store = new FusionStore({ seed: false, now: () => current });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const mysql = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const emptyMap = store.getEffectiveNetworkMap("alice-laptop", "alice");
  const grant = store.createAccessGrant({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "service",
    assetId: asset.id,
    serviceId: mysql.id,
    validUntil: "2026-09-08T10:30:00.000Z",
  });
  const grantedMap = store.getEffectiveNetworkMap("alice-laptop", "alice");

  assert.equal(grantedMap.accessRules.length, 1);
  assert.equal(grantedMap.accessRules[0].destination, "10.20.30.15/32");
  assert.notEqual(grantedMap.revision, emptyMap.revision);

  store.revokeAccessGrant(grant.id);
  const revokedMap = store.getEffectiveNetworkMap("alice-laptop", "alice");

  assert.equal(revokedMap.accessRules.length, 0);
  assert.notEqual(revokedMap.revision, grantedMap.revision);
});

test("在显式导入创建资源前保持发现资产未受管", () => {
  const store = new FusionStore({ seed: false });
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const discovered = store.createDiscoveredAsset({
    siteId: scope.siteId,
    routerGroupId: scope.routerGroupId,
    address: "10.20.30.17",
    type: "ipv4",
    hostname: "legacy-db-01.internal",
    source: "arp",
  });

  assert.equal(discovered.status, "unmanaged");
  assert.equal(store.listAssets().length, 0);
  assert.equal(store.listNetworkResources().length, 0);
  assert.equal(store.getEffectiveNetworkMap("alice-laptop", "alice").accessRules.length, 0);

  const asset = store.importDiscoveredAsset(discovered.id, { name: "legacy-db-01" });
  const imported = store.listDiscoveredAssets()[0];

  assert.equal(asset.endpoints[0].networkResource.destination, "10.20.30.17/32");
  assert.equal(imported.status, "imported");
  assert.equal(imported.importedAssetId, asset.id);
  assert.throws(
    () => store.importDiscoveredAsset(discovered.id, { name: "legacy-db-01" }),
    (error: unknown) => error instanceof FusionError && error.status === 409,
  );
});

test("拒绝会产生重复受管端点的导入，不创建资产", () => {
  const store = new FusionStore({ seed: false });
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const managed = store.createAsset({ ...scope, name: "existing-db" });
  store.addEndpoint(managed.id, { address: "10.20.30.18", type: "ipv4" });
  const discovered = store.createDiscoveredAsset({
    ...scope,
    address: "10.20.30.18",
    type: "ipv4",
  });

  assert.throws(
    () => store.importDiscoveredAsset(discovered.id, { name: "duplicate-db" }),
    (error: unknown) => error instanceof FusionError && error.status === 409,
  );
  assert.equal(store.listAssets().length, 1);
  assert.equal(store.listDiscoveredAssets()[0].status, "unmanaged");
});

test("记录成功的控制平面和 Teleport 变更而不审计读取", () => {
  assert.equal(new FusionStore().listAuditEvents().length, 0);
  const store = new FusionStore({ seed: false });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const discovered = store.createDiscoveredAsset({
    ...scope,
    address: "10.20.30.19",
    type: "ipv4",
    source: "cmdb",
  });
  const asset = store.importDiscoveredAsset(discovered.id, { name: "audit-db" });
  const service = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306, exposable: true });
  const grant = store.createAccessGrant({
    subjectId: "alice",
    devicePeerId: "alice-laptop",
    scope: "service",
    assetId: asset.id,
    serviceId: service.id,
    source: "teleport",
    requestId: "req-audit",
    reviewerId: "bob",
    validUntil: "2030-09-08T10:30:00.000Z",
  });
  const eventCountBeforeRead = store.listAuditEvents().length;

  store.getEffectiveNetworkMap("alice-laptop", "alice");
  store.revokeAccessGrant(grant.id);

  const events = store.listAuditEvents();
  assert.equal(events.length, eventCountBeforeRead + 1);
  assert.equal(events[0].action, "access_grant.revoked");
  assert.equal(events[0].origin, "teleport");
  assert.ok(events.some((event) => event.action === "discovery.created" && event.details.source === "cmdb"));
  assert.ok(events.some((event) => event.action === "discovery.imported" && event.details.assetId === asset.id));
  assert.ok(events.some((event) => event.action === "endpoint.created" && event.resourceId === asset.endpoints[0].id));
  assert.ok(events.some((event) => event.action === "access_grant.created" && event.origin === "teleport"));
});

test("删除资产时移除其端点资源和服务", () => {
  const store = new FusionStore({ seed: false });
  enrollDevice(store);
  const scope = createSiteAndRouter(store, "Tokyo", "net_tokyo");
  const asset = store.createAsset({ ...scope, name: "mysql-prod-01" });
  store.addEndpoint(asset.id, { address: "10.20.30.15", type: "ipv4" });
  const service = store.addService(asset.id, { name: "MySQL", protocol: "tcp", port: 3306 });
  store.createStaticAssetPermission({ subjectId: "alice", devicePeerId: "alice-laptop", assetId: asset.id });

  store.deleteAsset(asset.id);

  assert.equal(store.listNetworkResources().length, 0);
  assert.equal(store.listStaticAssetPermissions().length, 0);
  assert.throws(
    () => store.getService(service.id),
    (error: unknown) => error instanceof FusionError && error.status === 404,
  );
});
