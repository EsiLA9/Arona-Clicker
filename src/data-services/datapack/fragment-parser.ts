import type { Datapack } from '../contracts/datapack';
import type { CharacterData } from '../contracts/character-data';
import type { DropTableDef } from '../contracts/drop-table';
import type { ItemDef } from '../contracts/item';
import type { EnhancementDef } from '../contracts/enhancement';
import type { PassivePoolDef } from '../contracts/passive-pool';
import type { StoryDef } from '../contracts/story';
import type { ActiveStoryEntry, PassiveStoryEntry } from '../contracts/story-entry';
import type {
  AffectorPackDef,
  ExtraValue, FuncletDef,
  TriggerDef,
} from '../../engine/types';
import type { CharaProfileDef } from '../contracts/chara-profile';
import type { CharacterBonusTable, ResourceDisplayDef } from '../contracts/common';
import type { AreaDef, InitDef, SpotDef } from '../contracts/world';
import type { PicDef } from '../contracts/pic';

export const DATAPACK_LIST_FIELDS = [
  'inits', 'areas', 'spots', 'enhancements', 'activeStories', 'passiveStories', 'stories',
  'items', 'dropTables', 'affectorPacks', 'triggerDefs', 'funcletDefs', 'characters',
  'characterBonuses', 'resourceDisplays', 'pics', 'charaProfiles',
] as const;
export type DatapackListField = (typeof DATAPACK_LIST_FIELDS)[number];

export class FragmentParseError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super('[' + path + '] ' + message);
    this.name = 'FragmentParseError';
    this.path = path;
  }
}

export interface DatapackFragment {
  name?: string;
  version?: string;
  extras?: Record<string, ExtraValue>;
  lists: Partial<Record<DatapackListField, unknown[]>>;
}

function isListField(key: string): key is DatapackListField {
  return (DATAPACK_LIST_FIELDS as readonly string[]).includes(key);
}

export function parseFragment(path: string, content: string): DatapackFragment {
  let raw: unknown;
  try { raw = JSON.parse(content); }
  catch (error) { throw new FragmentParseError('JSON 解析失败：' + (error instanceof Error ? error.message : String(error)), path); }
  if (Array.isArray(raw)) {
    throw new FragmentParseError('顶层是数组，无法推断所属字段。请改写为对象分片，例如 {"spots": [...]}，或完整 Datapack 对象。', path);
  }
  if (raw === null || typeof raw !== 'object') throw new FragmentParseError('顶层既非对象也非数组，无法构造成 Datapack。', path);
  const fragment: DatapackFragment = { lists: {} };
  let recognized = false;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === 'name') {
      if (typeof value === 'string') fragment.name = value;
      recognized = true;
    } else if (key === 'version') {
      if (typeof value === 'string') fragment.version = value;
      recognized = true;
    } else if (key === 'extras') {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) fragment.extras = value as Record<string, ExtraValue>;
      recognized = true;
    } else if (isListField(key)) {
      if (!Array.isArray(value)) throw new FragmentParseError('字段 "' + key + '" 应为数组，实际为 ' + typeof value + '。', path);
      fragment.lists[key] = value;
      recognized = true;
    }
  }
  if (!recognized) throw new FragmentParseError('未包含任何 Datapack 字段。可用列表字段：' + DATAPACK_LIST_FIELDS.join(' / ') + '；另有 name / version / extras。', path);
  return fragment;
}

export function mergeFragments(fragments: readonly DatapackFragment[]): Datapack {
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
      if (items && items.length > 0) (lists[field] ??= []).push(...items);
    }
  }
  const datapack: Datapack = {
    name: name ?? 'unnamed-mod', version: version ?? '0.0.0',
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
  if (lists.dropTables) datapack.dropTables = lists.dropTables as DropTableDef[];
  if (lists.affectorPacks) datapack.affectorPacks = lists.affectorPacks as AffectorPackDef[];
  if (lists.triggerDefs) datapack.triggerDefs = lists.triggerDefs as TriggerDef[];
  if (lists.resourceDisplays) datapack.resourceDisplays = lists.resourceDisplays as ResourceDisplayDef[];
  if (lists.pics) datapack.pics = lists.pics as PicDef[];
  if (lists.charaProfiles) datapack.charaProfiles = lists.charaProfiles as CharaProfileDef[];
  if (extras) datapack.extras = extras;
  return datapack;
}
