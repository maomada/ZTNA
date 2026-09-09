import { apiError } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    return Response.json({ item: await fusionRepository.mutate((store) => store.revokeAccessGrant(id)) });
  } catch (error) {
    return apiError(error);
  }
}
