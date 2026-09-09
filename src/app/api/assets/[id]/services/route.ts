import { apiError, readJson } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const body = await readJson(request);
    return Response.json(
      { item: await fusionRepository.mutate((store) => store.addService(id, body)) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
