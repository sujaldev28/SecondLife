import crypto from 'node:crypto';
import net from 'node:net';
import { BadRequestError } from './errors.js';

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

export function generateCode(prefix: string): string {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const yr = new Date().getFullYear();
  return `${prefix}-${yr}-${rand}`;
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isPrivateOrReservedIp(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, '');
  if (!net.isIP(clean)) return false;

  if (clean === '::1' || clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) {
    return true;
  }
  const parts = clean.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * Validates outbound repository URLs to prevent SSRF attacks against internal services/metadata.
 */
export function validateSafeExternalUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestError('Invalid URL format');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestError('Only HTTPS repository URLs are permitted');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    isPrivateOrReservedIp(hostname)
  ) {
    throw new BadRequestError('Private, loopback, or internal network URLs are forbidden');
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestError('Embedded credentials in URLs are not permitted');
  }

  return parsed;
}
