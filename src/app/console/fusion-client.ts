export interface FusionMutationResult<T> {
  ok: boolean;
  item?: T;
  error?: string;
}

export async function fusionMutate<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE" = "POST",
  body?: unknown,
): Promise<FusionMutationResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { item?: T; error?: string };
    if (!response.ok) {
      return { ok: false, error: result.error ?? "请求失败。" };
    }

    return { ok: true, item: result.item };
  } catch {
    return { ok: false, error: "网络错误，请重试。" };
  }
}
