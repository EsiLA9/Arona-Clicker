export type GradientFunction = 'linear' | 'radial' | 'repeating-linear' | 'repeating-radial';

export interface GradientStop {
  color: string;
  position?: string;
}

export interface ParsedGradient {
  type: GradientFunction;
  direction?: string;
  shape?: string;
  size?: string;
  centerX?: string;
  centerY?: string;
  stops: GradientStop[];
}

const GRADIENT_RE = /^(linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\((.*)\)$/i;
const COLOR_RE = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^)]*\)|var\(--[a-z0-9-]+\)|transparent)$/i;

/** 长度/百分比字面量：覆盖 +5% / -10px / .5rem 这些 CSS 合法写法。 */
const LENGTH_LITERAL = '[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:%|px|em|rem)';
/** 无单位零是 CSS 里唯一合法的无单位长度。 */
const ZERO_LITERAL = '[-+]?0(?:\\.0+)?';
/** 编辑器接受的严格长度：非零数字必须带单位，否则整条渐变的该色标会被浏览器判为非法。 */
const LENGTH_LITERAL_OR_ZERO = `(?:${LENGTH_LITERAL}|${ZERO_LITERAL})`;
/** 解析器侧保持宽松：历史数据可能存有无单位数字，读取时不能让整条渐变失效。 */
const LENGTH_LITERAL_LOOSE = '[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:%|px|em|rem)?';

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    else if (value[index] === ')') depth = Math.max(0, depth - 1);
    else if (value[index] === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

const STOP_PARTS_RE = new RegExp(`^(.*?)(?:\\s+(${LENGTH_LITERAL_LOOSE}))?$`);

function parseStop(value: string): GradientStop | undefined {
  const match = STOP_PARTS_RE.exec(value.trim());
  if (!match || !COLOR_RE.test(match[1].trim())) return undefined;
  return { color: match[1].trim(), ...(match[2] ? { position: match[2] } : {}) };
}

export function parseGradient(value: string): ParsedGradient | undefined {
  const match = GRADIENT_RE.exec(value.trim());
  if (!match) return undefined;
  const functionName = match[1].toLowerCase() as `${'linear' | 'radial' | 'repeating-linear' | 'repeating-radial'}-gradient`;
  const type = functionName.replace('-gradient', '') as GradientFunction;
  const parts = splitTopLevel(match[2]);
  if (parts.length < 2) return undefined;
  const first = parts[0];
  const hasDirection = !parseStop(first);
  const stops = (hasDirection ? parts.slice(1) : parts).map(parseStop);
  if (stops.some(stop => !stop)) return undefined;
  if (type === 'linear' || type === 'repeating-linear') return { type, ...(hasDirection ? { direction: first } : {}), stops: stops as GradientStop[] };
  const atIndex = first.toLowerCase().indexOf(' at ');
  const descriptor = atIndex >= 0 ? first.slice(0, atIndex).trim() : first.trim();
  const center = atIndex >= 0 ? first.slice(atIndex + 4).trim().split(/\s+/) : [];
  const shapeMatch = /^(circle|ellipse)(?:\s+|$)/i.exec(descriptor);
  const shape = shapeMatch?.[1];
  const size = descriptor.replace(/^(circle|ellipse)\s*/i, '').trim();
  if (atIndex < 0 && !shape && COLOR_RE.test(descriptor)) return { type, stops: stops as GradientStop[] };
  if (atIndex < 0 && !shape && !size) return undefined;
  return {
    type,
    shape,
    size: size || undefined,
    centerX: center[0],
    centerY: center[1],
    stops: stops as GradientStop[],
  };
}

const STOP_POSITION_RE = new RegExp(`^${LENGTH_LITERAL_OR_ZERO}$`, 'i');
const ANGLE_RE = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:deg|rad|turn|grad)?$/i;
const DIRECTION_KEYWORD_RE = /^to\s+(?:top|bottom|left|right)(?:\s+(?:top|bottom|left|right))?$/i;
const SHAPE_RE = /^(?:circle|ellipse)$/i;
const RADIAL_SIZE_RE = new RegExp(`^(?:closest-side|farthest-side|closest-corner|farthest-corner)$|^${LENGTH_LITERAL_OR_ZERO}(?:\\s+${LENGTH_LITERAL_OR_ZERO})?$`, 'i');
const CENTER_TOKEN_RE = new RegExp(`^(?:left|right|top|bottom|center)$|^${LENGTH_LITERAL_OR_ZERO}$`, 'i');

/** 合法色标颜色：空值与未识别写法都不接受（它们是让整条声明失效的来源）。 */
export function isGradientColorToken(value: string): boolean {
  return COLOR_RE.test(value.trim());
}

/** 合法色标位置；空串表示自动分布，由调用方单独判定。 */
export function isGradientStopPosition(value: string): boolean {
  return STOP_POSITION_RE.test(value.trim());
}

/** 合法方向：角度（`90deg`）或 `to <边>` 关键词。 */
export function isGradientDirection(value: string): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed) && (ANGLE_RE.test(trimmed) || DIRECTION_KEYWORD_RE.test(trimmed));
}

