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
    throw new FusionError("Teleport event must be a JSON object.", 400);
  }

  return value as Input;
}

function requiredString(input: Input, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new FusionError(`${key} must be a non-empty string.`, 422);
  }

  return value.trim();
}

function eventType(input: Input): TeleportEventType {
  const value = requiredString(input, "type").toLowerCase();
  if (value !== "approved" && value !== "revoked" && value !== "expired") {
    throw new FusionError("type must be one of: approved, revoked, expired.", 422);
  }

  return value;
}

export function authorizeTeleportWebhook(request: Request): void {
  const expected = process.env.TELEPORT_WEBHOOK_SECRET;
  if (expected === undefined || expected === "") {
    throw new FusionError("Teleport webhook is not configured.", 503);
  }

  const received = request.headers.get("x-teleport-webhook-secret");
  if (received === null) {
    throw new FusionError("Unauthorized Teleport webhook.", 401);
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new FusionError("Unauthorized Teleport webhook.", 401);
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
