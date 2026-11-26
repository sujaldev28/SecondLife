import path from 'node:path';
import AdmZip from 'adm-zip';
import { env } from '../config/env.js';
import { BadRequestError } from '../utils/errors.js';

export interface ArchiveInspectionResult {
  fileCount: number;
  totalUncompressedBytes: number;
  files: Array<{ path: string; size: number; contentPreview?: string }>;
  detectedManifests: string[];
  detectedLicenseFileText?: string;
}

const MAX_ENTRIES = 5000;
const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150 MB decompression ceiling (zip bomb protection)
const MAX_COMPRESSION_RATIO = 100;
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php',
  '.json', '.yaml', '.yml', '.toml', '.md', '.txt', '.sql', '.sh', '.env',
]);

export function inspectSafeZipArchive(buffer: Buffer): ArchiveInspectionResult {
  if (buffer.byteLength === 0) {
    throw new BadRequestError('Uploaded archive is empty');
  }
  if (buffer.byteLength > env.AI_MAX_ARCHIVE_BYTES) {
    throw new BadRequestError(`Archive exceeds max allowed size (${env.AI_MAX_ARCHIVE_BYTES} bytes)`);
  }
  // Verify ZIP magic bytes PK\x03\x04 or empty zip PK\x05\x06
  if (buffer.byteLength < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new BadRequestError('Invalid archive format: only standard ZIP archives are permitted');
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BadRequestError('Corrupted or unreadable ZIP archive');
  }

  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) {
    throw new BadRequestError(`Archive contains too many entries (limit: ${MAX_ENTRIES})`);
  }

  let totalUncompressedBytes = 0;
  let fileCount = 0;
  const files: Array<{ path: string; size: number; contentPreview?: string }> = [];
  const detectedManifests: string[] = [];
  let detectedLicenseFileText: string | undefined;

  for (const entry of entries) {
    const rawName = entry.rawEntryName ? entry.rawEntryName.toString('utf8') : entry.entryName;
    const entryName = entry.entryName.replace(/\\/g, '/');
    const rawNormalized = rawName.replace(/\\/g, '/');

    // Zip Slip & dangerous path protection (inspect both parsed and raw header entry names)
    for (const candidateName of [entryName, rawNormalized]) {
      if (
        candidateName.includes('..') ||
        candidateName.startsWith('/') ||
        /^[a-zA-Z]:/.test(candidateName) ||
        candidateName.includes('\0')
      ) {
        throw new BadRequestError(`Unsafe archive entry path rejected: ${candidateName}`);
      }
    }

    if (entry.isDirectory) continue;
    fileCount += 1;

    const uncompressed = entry.header.size;
    const compressed = Math.max(1, entry.header.compressedSize);
    if (uncompressed / compressed > MAX_COMPRESSION_RATIO && uncompressed > 1024 * 1024) {
      throw new BadRequestError('Archive rejected due to suspicious compression ratio (potential zip bomb)');
    }

    totalUncompressedBytes += uncompressed;
    if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new BadRequestError('Archive uncompressed size exceeds safety ceiling');
    }

    const baseName = path.posix.basename(entryName).toLowerCase();
    const ext = path.posix.extname(entryName).toLowerCase();

    if (
      baseName === 'package.json' ||
      baseName === 'requirements.txt' ||
      baseName === 'pyproject.toml' ||
      baseName === 'go.mod' ||
      baseName === 'cargo.toml' ||
      baseName === 'readme.md'
    ) {
      detectedManifests.push(entryName);
    }

    let contentPreview: string | undefined;
    if ((TEXT_EXTENSIONS.has(ext) || baseName === 'license' || baseName === 'license.md' || baseName === 'readme.md') && uncompressed <= 256 * 1024 && files.length < 250) {
      try {
        contentPreview = entry.getData().toString('utf8').slice(0, 12000);
        if (baseName.startsWith('license')) {
          detectedLicenseFileText = contentPreview.slice(0, 4000);
        }
      } catch {
        contentPreview = undefined;
      }
    }

    files.push({ path: entryName, size: uncompressed, contentPreview });
  }

  return {
    fileCount,
    totalUncompressedBytes,
    files,
    detectedManifests,
    detectedLicenseFileText,
  };
}
