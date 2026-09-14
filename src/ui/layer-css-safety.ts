// ============================================================
// ui/layer-css-safety.ts — 背景图层样式值的共享安全集合
// 渲染端（background-service / presentation-service）与图层编辑器
// 必须共用同一套规则，否则会出现「面板显示的值 ≠ 实际渲染的值」。
// ============================================================
import type { BackgroundLayerDef } from '../engine/types/theme';

/** 引擎按主题色自动生成的全局底色层 id；用户图层不得占用。 */
export const SYSTEM_COLOR_LAYER_ID = 'system-color-background';

/** 枚举型图层参数的取值表：编辑器下拉与渲染端白名单共用同一份，避免两边漂移。 */
export const LAYER_REPEAT_VALUES: readonly string[] = ['repeat', 'repeat-x', 'repeat-y', 'no-repeat', 'space', 'round'];
export const LAYER_BLEND_VALUES: readonly string[] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn', 'darken', 'lighten'];
export const LAYER_ATTACHMENT_VALUES: readonly string[] = ['scroll', 'fixed', 'local'];

/** 非 image 图层允许写入 style 的值；image 由 Pic 资源解析，不走这条。 */
export const LAYER_VALUE_PATTERN = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\([^;<>]+\)|var\(--[a-z0-9-]+\))$/i;
export const LAYER_POSITION_PATTERN = /^[a-z0-9% .-]+$/i;
export const LAYER_SIZE_PATTERN = /^[a-z0-9% .-]+$/i;
export const LAYER_REPEAT_PATTERN = new RegExp(`^(?:${LAYER_REPEAT_VALUES.join('|')})$`);
export const LAYER_BLEND_PATTERN = new RegExp(`^(?:${LAYER_BLEND_VALUES.join('|')})$`);
export const LAYER_ATTACHMENT_PATTERN = new RegExp(`^(?:${LAYER_ATTACHMENT_VALUES.join('|')})$`);

/** 图层 id：与 UserThemeService 下发校验用的 `[a-zA-Z0-9_-]{1,64}` 保持一致。 */
export const LAYER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function safeCss(value: string | undefined, pattern: RegExp, fallback: string): string {
  return value && pattern.test(value.trim()) ? value.trim() : fallback;
}

/** 该图层值是否会被渲染端采用；false 表示这一层会被整层丢弃。 */
export function isRenderableLayerValue(layer: Pick<BackgroundLayerDef, 'kind' | 'value'>): boolean {
  return layer.kind === 'image' || LAYER_VALUE_PATTERN.test(layer.value.trim());
}

/** 图层 id 是否可用：格式合法、不是系统层、且未与同目标其它图层重名。 */
export function isUsableLayerId(id: string, taken: Iterable<string> = []): boolean {
  if (!LAYER_ID_PATTERN.test(id) || id === SYSTEM_COLOR_LAYER_ID) return false;
  for (const used of taken) if (used === id) return false;
  return true;
}
