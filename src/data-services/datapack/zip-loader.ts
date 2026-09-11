import type { Datapack } from '../contracts/datapack';
import type { CharacterData } from '../contracts/character-data';
import type { DropTableDef } from '../contracts/drop-table';
import type { ItemDef } from '../contracts/item';
import type { EnhancementDef } from '../contracts/enhancement';
import type { PassivePoolDef } from '../contracts/passive-pool';
import type { StoryDef } from '../contracts/story';
import type { ActiveStoryEntry, PassiveStoryEntry } from '../contracts/story-entry';
import JSZip from 'jszip';
import { ZipPackSource } from './source';
import { FragmentParseError, mergeFragments as mergeParsedFragments, parseFragment as parseDatapackFragment } from './fragment-parser';
import type {
  AffectorPackDef,
  ExtraValue, FuncletDef,
  TriggerDef,
} from '../../engine/types';
import type { CharaProfileDef } from '../contracts/chara-profile';
import type { ResourceDisplayDef } from '../contracts/common';
import type { AreaDef, InitDef, SpotDef } from '../contracts/world';
import type { PicDef } from '../contracts/pic';

export const DATAPACK_LIST_FIELDS = [
  'inits', 'areas', 'spots', 'enhancements', 'activeStories', 'passiveStories', 'stories',
  'items', 'dropTables', 'affectorPacks', 'triggerDefs', 'funcletDefs', 'characters',
  'resourceDisplays', 'pics', 'charaProfiles',
] as const;
export type DatapackListField = (typeof DATAPACK_LIST_FIELDS)[number];

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|apng|avif|bmp|ico)$/i;
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.apng': 'image/apng',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
};

function mimeOfPath(path: string): string {
  return IMAGE_MIME[path.slice(path.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';
}

export class ZipLoadError extends Error {
  readonly path?: string;
  constructor(message: string, path?: string) {
    super(path !== undefined ? '[' + path + '] ' + message : message);
    this.name = 'ZipLoadError';
    this.path = path;
  }
}

export interface ZipLoadResult {
  datapack: Datapack;
  jsonFileCount: number;
  ignoredCount: number;
  images: { path: string; url: string }[];
}

export async function loadDatapackFromZip(zip: JSZip): Promise<ZipLoadResult> {
  const source = new ZipPackSource(zip);
  const entries = await source.list();
  const jsonEntries = entries.filter(entry => /\.json$/i.test(entry.path));
  const imagePaths: string[] = [];
  let ignoredCount = 0;
  for (const entry of entries) {
    if (/\.json$/i.test(entry.path)) continue;
    if (IMAGE_EXT_RE.test(entry.path)) imagePaths.push(entry.path);
    else ignoredCount += 1;
  }
  if (jsonEntries.length === 0) {
    throw new ZipLoadError('压缩包内未找到任何 .json 文件' + (ignoredCount > 0 ? '（另有 ' + ignoredCount + ' 个非 json 文件被忽略）' : '') + '。');
  }
  const contents = await Promise.all(jsonEntries.map(async entry => new TextDecoder().decode(await entry.read())));
  const images = await Promise.all(imagePaths.map(async path => ({
    path,
    url: 'data:' + mimeOfPath(path) + ';base64,' + await zip.file(path)!.async('base64'),
  })));
  const fragments = jsonEntries.map((entry, i) => {
    try {
      return parseDatapackFragment(entry.path, contents[i]);
    } catch (error) {
      if (error instanceof FragmentParseError) throw new ZipLoadError(error.message);
      throw error;
    }
  });
  return { datapack: mergeParsedFragments(fragments), jsonFileCount: jsonEntries.length, ignoredCount, images };
}

export async function loadDatapackFromZipBuffer(input: ArrayBuffer | Uint8Array | Blob): Promise<ZipLoadResult> {
  return loadDatapackFromZip(await JSZip.loadAsync(input));
}

export async function loadDatapackFromZipFile(file: File | Blob): Promise<ZipLoadResult> {
  return loadDatapackFromZipBuffer(file);
}
