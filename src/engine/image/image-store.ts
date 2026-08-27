// ============================================================
// engine/image/image-store.ts — 运行时图片存储（压缩包解出 / 注册的本地图片）
//
// 纯逻辑层：只做字符串 URL 的登记与查询，不接触 DOM / 文件系统。
// 键 = `modName + 包内相对路径`；值 = 可显示 URL（data: / blob: / objectURL）。
// 由 UI 的压缩包导入流程在 reload 前填充；解析见 resolve.ts。
// ============================================================

/** 一张已解出的本地图片（zip 内相对路径 → 可显示 URL）。 */
export interface ResolvedImageEntry {
  path: string;
  url: string;
}

export class ImageStore {
  private byMod = new Map<string, Map<string, string>>();

  /** 登记一张图片（同 mod+path 重复登记覆盖）。 */
  register(mod: string, zipPath: string, url: string): void {
    let inner = this.byMod.get(mod);
    if (!inner) {
      inner = new Map();
      this.byMod.set(mod, inner);
    }
    inner.set(zipPath, url);
  }

  /** 批量登记（导入流程用）。 */
  registerAll(mod: string, entries: readonly ResolvedImageEntry[]): void {
    for (const e of entries) this.register(mod, e.path, e.url);
  }

  /** 是否已登记某图片。 */
  has(mod: string, zipPath: string): boolean {
    return this.byMod.get(mod)?.has(zipPath) ?? false;
  }

  /** 取已登记图片的可显示 URL；未登记返回 undefined。 */
  get(mod: string, zipPath: string): string | undefined {
    return this.byMod.get(mod)?.get(zipPath);
  }

  /** 全部清空（切换 Mod / 新会话时调用）。 */
  clear(): void {
    this.byMod.clear();
  }

  /** 已登记图片总数（调试用）。 */
  get size(): number {
    let n = 0;
    for (const inner of this.byMod.values()) n += inner.size;
    return n;
  }
}
