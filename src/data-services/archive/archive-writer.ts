import JSZip from 'jszip';

export type ArchiveEntryContent = string | Uint8Array;

export interface ArchiveEntry {
  /** POSIX 相对文件路径；目录由路径中的 / 表达。 */
  readonly path: string;
  readonly content: ArchiveEntryContent;
}

export interface ArchivePlan {
  readonly entries: readonly ArchiveEntry[];
}

export interface ArchiveWriter {
  write(plan: ArchivePlan): Promise<Uint8Array>;
}

export class ArchiveWriteError extends Error {
  readonly path?: string;

  constructor(message: string, path?: string) {
    super(path ? '[' + path + '] ' + message : message);
    this.name = 'ArchiveWriteError';
    this.path = path;
  }
}

const ZIP_EPOCH = new Date(0);

export function normalizeArchivePath(path: string): string {
  if (typeof path !== 'string' || path.length === 0) {
    throw new ArchiveWriteError('归档路径不能为空。');
  }
  if (path.includes('\0')) throw new ArchiveWriteError('归档路径不能包含 NUL 字符。', path);
  if (path.includes('\\')) throw new ArchiveWriteError('归档路径必须使用 POSIX "/" 分隔符。', path);
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    throw new ArchiveWriteError('归档路径必须是相对路径。', path);
  }
  const parts = path.split('/');
  if (parts.some(part => part.length === 0 || part === '.' || part === '..')) {
    throw new ArchiveWriteError('归档路径不能包含空段、"." 或 ".."。', path);
  }
  return parts.join('/');
}

export function serializeArchiveJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  if (json === undefined) throw new ArchiveWriteError('归档 JSON 无法序列化。');
  return json + '\n';
}

export function jsonArchiveEntry(path: string, value: unknown): ArchiveEntry {
  return { path, content: serializeArchiveJson(value) };
}

export function validateArchivePlan(plan: ArchivePlan): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  const paths = new Set<string>();
  for (const entry of plan.entries) {
    const path = normalizeArchivePath(entry.path);
    if (paths.has(path)) throw new ArchiveWriteError('归档路径重复。', path);
    if (typeof entry.content !== 'string' && !(entry.content instanceof Uint8Array)) {
      throw new ArchiveWriteError('归档内容必须是 UTF-8 文本或 Uint8Array。', path);
    }
    paths.add(path);
    entries.push({
      path,
      content: typeof entry.content === 'string' ? entry.content : new Uint8Array(entry.content),
    });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

export class ZipArchiveWriter implements ArchiveWriter {
  async write(plan: ArchivePlan): Promise<Uint8Array> {
    const zip = new JSZip();
    for (const entry of validateArchivePlan(plan)) {
      zip.file(entry.path, entry.content, {
        binary: entry.content instanceof Uint8Array,
        createFolders: false,
        date: ZIP_EPOCH,
      });
    }
    return zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
      platform: 'DOS',
    });
  }
}

export async function writeZipArchive(plan: ArchivePlan): Promise<Uint8Array> {
  return new ZipArchiveWriter().write(plan);
}
