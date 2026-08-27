// ============================================================
// data/zip-loader.ts — Mod 压缩包 → Datapack 加载器（多文件式）
// 遍历压缩包内所有 .json 文件（任意目录层级，忽略其他文件），
// 每份 JSON 视为 Datapack 的一个"分片"（含若干列表字段 / extras /
// name / version 中的任意子集），合并为单个 Datapack 返回，
// 供 game.init([datapack]) 使用 —— 全游戏仅 1 个 Mod。
// ============================================================

import JSZip from 'jszip';
import type {
  AffectorPackDef,
  AreaDef,
  CharacterBonusTable,
  CharacterData,
  Datapack,
  DropTableDef,
  EnhancementDef,
  ExtraValue,
  FuncletDef,
  InitDef,
  ItemDef,
  ResourceDisplayDef,
  SpotDef,
  StoryDef,
  ActiveStoryEntry,
  PassiveStoryEntry,
  TriggerDef,
  PicDef,
  CharaProfileDef,
} from '../engine/types';

/** Datapack 中承载条目列表的字段（每个分片可提供任意子集）。 */
export const DATAPACK_LIST_FIELDS = [
  'inits',
  'areas',
  'spots',
  'enhancements',
  'activeStories',
  'passiveStories',
  'stories',
  'items',
  'dropTables',
  'affectorPacks',
  'triggerDefs',
  'funcletDefs',
  'characters',
  'characterBonuses',
  'resourceDisplays',
  'pics',
  'charaProfiles',
] as const;
export type DatapackListField = (typeof DATAPACK_LIST_FIELDS)[number];

/** 压缩包内会被提取为图片资产的扩展名（大小写不敏感）。 */
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|apng|avif|bmp|ico)$/i;

/** 图片扩展名 → MIME（data URL 组装用）。 */
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

function mimeOfPath(path: string): string {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  return IMAGE_MIME[ext] ?? 'application/octet-stream';
}

/** 加载失败时抛出的错误（携带出错文件路径）。 */
export class ZipLoadError extends Error {
  readonly path?: string;

  constructor(message: string, path?: string) {
    super(path !== undefined ? `[${path}] ${message}` : message);
    this.name = 'ZipLoadError';
    this.path = path;
  }
}

export interface ZipLoadResult {
  /** 合并后的数据包（供 game.init 使用）。 */
  datapack: Datapack;
  /** 参与合并的 .json 文件数量。 */
  jsonFileCount: number;
  /** 被忽略的非 json / 非图片文件数量。 */
  ignoredCount: number;
  /** 从压缩包提取的图片资产（包内相对路径 → data URL），供 ImageStore 登记后由 PicDef `zip:` src 引用。 */
  images: { path: string; url: string }[];
}

interface DatapackFragment {
  name?: string;
  version?: string;
  extras?: Record<string, ExtraValue>;
  lists: Partial<Record<DatapackListField, unknown[]>>;
}

function isListField(key: string): key is DatapackListField {
  return (DATAPACK_LIST_FIELDS as readonly string[]).includes(key);
}

function parseFragment(path: string, content: string): DatapackFragment {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (e) {
    throw new ZipLoadError(`JSON 解析失败：${e instanceof Error ? e.message : String(e)}`, path);
  }

  if (Array.isArray(raw)) {
    throw new ZipLoadError(
      '顶层是数组，无法推断所属字段。请改写为对象分片，例如 {"spots": [...]}，或完整 Datapack 对象。',
      path,
    );
  }
  if (raw === null || typeof raw !== 'object') {
    throw new ZipLoadError('顶层既非对象也非数组，无法构造成 Datapack。', path);
  }

  const record = raw as Record<string, unknown>;
  const fragment: DatapackFragment = { lists: {} };
  let recognized = false;

  for (const [key, value] of Object.entries(record)) {
    if (key === 'name') {
      if (typeof value === 'string') fragment.name = value;
      recognized = true;
    } else if (key === 'version') {
      if (typeof value === 'string') fragment.version = value;
      recognized = true;
    } else if (key === 'extras') {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        fragment.extras = value as Record<string, ExtraValue>;
      }
      recognized = true;
    } else if (isListField(key)) {
      if (!Array.isArray(value)) {
        throw new ZipLoadError(`字段 "${key}" 应为数组，实际为 ${typeof value}。`, path);
      }
      fragment.lists[key] = value;
      recognized = true;
    }
    // 未知字段（meta / description 等）忽略，便于分片文件携带附加说明
  }

  if (!recognized) {
    throw new ZipLoadError(
      `未包含任何 Datapack 字段。可用列表字段：${DATAPACK_LIST_FIELDS.join(' / ')}；另有 name / version / extras。`,
      path,
    );
  }
  return fragment;
}

