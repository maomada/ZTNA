import { FusionError } from "@/lib/fusion";

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new FusionError("Request body must be a JSON object.", 400);
    }

    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof FusionError) {
      throw error;
    }

    throw new FusionError("Request body must be valid JSON.", 400);
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof FusionError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("Fusion API request failed", error);
  return Response.json({ error: "Internal server error." }, { status: 500 });
}
