import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export const DEV_TENANT = '00000000-0000-4000-8000-000000000001';
export const DEV_USER = '00000000-0000-4000-8000-000000000002';
export function hashPassword(password: string) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function verifyPassword(password: string, encoded: string) {
  const [salt,hash]=encoded.split(':'); if(!salt||!hash) return false;
  const expected=Buffer.from(hash,'hex'); const actual=scryptSync(password,salt,64);
  return expected.length===actual.length && timingSafeEqual(expected,actual);
}
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
