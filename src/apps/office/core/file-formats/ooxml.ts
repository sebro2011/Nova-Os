import { Unzip, UnzipInflate } from 'fflate';

export interface OoxmlLimits {
  maxEntries?: number;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
}

export interface OoxmlArchive {
  entries: string[];
  files: Record<string, Uint8Array>;
}

function joinChunks(chunks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Extract only requested OOXML entries, enforcing actual streamed output budgets. */
export function extractOoxml(
  bytes: Uint8Array,
  include: (name: string) => boolean,
  limits: OoxmlLimits = {},
): Promise<OoxmlArchive> {
  if (bytes.length < 22 || (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04)) {
    return Promise.reject(new Error('This is not a valid or complete OOXML ZIP archive.'));
  }
  const maxEntries = limits.maxEntries ?? 250;
  const maxEntryBytes = limits.maxEntryBytes ?? 12_000_000;
  const maxTotalBytes = limits.maxTotalBytes ?? 32_000_000;
  return new Promise((resolve, reject) => {
    const entries: string[] = [];
    const files: Record<string, Uint8Array> = {};
    const active = new Set<{ terminate: () => void }>();
    let pending = 0;
    let totalBytes = 0;
    let archiveEnded = false;
    let settled = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      active.forEach((file) => file.terminate());
      reject(new Error(message));
    };
    const finishIfReady = () => {
      if (!settled && archiveEnded && pending === 0) {
        settled = true;
        resolve({ entries, files });
      }
    };
    const archive = new Unzip();
    archive.register(UnzipInflate);
    archive.onfile = (file) => {
      if (settled) return;
      entries.push(file.name);
      if (entries.length > maxEntries || file.name.length > 240) {
        fail('This Office archive contains too many or invalid entries.');
        return;
      }
      if (!include(file.name)) return;
      if (file.originalSize !== undefined && file.originalSize > maxEntryBytes) {
        fail(`The Office entry “${file.name}” exceeds the decompressed size limit.`);
        return;
      }
      pending += 1;
      active.add(file);
      const chunks: Uint8Array[] = [];
      let entrySize = 0;
      file.ondata = (error, chunk, final) => {
        if (settled) return;
        if (error) {
          fail(`The Office entry “${file.name}” could not be decompressed safely.`);
          return;
        }
        entrySize += chunk.length;
        totalBytes += chunk.length;
        if (entrySize > maxEntryBytes || totalBytes > maxTotalBytes) {
          fail('The decompressed Office content exceeds the safe import budget.');
          return;
        }
        chunks.push(chunk);
        if (final) {
          files[file.name] = joinChunks(chunks, entrySize);
          active.delete(file);
          pending -= 1;
          finishIfReady();
        }
      };
      try {
        file.start();
      } catch {
        fail(`The Office entry “${file.name}” uses an unsupported compression method.`);
      }
    };
    try {
      archive.push(bytes, true);
      archiveEnded = true;
      finishIfReady();
    } catch {
      fail('This is not a valid or complete OOXML ZIP archive.');
    }
  });
}

export function decodeOoxmlText(bytes: Uint8Array | undefined, name: string): string {
  if (!bytes) throw new Error(`The required Office entry “${name}” is missing.`);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`The Office entry “${name}” is not valid UTF-8.`);
  }
}

export function hasOoxmlMacro(entries: string[]): boolean {
  return entries.some((name) => /(?:vbaProject|macros|activeX|embeddings|oleObject)/i.test(name));
}