/** 合法径向中心分量：百分比 / 长度 / 方位关键词。 */
export function isGradientCenterToken(value: string): boolean {
  return CENTER_TOKEN_RE.test(value.trim());
}

export function serializeGradient(value: ParsedGradient): string {
  const name = `${value.type}-gradient`;
  const prefix = value.type === 'linear' || value.type === 'repeating-linear'
    ? value.direction
    : [value.shape, value.size, value.centerX && value.centerY ? `at ${value.centerX} ${value.centerY}` : undefined].filter(Boolean).join(' ') || undefined;
  // 空色标会拼出 `, ,` 让整条 CSS 声明失效，这里直接丢弃该条目，绝不产出空色标。
  const stops = value.stops
    .filter(stop => stop.color.trim())
    .map(stop => [stop.color.trim(), stop.position?.trim()].filter(Boolean).join(' '))
    .join(', ');
  return `${name}(${prefix ? `${prefix}, ` : ''}${stops})`;
}

/**
 * 按单字段更新渐变 CSS。拒绝会把 CSS 写坏的输入（空/未识别色标颜色、非法位置或方向等），
 * 并在写回前做一次「序列化 → 再解析」往返校验，保证返回值始终是合法渐变。
 */
export function updateGradient(value: string, update: Partial<ParsedGradient> & { startColor?: string; endColor?: string; stopIndex?: number; stopColor?: string; stopPosition?: string }): string {
  const parsed = parseGradient(value);
  if (!parsed) return value;
  const stops = parsed.stops.map(stop => ({ ...stop }));
  const acceptedColor = (candidate?: string): string | undefined => {
    const trimmed = candidate?.trim();
    return trimmed && COLOR_RE.test(trimmed) ? trimmed : undefined;
  };
  const startColor = acceptedColor(update.startColor);
  const endColor = acceptedColor(update.endColor);
  if (startColor && stops[0]) stops[0].color = startColor;
  if (endColor && stops[stops.length - 1]) stops[stops.length - 1].color = endColor;
  if (typeof update.stopIndex === 'number' && stops[update.stopIndex]) {
    const stopColor = acceptedColor(update.stopColor);
    if (stopColor) stops[update.stopIndex].color = stopColor;
    if (update.stopPosition !== undefined) {
      // 空 = 显式回到自动分布；非法值忽略，保留原位置。
      const position = update.stopPosition.trim();
      if (!position) stops[update.stopIndex].position = undefined;
      else if (STOP_POSITION_RE.test(position)) stops[update.stopIndex].position = position;
    }
  }
  const next: ParsedGradient = { ...parsed, stops };
  if (update.direction !== undefined) {
    const direction = update.direction.trim();
    next.direction = !direction ? undefined
      : ANGLE_RE.test(direction) || DIRECTION_KEYWORD_RE.test(direction) ? direction : parsed.direction;
  }
  if (update.shape !== undefined && SHAPE_RE.test(update.shape.trim())) next.shape = update.shape.trim().toLowerCase();
  if (update.size !== undefined) {
    const size = update.size.trim();
    if (!size) next.size = undefined;
    else if (RADIAL_SIZE_RE.test(size)) next.size = size;
  }
  for (const axis of ['centerX', 'centerY'] as const) {
    const candidate = update[axis];
    if (candidate === undefined) continue;
    const trimmed = candidate.trim();
    if (!trimmed) next[axis] = undefined;
    else if (CENTER_TOKEN_RE.test(trimmed)) next[axis] = trimmed;
  }
  const serialized = serializeGradient(next);
  return parseGradient(serialized) ? serialized : value;
}

/** 追加一个色标：复制末尾颜色，位置留空由浏览器均分。 */
export function addGradientStop(value: string): string {
  const parsed = parseGradient(value);
  if (!parsed) return value;
  const stops = parsed.stops.map(stop => ({ ...stop }));
  const last = stops[stops.length - 1];
  stops.push({ color: last ? last.color : '#6b8cff' });
  return serializeGradient({ ...parsed, stops });
}

/** 删除指定色标；不足三个色标时保持不变。 */
export function removeGradientStop(value: string, index: number): string {
  const parsed = parseGradient(value);
  if (!parsed || parsed.stops.length <= 2 || !Number.isInteger(index) || index < 0 || index >= parsed.stops.length) return value;
  const stops = parsed.stops.filter((_, stopIndex) => stopIndex !== index).map(stop => ({ ...stop }));
  return serializeGradient({ ...parsed, stops });
}

/** 线性 / 径向互转，保留色标并补齐目标类型的方向或中心参数。 */
export function convertGradientType(value: string, type: GradientFunction): string {
  const parsed = parseGradient(value);
  if (!parsed || parsed.type === type) return value;
  const radial = type === 'radial' || type === 'repeating-radial';
  const stops = parsed.stops.map(stop => ({ ...stop }));
  return serializeGradient(radial
    ? { type, stops, shape: parsed.shape ?? 'circle', size: parsed.size, centerX: parsed.centerX ?? '50%', centerY: parsed.centerY ?? '50%' }
    : { type, stops, direction: parsed.direction ?? '135deg' });
}
