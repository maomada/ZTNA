import { apiError, readJson } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";

export async function GET(): Promise<Response> {
  return Response.json({ items: await fusionRepository.read((store) => store.listAccessRequests()) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readJson(request);
    return Response.json({ item: await fusionRepository.mutate((store) => store.createAccessRequest(input)) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
