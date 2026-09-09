import { apiError } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";
import { authorizeNetBirdSync, NetBirdConnector } from "@/lib/netbird";
import { syncAllPersistedNetworkResources } from "@/lib/netbird-reconciliation";

export async function POST(request: Request): Promise<Response> {
  try {
    authorizeNetBirdSync(request);
    const items = await syncAllPersistedNetworkResources(fusionRepository, NetBirdConnector.fromEnvironment());
    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}
