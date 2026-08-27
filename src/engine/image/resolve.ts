// ============================================================
// engine/image/resolve.ts — 图片索引解析（纯函数）
//
// 约束：def / 数据结构只持有 PicId（`mod:type(pic):id`），不得持有裸 URL。
// 实际图片 URL 的唯一来源是 PicDef 表，经本函数解析后输出给前端。
// ============================================================

import type { Registry } from '../registry/registry';
import { isPicRef, isZipPicSrc, parsePicId, zipPathOf } from '../types/pics';
import type { ImageStore } from './image-store';

/**
 * 解析 PicId 为可显示 URL。
 * @param ref 三段式图片索引 `mod:type(pic):id`（非 PicId 返回 undefined）
 * @param store zip 图片存储（src 为 `zip:` 时用于取本地解出图片）
 */
export function resolvePicSrc(
  registry: Registry,
  store: ImageStore | undefined,
  ref: string | undefined,
): string | undefined {
  if (!ref) return undefined;
  if (!isPicRef(ref)) return undefined;
  const parsed = parsePicId(ref)!;
  const def = registry.pics.get(ref);
  if (!def) return undefined;
  return resolveDefSrc(store, parsed.mod, def.src);
}

/** 由 PicDef.src 解析出最终 URL（按 mod 名路由到 ImageStore）。 */
export function resolveDefSrc(
  store: ImageStore | undefined,
  mod: string,
  src: string,
): string | undefined {
  if (isZipPicSrc(src)) {
    return store?.get(mod, zipPathOf(src));
  }
  return src;
}
