import { apiError, readJson } from "@/lib/api";
import { fusionRepository } from "@/lib/fusion-repository";

export async function GET(): Promise<Response> {
  return Response.json({ items: await fusionRepository.read((store) => store.listRouterGroups()) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    return Response.json({ item: await fusionRepository.mutate((store) => store.createRouterGroup(body)) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
