import { apiError } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";
import { authorizeNetBirdSync, netBirdPolicyIdFromEnvironment, NetBirdConnector } from "@/lib/netbird";
import { syncPersistedNetBirdPolicy } from "@/lib/netbird-reconciliation";

export async function POST(request: Request): Promise<Response> {
  try {
    authorizeNetBirdSync(request);
    const item = await syncPersistedNetBirdPolicy(
      netBirdPolicyIdFromEnvironment(),
      fusionRepository,
      NetBirdConnector.fromEnvironment(),
    );
    return Response.json({ item });
  } catch (error) {
    return apiError(error);
  }
}
