// ============================================================
// engine/system/pic-service.ts — 图片资产服务
//
// PicDef / 三段式索引（`mod:type(pic):id`）解析（原 GameInstance
// 门面方法组的外移）：
// - urlOf：直连 URL / 相对路径 → 原样返回；三段式索引 → 查 pics 表
//   解析（zip 来源经 ImageStore 取本地解出图片）；未声明 → undefined。
// - defOf：pics 表查询。
// - register：登记压缩包解出的本地图片（导入流程在 reload 前调用）。
// ============================================================

import type { Registry } from '../registry/registry';
import type { ImageStore, ResolvedImageEntry } from '../image/index';
import { resolvePicSrc } from '../image/index';
import type { PicDef } from '../types/pics';

export class PicService {
  constructor(
    private readonly registry: Registry,
    private readonly imageStore: ImageStore,
  ) {}

  /** 解析图片引用为可显示 URL；未声明 / zip 未登记 → undefined（UI 回退占位）。 */
  urlOf(ref: string | undefined): string | undefined {
    return resolvePicSrc(this.registry, this.imageStore, ref);
  }

  /** 取图片资产定义（pics 表查询）；未声明返回 undefined。 */
  defOf(ref: string): PicDef | undefined {
    return this.registry.pics.get(ref);
  }

  /** 登记一批压缩包解出的本地图片。 */
  register(mod: string, entries: readonly ResolvedImageEntry[]): void {
    this.imageStore.registerAll(mod, entries);
  }
}
