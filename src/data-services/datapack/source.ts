import JSZip from 'jszip';

export interface PackEntry {
  path: string;
  read(): Promise<Uint8Array>;
}

export interface PackSource {
  readonly kind: 'file' | 'folder' | 'zip';
  list(): Promise<PackEntry[]>;
}

/** 将 ZIP 视为不可变虚拟文件夹，向上层提供统一条目读取接口。 */
export class ZipPackSource implements PackSource {
  readonly kind = 'zip' as const;

  constructor(private readonly zip: JSZip) {}

  async list(): Promise<PackEntry[]> {
    const entries: PackEntry[] = [];
    this.zip.forEach((path, file) => {
      if (file.dir || path.endsWith('/')) return;
      entries.push({
        path,
        read: () => file.async('uint8array'),
      });
    });
    return entries;
  }
}
