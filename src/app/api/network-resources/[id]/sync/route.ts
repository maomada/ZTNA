import { apiError } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";
import { authorizeNetBirdSync, NetBirdConnector } from "@/lib/netbird";
import { syncPersistedNetworkResource } from "@/lib/netbird-reconciliation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    authorizeNetBirdSync(request);
    const item = await syncPersistedNetworkResource((await params).id, fusionRepository, NetBirdConnector.fromEnvironment());
    return Response.json({ item });
  } catch (error) {
    return apiError(error);
  }
}
