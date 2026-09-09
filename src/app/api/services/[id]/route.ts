import { apiError, readJson } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const body = await readJson(request);
    return Response.json({ item: await fusionRepository.mutate((store) => store.updateService(id, body)) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    await fusionRepository.mutate((store) => store.deleteService(id));
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
