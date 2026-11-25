import type { InitId } from '../../engine/types/ids';
import type { PicId } from './pic';

/** Slash-separated folder path under an Init. Each segment is a stable name. */
export type HierachyString = string;

export function isStoryHierarchy(value: unknown): value is HierachyString {
  if (typeof value !== 'string' || value.length > 1024) return false;
  const segments = value.split('/');
  return segments[0] !== '@compat' && segments.every(segment => segment && segment === segment.trim()
    && segment !== '.' && segment !== '..' && !/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(segment));
}

/** A Mod's declared directory, or its presentation for a generated character directory. */
export interface StoryDirectoryDef {
  /** Stable directory ID. Character directories use characterStoryDirectoryId(). */
  id: string;
  /** The Init under which this directory appears. */
  initId: InitId;
  /** Bind independent directory information to a path. Uses a mod:story-hierarchy:id identity. */
  hierarchyString?: HierachyString;
  /** Explicit primary presentation at this path, or use the path's default appearance. */
  primary?: 'design' | 'path';
  /** Existing ThemeDesign used on the directory's local overview. */
  themeDesignId?: string;
  /** Set only to customize the directory generated for this character. */
  characterId?: string;
  /** Parent directory ID. Omit for a top-level manual directory. */
  parentId?: string;
  /** Player-facing title. Required for manual directories. */
  title?: string;
  /** Plain-text description displayed in the directory. */
  description?: string;
  /** Existing picture resource used as the directory cover. */
  coverPicId?: PicId;
  /** Show the directory before the player discovers an entry in it. */
  public?: boolean;
  /** Accept explicit placements from other Mods. */
  acceptExternalEntries?: boolean;
  /** Sibling order, lowest first. */
  order?: number;
}

/** Explicit location of an Entry in a particular Init. */
export interface StoryEntryDirectoryPlacement {
  initId: InitId;
  /** Path under this Init. May be used before any directory information has been authored. */
  hierarchyString?: HierachyString;
  /** Legacy directory reference, mutually exclusive with hierarchyString. */
  directoryId?: string;
  order?: number;
}

export function characterStoryDirectoryId(initId: string, characterId: string): string {
  return `@character/${encodeURIComponent(initId)}/${encodeURIComponent(characterId)}`;
}

export function parseCharacterStoryDirectoryId(id: string): { initId: string; characterId: string } | undefined {
  const match = /^@character\/([^/]+)\/([^/]+)$/.exec(id);
  if (!match) return;
  try {
    const initId = decodeURIComponent(match[1]);
    const characterId = decodeURIComponent(match[2]);
    if (characterStoryDirectoryId(initId, characterId) === id) return { initId, characterId };
  } catch {
    return;
  }
}
