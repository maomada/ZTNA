import { apiError, readJson } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";
import { syncPersistedNetBirdPolicyAfterTeleport } from "@/lib/netbird-reconciliation";
import { applyTeleportAccessRequestEvent, authorizeTeleportWebhook } from "@/lib/teleport";

export async function POST(request: Request): Promise<Response> {
  try {
    authorizeTeleportWebhook(request);
    const input = await readJson(request);
    const result = await fusionRepository.mutate((store) => applyTeleportAccessRequestEvent(store, input));
    const policySync = await syncPersistedNetBirdPolicyAfterTeleport(fusionRepository);
    return Response.json({ ...result, policySync }, { status: result.action === "created" ? 201 : 200 });
  } catch (error) {
    return apiError(error);
  }
}
