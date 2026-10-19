import { createHmac, timingSafeEqual } from "node:crypto";

// An opaque, keyed credential version. Never put a password/hash in a JWT.
// A changed bcrypt hash invalidates every token, including same-second changes.
export function sessionBinding(userId, passwordHash) {
  if (!Number.isSafeInteger(userId) || userId < 1 || typeof passwordHash !== "string" || !passwordHash) {
    throw new TypeError("A valid account credential is required for a session");
  }
  return createHmac("sha256", process.env.JWT_SECRET)
    .update(JSON.stringify(["fintrack-session-v1", userId, passwordHash]))
    .digest("hex");
}

export function matchesSessionBinding(binding, userId, passwordHash) {
  if (typeof binding !== "string" || !/^[a-f0-9]{64}$/.test(binding)) return false;
  return timingSafeEqual(Buffer.from(binding, "hex"), Buffer.from(sessionBinding(userId, passwordHash), "hex"));
}
