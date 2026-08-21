import { createHash, randomBytes } from "node:crypto";

/** Uses 256 bits of entropy; only its SHA-256 digest is persisted. */
export function createPrivateAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPrivateAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
