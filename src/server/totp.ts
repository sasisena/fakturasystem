/** TOTP (RFC 6238) med SHA-1, 6 siffer og 30 sekunders steg – virker med vanlige autentiseringsapper. */
import { createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Ugyldig base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, '0');
}

/** Godtar koden for inneværende steg og ett steg før/etter (klokkeavvik). */
export function verifyTotp(secret: string, code: string, at: Date): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const step = Math.floor(at.getTime() / 1000 / 30);
  return [-1, 0, 1].some((d) => hotp(secret, step + d) === code);
}

export function otpauthUri(secret: string, email: string): string {
  return `otpauth://totp/Fakturasystem:${encodeURIComponent(email)}?secret=${secret}&issuer=Fakturasystem&algorithm=SHA1&digits=6&period=30`;
}
