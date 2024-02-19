import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// encrypt/decrypt
const algo = "aes-256-cbc";
const encryptionSecret = process.env.ENCRYPTION_SECRET;

// ENCRYPT FUNCTION
export const encrypt = (text) => {
  const IV_LENGTH = 16;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algo, Buffer.from(encryptionSecret), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

// DECRYPT FUNCTION
export const decrypt = (text) => {
  const [iv, encryptedText] = text.split(":");

  const decipher = crypto.createDecipheriv(
    algo,
    Buffer.from(encryptionSecret),
    Buffer.from(iv, "hex"),
  );

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString();
};
