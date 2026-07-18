import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM (authenticated encryption) for client credentials that need to
// be decrypted and used programmatically later (social media tokens, API
// keys), as opposed to smart-onboarding.ts's local encrypt/decrypt, which is
// scoped to that wizard's own draft data and its own key source.
const ALGO = "aes-256-gcm";

function getCredentialsEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be set to encrypt or decrypt client credentials — no insecure fallback is used here.",
    );
  }
  return Buffer.from(secret.slice(0, 32).padEnd(32, "0"));
}

// Returns "{iv_hex}:{authTag_hex}:{ciphertext_hex}".
export function encrypt(text: string): string {
  const key = getCredentialsEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string): string {
  const key = getCredentialsEncryptionKey();
  const [ivHex, tagHex, encHex] = data.split(":");
  if (!ivHex || !tagHex || !encHex) {
    throw new Error("Invalid encrypted credential format");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
}
