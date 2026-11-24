import "dotenv/config";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

const encryptionKey = process.env.ENCRYPTION_KEY;

if (!encryptionKey || !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
  throw new Error(
    "ENCRYPTION_KEY must be a 64-character hexadecimal string"
  );
}

const KEY = Buffer.from(encryptionKey, "hex");
const ALGORITHM = "aes-256-gcm";

export function encryptPassword(password: string): string {
  const iv = randomBytes(12);

  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptPassword(encryptedPassword: string): string {
  const parts = encryptedPassword.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted password format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const decipher = createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}