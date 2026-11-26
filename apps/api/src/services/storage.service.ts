import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { sha256Hex } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';

export interface StoredObject {
  key: string;
  sha256: string;
  sizeBytes: number;
}

export class LocalStorageService {
  private readonly baseDir: string;

  constructor(baseDir = env.STORAGE_LOCAL_DIR) {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  private resolveSafePath(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.includes('..') || normalized.includes('\0')) {
      throw new BadRequestError('Invalid storage key');
    }
    const resolved = path.resolve(this.baseDir, normalized);
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new BadRequestError('Path traversal rejected');
    }
    return resolved;
  }

  async putObject(key: string, data: Buffer): Promise<StoredObject> {
    const dest = this.resolveSafePath(key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    return {
      key,
      sha256: sha256Hex(data),
      sizeBytes: data.byteLength,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const src = this.resolveSafePath(key);
    if (!fs.existsSync(src)) {
      throw new BadRequestError('Stored object does not exist');
    }
    return fs.readFileSync(src);
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.resolveSafePath(key);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  }
}

export const storageService = new LocalStorageService();
