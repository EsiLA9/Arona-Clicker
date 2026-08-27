// ============================================================
// engine/types/pics.ts — 图片资产（PicDef）与索引格式
//
// 索引约定：`modName:typeName(pic):idName` 三段式（如
// `base:avatar(pic):hoshino` / `modA:background(pic):schale_office`）。
// - modName    = 数据包 mod 名（第一段，与 datapack.name 对应）
// - typeName   = 图片用途类别（第二段，含字面 `(pic)` 标记），如
//                avatar 头像 / background 聊天流背景 / sticker 贴图 /
//                card 卡面 / icon 图标 / banner 横幅 —— 类别开放，mod 可自定
// - idName     = 该类别内的唯一 id（第三段，禁 `:`）
//
// src 支持两种来源：
// - 直连 URL（http(s)/data/blob 或相对路径）：原样使用
// - `zip:<包内相对路径>`（如 `zip:assets/avatar/hoshino.png`）：
//   指向 Mod 压缩包内已提取的本地图片，经 ImageStore 解析成可显示 URL
// ============================================================

/** 完整图片索引：`modName:typeName(pic):idName`。 */
export type PicId = string;

/**
 * 图片用途类别（即索引第二段 typeName）。开放扩展，推荐取值：
 * avatar / background / sticker / card / icon / banner。
 */
export type PicKind = string;

export interface PicDef {
  /**
   * 完整索引 id（三段式 `modName:typeName(pic):idName`）
   * @label ID
   */
  id: PicId;
  /**
   * 图片来源：
   * - 直连 URL（http/https/data/blob/相对路径），原样使用；
   * - `zip:assets/xxx.png` 引用 Mod 压缩包内提取的本地图片（包内相对路径，解出后经 ImageStore 解析）。
   * @label 来源
   */
  src: string;
  /**
   * 展示名（可选，供图鉴/调试）
   * @label 名称
   */
  label?: string;
}

/** 三段式索引的解析结果。 */
export interface PicRefParts {
  /** 第一段：mod 名。 */
  mod: string;
  /** 第二段：用途类别（不含 `(pic)` 标记）。 */
  type: string;
  /** 第三段：类别内 id。 */
  id: string;
}

/** `mod:type(pic):id` 三段式匹配（type 段必须以字面 `(pic)` 结尾）。 */
const PIC_REF_RE = /^([^:]+):([^(]+)\(pic\):([^:]+)$/;

/** 解析图片索引；非法（不含 `(pic)` 标记）返回 undefined。 */
export function parsePicId(ref: string): PicRefParts | undefined {
  const m = PIC_REF_RE.exec(ref);
  if (!m) return undefined;
  const [, mod, type, id] = m;
  if (!mod || !type || !id) return undefined;
  return { mod, type, id };
}

/** 是否三段式图片索引（`mod:type(pic):id`）。 */
export function isPicRef(ref: string): boolean {
  return parsePicId(ref) !== undefined;
}

/** 由三段拼出完整图片索引。 */
export function buildPicId(mod: string, type: string, id: string): string {
  return `${mod}:${type}(pic):${id}`;
}

/** 常见直连 URL 前缀（命中即视为可直接使用的图片地址，不做注册表解析）。 */
const DIRECT_URL_RE = /^(https?:|data:|blob:|file:|\/|\.\/|\.\.\/)/i;

/** 是否直连 URL / 相对路径（非三段式索引）。 */
export function isDirectUrl(src: string): boolean {
  return DIRECT_URL_RE.test(src);
}

/** zip 来源前缀：`zip:<包内相对路径>`。 */
export const ZIP_PREFIX = 'zip:';

/** src 是否引用 Mod 压缩包内图片。 */
export function isZipPicSrc(src: string): boolean {
  return src.startsWith(ZIP_PREFIX);
}

/** 从 `zip:...` src 中取出包内相对路径；非 zip 来源返回空串。 */
export function zipPathOf(src: string): string {
  return src.startsWith(ZIP_PREFIX) ? src.slice(ZIP_PREFIX.length) : '';
}
