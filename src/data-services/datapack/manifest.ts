export interface PackManifest {
  modName: string;
  name: string;
  version: string;
  author?: string;
  dependencies: string[];
  icon?: string;
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
  };
}
