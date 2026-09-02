// 运行时图片资源存储：登记压缩包解出的可显示 URL。

export interface ResolvedImageEntry {
  path: string;
  url: string;
}

export class ImageStore {
  private byMod = new Map<string, Map<string, string>>();

  register(mod: string, zipPath: string, url: string): void {
    let inner = this.byMod.get(mod);
    if (!inner) {
      inner = new Map();
      this.byMod.set(mod, inner);
    }
    inner.set(zipPath, url);
  }

  registerAll(mod: string, entries: readonly ResolvedImageEntry[]): void {
    for (const entry of entries) this.register(mod, entry.path, entry.url);
  }

  has(mod: string, zipPath: string): boolean {
    return this.byMod.get(mod)?.has(zipPath) ?? false;
  }

  get(mod: string, zipPath: string): string | undefined {
    return this.byMod.get(mod)?.get(zipPath);
  }

  clear(): void {
    this.byMod.clear();
  }

  get size(): number {
    let count = 0;
    for (const images of this.byMod.values()) count += images.size;
    return count;
  }
}
