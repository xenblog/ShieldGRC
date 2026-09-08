import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';

export const EVIDENCE_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB per file

export const EVIDENCE_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

export const EVIDENCE_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.docx',
  '.xlsx',
  '.csv',
  '.txt',
]);

export function getEvidenceStorageDir(): string {
  // In Docker, EVIDENCE_STORAGE_DIR is always set explicitly (see
  // docker-compose.yml) to the mounted volume path. This fallback only
  // matters for running the backend directly on a dev machine.
  return process.env.EVIDENCE_STORAGE_DIR || path.join(process.cwd(), 'data', 'evidence');
}

/** Strips any directory components and unsafe characters from a client-supplied filename. */
export function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.length > 0 ? base : 'evidence';
}

export function assertAllowedEvidenceFile(originalName: string, mimeType: string, sizeBytes: number): void {
  const ext = path.extname(originalName).toLowerCase();
  if (!EVIDENCE_ALLOWED_EXTENSIONS.has(ext) || !EVIDENCE_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BadRequestException(
      `File type not allowed: ${originalName}. Allowed types: ${[...EVIDENCE_ALLOWED_EXTENSIONS].join(', ')}`,
    );
  }
  if (sizeBytes > EVIDENCE_MAX_SIZE_BYTES) {
    throw new BadRequestException(
      `File too large: ${originalName}. Maximum size is ${EVIDENCE_MAX_SIZE_BYTES / (1024 * 1024)}MB`,
    );
  }
}

/**
 * Writes an uploaded file's buffer to disk under
 * <EVIDENCE_STORAGE_DIR>/<controlTestId>/<uuid>-<sanitizedFilename> and
 * returns the resulting storagePath (relative to the evidence root, never
 * served directly by the reverse proxy - only via the backend's guarded
 * download endpoint).
 */
export async function writeEvidenceFile(
  controlTestId: string,
  originalName: string,
  buffer: Buffer,
): Promise<string> {
  const dir = path.join(getEvidenceStorageDir(), controlTestId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${uuidv4()}-${sanitizeFilename(originalName)}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);
  return path.join(controlTestId, filename);
}

export function resolveEvidencePath(storagePath: string): string {
  return path.join(getEvidenceStorageDir(), storagePath);
}
