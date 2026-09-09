import { timingSafeEqual } from "node:crypto";

import { FusionError, FusionStore } from "./fusion";
import type { AccessGrant } from "./fusion";

type Input = Record<string, unknown>;
type TeleportEventType = "approved" | "revoked" | "expired";

export interface TeleportEventResult {
  action: "created" | "unchanged" | "revoked";
  grants: AccessGrant[];
}

function asInput(value: unknown): Input {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new FusionError("Teleport 事件必须是 JSON 对象。", 400);
  }

  return value as Input;
}

function requiredString(input: Input, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new FusionError(`${key} 必须是非空字符串。`, 422);
  }

  return value.trim();
}

function eventType(input: Input): TeleportEventType {
  const value = requiredString(input, "type").toLowerCase();
  if (value !== "approved" && value !== "revoked" && value !== "expired") {
    throw new FusionError("type 必须是以下值之一：approved、revoked、expired。", 422);
  }

  return value;
}

export function authorizeTeleportWebhook(request: Request): void {
  const expected = process.env.TELEPORT_WEBHOOK_SECRET;
  if (expected === undefined || expected === "") {
    throw new FusionError("Teleport Webhook 尚未配置。", 503);
  }

  const received = request.headers.get("x-teleport-webhook-secret");
  if (received === null) {
    throw new FusionError("未获授权的 Teleport Webhook 请求。", 401);
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new FusionError("未获授权的 Teleport Webhook 请求。", 401);
  }
}

export function applyTeleportAccessRequestEvent(store: FusionStore, value: unknown): TeleportEventResult {
  const input = asInput(value);
  const type = eventType(input);
  const requestId = requiredString(input, "requestId");

  if (type === "approved") {
    const existing = store.getAccessGrantForTeleportRequest(requestId);
    if (existing !== undefined) {
      return { action: "unchanged", grants: [existing] };
    }

    return {
      action: "created",
      grants: [store.createAccessGrant({ ...input, source: "teleport", requestId })],
    };
  }

  return {
    action: "revoked",
    grants: store.revokeAccessGrantsForTeleportRequest(requestId),
  };
}
