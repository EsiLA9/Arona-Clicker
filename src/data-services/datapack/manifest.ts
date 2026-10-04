export type PackManifestColor =
  | { r: number; g: number; b: number }
  | { h: number; s: number; l: number };

export interface PackManifest {
  modName: string;
  name: string;
  version: string;
  author?: string;
  dependencies: string[];
  icon?: string;
  /** 包管理卡片颜色：RGB 通道 0–255，或 HSL 的 h=0–360、s/l=0–100。 */
  color?: PackManifestColor;
}

export class ManifestError extends Error {
  readonly path: string;

  constructor(message: string, path = 'datapack.json') {
    super('[' + path + '] ' + message);
    this.name = 'ManifestError';
    this.path = path;
  }
}

function requiredString(raw: Record<string, unknown>, key: string, path: string): string {
  if (typeof raw[key] !== 'string' || raw[key].trim() === '') {
    throw new ManifestError('字段 "' + key + '" 必须是非空字符串。', path);
  }
  return raw[key] as string;
}

function parseManifestColor(value: unknown, path: string): PackManifestColor | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ManifestError('字段 "color" 必须是 RGB {r,g,b} 或 HSL {h,s,l} 对象。', path);
  }
  const color = value as Record<string, unknown>;
  const keys = Object.keys(color).sort().join(',');
  if (keys === 'b,g,r'
    && [color.r, color.g, color.b].every(channel => typeof channel === 'number' && Number.isInteger(channel) && channel >= 0 && channel <= 255)) {
    return { r: color.r as number, g: color.g as number, b: color.b as number };
  }
  if (keys === 'h,l,s'
    && typeof color.h === 'number' && Number.isFinite(color.h) && color.h >= 0 && color.h <= 360
    && typeof color.s === 'number' && Number.isFinite(color.s) && color.s >= 0 && color.s <= 100
    && typeof color.l === 'number' && Number.isFinite(color.l) && color.l >= 0 && color.l <= 100) {
    return { h: color.h, s: color.s, l: color.l };
  }
  throw new ManifestError('字段 "color" 必须完整提供 RGB {r,g,b}（0–255）或 HSL {h,s,l}（h 0–360、s/l 0–100）。', path);
}

export function parsePackManifest(input: unknown, path = 'datapack.json'): PackManifest {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ManifestError('顶层必须是对象。', path);
  }
  const raw = input as Record<string, unknown>;
  const modName = requiredString(raw, 'modName', path);
  if (!/^[a-z0-9-]+$/.test(modName)) {
    throw new ManifestError('字段 "modName" 只能包含小写字母、数字和连字符。', path);
  }
  const name = requiredString(raw, 'name', path);
  const version = requiredString(raw, 'version', path);
  const color = parseManifestColor(raw.color, path);
  if (raw.author !== undefined && typeof raw.author !== 'string') {
    throw new ManifestError('字段 "author" 必须是字符串。', path);
  }
  if (raw.icon !== undefined && typeof raw.icon !== 'string') {
    throw new ManifestError('字段 "icon" 必须是字符串。', path);
  }
  if (raw.dependencies !== undefined && (!Array.isArray(raw.dependencies) || raw.dependencies.some(dep => typeof dep !== 'string'))) {
    throw new ManifestError('字段 "dependencies" 必须是字符串数组。', path);
  }
  const dependencies = (raw.dependencies as string[] | undefined) ?? [];
  if (dependencies.some(dep => !/^[a-z0-9-]+$/.test(dep))) {
    throw new ManifestError('字段 "dependencies" 中的 modName 格式无效。', path);
  }
  return {
    modName,
    name,
    version,
    ...(raw.author !== undefined ? { author: raw.author as string } : {}),
    dependencies: [...dependencies],
    ...(raw.icon !== undefined ? { icon: raw.icon as string } : {}),
    ...(color ? { color } : {}),
  };
}
