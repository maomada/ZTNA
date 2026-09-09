import { fusionRepository } from "@/lib/fusion-repository";

export async function GET(): Promise<Response> {
  return Response.json({ items: await fusionRepository.read((store) => store.listAuditEvents()) });
}
