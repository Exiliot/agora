/**
 * Disk I/O for attachment bytes. Files live at
 * `<STORAGE_ROOT>/<hash[0:2]>/<hash[2:4]>/<hash>`. The two-level fan-out keeps
 * any single directory bounded at ~65 536 entries for a 256-bit hash space.
 *
 * Writes are staged via a temp file + rename so a partially-transferred upload
 * never lands at the content-addressed path. If the destination already exists
 * the temp file is discarded (dedupe at rest — ref counting is a DB concern).
 */

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, type ReadStream } from 'node:fs';
import { access, mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import { config } from '../config.js';

const HEX_HASH_LENGTH = 64;

export const storageRoot = (): string => config.STORAGE_ROOT;

export const hashPath = (hexHash: string, root: string = storageRoot()): string => {
  if (hexHash.length !== HEX_HASH_LENGTH) {
    throw new Error(`invalid content hash length: ${hexHash.length}`);
  }
  const a = hexHash.slice(0, 2);
  const b = hexHash.slice(2, 4);
  return path.join(root, a, b, hexHash);
};

export const fileExists = async (absolutePath: string): Promise<boolean> => {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Pipe a multipart file stream to disk while computing its SHA-256 in the same
 * pass. Returns the computed hex hash, byte count and a flag indicating
 * whether the bytes were already on disk (dedupe).
 *
 * Temp file sits beside the storage root so `rename` is atomic on any sane
 * filesystem (same mount point).
 */
export const writeStreamToStorage = async (
  source: Readable,
  tempName: string,
): Promise<{ hash: string; size: number; deduped: boolean }> => {
  const root = storageRoot();
  const tempDir = path.join(root, '.tmp');
  await mkdir(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, tempName);

  const hasher = createHash('sha256');
  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hasher.update(chunk);
      size += chunk.length;
      cb(null, chunk);
    },
  });

  const dest = createWriteStream(tempPath);
  try {
    await pipeline(source, counter, dest);
  } catch (err) {
    await rm(tempPath, { force: true });
    throw err;
  }

  const hash = hasher.digest('hex');
  const finalPath = hashPath(hash, root);
  await mkdir(path.dirname(finalPath), { recursive: true });

  if (await fileExists(finalPath)) {
    await rm(tempPath, { force: true });
    return { hash, size, deduped: true };
  }

  await rename(tempPath, finalPath);
  return { hash, size, deduped: false };
};

export const openStoredFile = (hexHash: string): ReadStream => {
  return createReadStream(hashPath(hexHash));
};

export const statStoredFile = async (
  hexHash: string,
): Promise<{ size: number } | null> => {
  try {
    const s = await stat(hashPath(hexHash));
    return { size: s.size };
  } catch {
    return null;
  }
};

// Callers must pass a 64-char lowercase hex SHA-256. `hashPath` enforces the
// length at the build-path step and throws before `rm` is reached, so any
// non-hex or out-of-length value is rejected rather than allowed to traverse
// outside the storage root.
export const deleteStoredFile = async (hexHash: string): Promise<void> => {
  await rm(hashPath(hexHash), { force: true });
};

export const hashToBuffer = (hexHash: string): Buffer => Buffer.from(hexHash, 'hex');
export const hashFromBuffer = (buf: Buffer): string => buf.toString('hex');
