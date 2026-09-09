import { apiError } from "@/lib/api";
import { FusionError } from "@/lib/fusion";
import { fusionRepository } from "@/lib/fusion-repository";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const devicePeerId = url.searchParams.get("devicePeerId");
    if (devicePeerId === null) {
      throw new FusionError("必须提供 devicePeerId。", 422);
    }
    const subjectId = url.searchParams.get("subjectId");
    if (subjectId === null) {
      throw new FusionError("必须提供 subjectId。", 422);
    }

    return Response.json({ item: await fusionRepository.mutate((store) => store.getEffectiveNetworkMap(devicePeerId, subjectId)) });
  } catch (error) {
    return apiError(error);
  }
}
