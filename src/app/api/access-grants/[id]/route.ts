import { apiError } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    return Response.json({ item: await fusionRepository.mutate((store) => store.getAccessGrant(id)) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    await fusionRepository.mutate((store) => store.deleteAccessGrant(id));
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