function mergeFragments(fragments: DatapackFragment[]): Datapack {
  const lists: Partial<Record<DatapackListField, unknown[]>> = {};
  let extras: Record<string, ExtraValue> | undefined;
  let name: string | undefined;
  let version: string | undefined;

  for (const frag of fragments) {
    if (frag.name !== undefined && name === undefined) name = frag.name;
    if (frag.version !== undefined && version === undefined) version = frag.version;
    if (frag.extras) extras = { ...(extras ?? {}), ...frag.extras };
    for (const field of DATAPACK_LIST_FIELDS) {
      const items = frag.lists[field];
      if (items && items.length > 0) {
        (lists[field] ??= []).push(...items);
      }
    }
  }

  const dp: Datapack = {
    name: name ?? 'unnamed-mod',
    version: version ?? '0.0.0',
    inits: (lists.inits as InitDef[] | undefined) ?? [],
    areas: (lists.areas as AreaDef[] | undefined) ?? [],
    spots: (lists.spots as SpotDef[] | undefined) ?? [],
    enhancements: (lists.enhancements as EnhancementDef[] | undefined) ?? [],
    activeStories: (lists.activeStories as ActiveStoryEntry[] | undefined) ?? [],
    passiveStories: (lists.passiveStories as PassiveStoryEntry[] | undefined) ?? [],
    stories: (lists.stories as StoryDef[] | undefined) ?? [],
    items: (lists.items as ItemDef[] | undefined) ?? [],
    funcletDefs: (lists.funcletDefs as FuncletDef[] | undefined) ?? [],
    characters: (lists.characters as CharacterData[] | undefined) ?? [],
    characterBonuses: (lists.characterBonuses as CharacterBonusTable[] | undefined) ?? [],
  };
  if (lists.dropTables) dp.dropTables = lists.dropTables as DropTableDef[];
  if (lists.affectorPacks) dp.affectorPacks = lists.affectorPacks as AffectorPackDef[];
  if (lists.triggerDefs) dp.triggerDefs = lists.triggerDefs as TriggerDef[];
  if (lists.resourceDisplays) dp.resourceDisplays = lists.resourceDisplays as ResourceDisplayDef[];
  if (lists.pics) dp.pics = lists.pics as PicDef[];
  if (lists.charaProfiles) dp.charaProfiles = lists.charaProfiles as CharaProfileDef[];
  if (extras) dp.extras = extras;
  return dp;
}

/**
 * 解压并加载：遍历压缩包内所有 .json 文件（任意目录层级）解析为分片后合并，
 * 同时提取其中的图片文件（png/jpg/gif/webp/svg 等）为 data URL 供 ImageStore 登记。
 */
export async function loadDatapackFromZip(zip: JSZip): Promise<ZipLoadResult> {
  const jsonPaths: string[] = [];
  const imagePaths: string[] = [];
  let ignoredCount = 0;
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    if (/\.json$/i.test(path)) jsonPaths.push(path);
    else if (IMAGE_EXT_RE.test(path)) imagePaths.push(path);
    else ignoredCount += 1;
  });

  if (jsonPaths.length === 0) {
    throw new ZipLoadError(
      `压缩包内未找到任何 .json 文件${ignoredCount > 0 ? `（另有 ${ignoredCount} 个非 json 文件被忽略）` : ''}。`,
    );
  }

  const contents = await Promise.all(
    jsonPaths.map((path) => zip.file(path)!.async('string')),
  );
  const images = await Promise.all(
    imagePaths.map(async (path) => ({
      path,
      url: `data:${mimeOfPath(path)};base64,${await zip.file(path)!.async('base64')}`,
    })),
  );
  const fragments = jsonPaths.map((path, i) => parseFragment(path, contents[i]));
  return {
    datapack: mergeFragments(fragments),
    jsonFileCount: jsonPaths.length,
    ignoredCount,
    images,
  };
}

/** 从 ArrayBuffer / Uint8Array / Blob 加载压缩包。 */
export async function loadDatapackFromZipBuffer(
  input: ArrayBuffer | Uint8Array | Blob,
): Promise<ZipLoadResult> {
  const zip = await JSZip.loadAsync(input);
  return loadDatapackFromZip(zip);
}

/** 从 <input type="file"> 选择的压缩包文件加载。 */
export async function loadDatapackFromZipFile(file: File | Blob): Promise<ZipLoadResult> {
  return loadDatapackFromZipBuffer(file);
}
