import { apiError, readJson } from "@/lib/api";
import { authorizeNetworkAuditIngest } from "@/lib/fusion";
import { fusionRepository } from "@/lib/fusion-repository";

export async function GET(): Promise<Response> {
  return Response.json({ items: await fusionRepository.read((store) => store.listNetworkAccessEvents()) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    authorizeNetworkAuditIngest(request);
    const input = await readJson(request);
    return Response.json({ item: await fusionRepository.mutate((store) => store.recordNetworkAccessEvent(input)) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
