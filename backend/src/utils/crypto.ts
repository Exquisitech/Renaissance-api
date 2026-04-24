import crypto from 'crypto';

const keys = {
  v1: process.env.ENCRYPTION_KEY_V1!,
  v2: process.env.ENCRYPTION_KEY_V2!, // for rotation
};

const currentKey = keys.v2; // always use latest

export function encrypt(value: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(currentKey, 'hex'), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return JSON.stringify({ iv: iv.toString('hex'), tag, encrypted });
}

export function decrypt(value: string): string {
  const { iv, tag, encrypted } = JSON.parse(value);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(currentKey, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
