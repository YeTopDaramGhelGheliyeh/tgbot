import { logger } from '../lib/logger';
import type { Lens } from '../types/session.context';
import fs from 'fs';
import path from 'path';

function randomString(length: number, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export type ExpiryChoice = '4h' | '10h' | '24h' | '2d' | '3d' | '4d';

export function choiceToMs(choice: ExpiryChoice): number {
  switch (choice) {
    case '4h':
      return 4 * 60 * 60 * 1000;
    case '10h':
      return 10 * 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '2d':
      return 2 * 24 * 60 * 60 * 1000;
    case '3d':
      return 3 * 24 * 60 * 60 * 1000;
    case '4d':
      return 4 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

const BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://morilens.party').replace(/\/$/, '');
const GRACE_MS = 4 * 24 * 60 * 60 * 1000; // 4 days after expiry
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_PATH = path.join(DATA_DIR, 'lenses.json');

type Persisted = {
  lenses: Lens[];
  short: Record<string, string>;
};

class LensRegistry {
  private lensesByCode = new Map<string, Lens>();

  private lensesByOwner = new Map<number, Set<string>>();

  private shortToLong = new Map<string, string>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        const payload = JSON.parse(raw) as Persisted;
        for (const l of payload.lenses || []) {
          this.lensesByCode.set(l.code, l);
          if (!this.lensesByOwner.has(l.ownerUserId)) this.lensesByOwner.set(l.ownerUserId, new Set());
          this.lensesByOwner.get(l.ownerUserId)!.add(l.code);
        }
        for (const [k, v] of Object.entries(payload.short || {})) {
          this.shortToLong.set(k, v);
        }
        logger.info('Loaded lenses from disk', { count: this.lensesByCode.size });
      } else {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        this.save();
      }
    } catch (err) {
      logger.error(err, 'Failed to load lenses data');
    }
  }

  private save() {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const payload: Persisted = {
        lenses: Array.from(this.lensesByCode.values()),
        short: Object.fromEntries(this.shortToLong.entries()),
      };
      fs.writeFileSync(DATA_PATH, JSON.stringify(payload, null, 2));
    } catch (err) {
      logger.error(err, 'Failed to save lenses data');
    }
  }

  createLens(ownerUserId: number, name: string, kind: 'camera' | 'online' = 'camera'): Lens {
    // Ensure uniqueness of code
    let code: string;
    do {
      code = randomString(6);
    } while (this.lensesByCode.has(code));

    const lens: Lens = { code, name, ownerUserId, kind };
    this.lensesByCode.set(code, lens);
    if (!this.lensesByOwner.has(ownerUserId)) this.lensesByOwner.set(ownerUserId, new Set());
    this.lensesByOwner.get(ownerUserId)!.add(code);
    logger.info('Created new lens', { ownerUserId, code, name });
    this.save();
    return lens;
  }

  connectLens(code: string, groupId: number): Lens | undefined {
    const lens = this.lensesByCode.get(code);
    if (!lens) return undefined;
    lens.groupId = groupId;
    logger.info('Lens connected to group', { code, groupId });
    this.save();
    return lens;
  }

  setExpiry(code: string, expiresAt: number): Lens | undefined {
    const lens = this.lensesByCode.get(code);
    if (!lens) return undefined;
    lens.expiresAt = expiresAt;
    logger.info('Lens expiry set', { code, expiresAt });
    this.save();
    return lens;
  }

  getLens(code: string): Lens | undefined {
    return this.lensesByCode.get(code);
  }

  listByOwner(ownerUserId: number): Lens[] {
    this.cleanup();
    const codes = this.lensesByOwner.get(ownerUserId);
    if (!codes) return [];
    return Array.from(codes).map((c) => this.lensesByCode.get(c)!).filter(Boolean);
  }

  isExpired(code: string): boolean {
    const lens = this.lensesByCode.get(code);
    if (!lens || !lens.expiresAt) return false;
    return Date.now() > lens.expiresAt;
  }

  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [code, lens] of this.lensesByCode.entries()) {
      if (lens.expiresAt && now - lens.expiresAt > GRACE_MS) {
        this.lensesByCode.delete(code);
        const ownerSet = this.lensesByOwner.get(lens.ownerUserId);
        if (ownerSet) {
          ownerSet.delete(code);
          if (ownerSet.size === 0) this.lensesByOwner.delete(lens.ownerUserId);
        }
        removed += 1;
      }
    }
    if (removed > 0) {
      logger.info('Cleaned up expired lenses beyond grace period', { removed });
      this.save();
    }
  }

  ensureShort(longUrl: string): { shortCode: string; shortUrl: string } {
    // Return existing mapping if present
    for (const [short, long] of this.shortToLong.entries()) {
      if (long === longUrl) {
        return { shortCode: short, shortUrl: this.shortUrl(short) };
      }
    }
    let shortCode: string;
    do {
      shortCode = randomString(7, 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789');
    } while (this.shortToLong.has(shortCode));
    this.shortToLong.set(shortCode, longUrl);
    this.save();
    return { shortCode, shortUrl: this.shortUrl(shortCode) };
  }

  resolveShort(shortCode: string): string | undefined {
    return this.shortToLong.get(shortCode);
  }

  longUrl(code: string, expiresAt?: number): string {
    const base = BASE_URL;
    const exp = expiresAt ?? this.lensesByCode.get(code)?.expiresAt;
    const qs = exp ? `?exp=${exp}` : '';
    return `${base}/lens/${encodeURIComponent(code)}${qs}`;
  }

  shortUrl(shortCode: string): string {
    const base = BASE_URL;
    return `${base}/l/${encodeURIComponent(shortCode)}`;
  }

  onlineUrl(code: string, expiresAt?: number): string {
    const base = BASE_URL;
    const exp = expiresAt ?? this.lensesByCode.get(code)?.expiresAt;
    const qs = exp ? `?exp=${exp}` : '';
    return `${base}/online/${encodeURIComponent(code)}${qs}`;
  }
}

export const lensRegistry = new LensRegistry();
