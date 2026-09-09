import { FusionError, FusionStore } from "./fusion";
import type { FusionState, NetworkResource, RouterGroup } from "./fusion";
import type { FusionRepository } from "./fusion-repository";
import {
  netBirdPolicyIdFromEnvironment,
  NetBirdConnector,
} from "./netbird";
import type { NetBirdPolicySyncResult, NetworkResourceSyncResult } from "./netbird";

type StoreRepository = Pick<FusionRepository, "read" | "mutate">;

interface ResourcePlan {
  resource: NetworkResource;
  routerGroup: RouterGroup;
}

interface PolicyPlan {
  state: FusionState;
  revision: string;
}

function hasSameResourceConfiguration(current: NetworkResource, expected: NetworkResource): boolean {
  return (
    current.networkId === expected.networkId &&
    current.routerGroupId === expected.routerGroupId &&
    current.name === expected.name &&
    current.address === expected.address &&
    current.type === expected.type &&
    current.destination === expected.destination
  );
}

export async function syncPersistedNetworkResource(
  resourceId: string,
  repository: StoreRepository,
  connector: NetBirdConnector = NetBirdConnector.fromEnvironment(),
): Promise<NetworkResource> {
  const plan = await repository.read<ResourcePlan>((store) => {
    const resource = store.getNetworkResource(resourceId);
    return { resource, routerGroup: store.getRouterGroup(resource.routerGroupId) };
  });
  let remoteSynchronized = false;

  try {
    const netbirdResourceId = await connector.syncResource(plan.resource, plan.routerGroup);
    remoteSynchronized = true;
    return repository.mutate((store) => {
      const current = store.getNetworkResource(resourceId);
      if (!hasSameResourceConfiguration(current, plan.resource)) {
        throw new FusionError("网络资源在同步期间已更改。请重试同步。", 409);
      }

      return store.markNetworkResourceSynced(resourceId, netbirdResourceId);
    });
  } catch (error) {
    if (!remoteSynchronized) {
      await repository
        .mutate((store) => {
          const current = store.getNetworkResource(resourceId);
          if (hasSameResourceConfiguration(current, plan.resource)) {
            store.markNetworkResourceSyncFailed(resourceId);
          }
        })
        .catch(() => undefined);
    }

    throw error;
  }
}

export async function syncAllPersistedNetworkResources(
  repository: StoreRepository,
  connector: NetBirdConnector = NetBirdConnector.fromEnvironment(),
): Promise<NetworkResourceSyncResult[]> {
  const resources = await repository.read((store) => store.listNetworkResources());
  const results: NetworkResourceSyncResult[] = [];

  for (const resource of resources) {
    try {
      results.push({ item: await syncPersistedNetworkResource(resource.id, repository, connector) });
    } catch (error) {
      const item = await repository.read((store) => {
        try {
          return store.getNetworkResource(resource.id);
        } catch {
          return resource;
        }
      });
      results.push({ item, error: error instanceof Error ? error.message : "NetBird 同步失败。" });
    }
  }

  return results;
}

export async function syncPersistedNetBirdPolicy(
  policyId: string,
  repository: StoreRepository,
  connector: NetBirdConnector = NetBirdConnector.fromEnvironment(),
): Promise<NetBirdPolicySyncResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const plan = await repository.mutate<PolicyPlan>((store) => {
      const access = store.listEffectiveAccess();
      return { state: store.exportState(), revision: JSON.stringify(access) };
    });

    try {
      const result = await connector.syncEffectivePolicy(FusionStore.fromState(plan.state), policyId);
      const recorded = await repository.mutate((store) => {
        if (JSON.stringify(store.listEffectiveAccess()) !== plan.revision) {
          return false;
        }

        store.recordNetBirdPolicySynced(result.id, result.ruleCount);
        return true;
      });
      if (recorded) {
        return result;
      }
    } catch (error) {
      await repository.mutate((store) => store.recordNetBirdPolicySyncFailed(policyId));
      throw error;
    }
  }

  throw new FusionError("有效访问权限在 NetBird 策略同步期间已更改。请重试同步。", 409);
}

export async function syncPersistedNetBirdPolicyAfterTeleport(
  repository: StoreRepository,
  connector?: NetBirdConnector,
): Promise<NetBirdPolicySyncResult | undefined> {
  if (process.env.NETBIRD_POLICY_SYNC_ON_TELEPORT !== "true") {
    return undefined;
  }

  return syncPersistedNetBirdPolicy(netBirdPolicyIdFromEnvironment(), repository, connector);
}
