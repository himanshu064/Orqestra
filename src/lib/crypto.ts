import crypto from "node:crypto";

import { env } from "@/env";

/**
 * AES-256-GCM secret encryption for BYO provider API keys (requirements §55).
 * Ciphertext is stored as `iv:tag:data` (all base64). The key comes from
 * SETTINGS_ENCRYPTION_KEY, which must be the base64 encoding of 32 random bytes
 * (generate with `openssl rand -base64 32`).
 */

function getKey(): Buffer {
  const key = Buffer.from(env.SETTINGS_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY must be base64 of 32 random bytes (openssl rand -base64 32).",
    );
  }
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed ciphertext.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
