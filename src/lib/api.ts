import { FusionError } from "@/lib/fusion";

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new FusionError("请求体必须是 JSON 对象。", 400);
    }

    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof FusionError) {
      throw error;
    }

    throw new FusionError("请求体必须是有效的 JSON。", 400);
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof FusionError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("Fusion API 请求失败", error);
  return Response.json({ error: "内部服务器错误。" }, { status: 500 });
}
