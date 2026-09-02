import type { PicDef } from '../contracts/pic';
import { isPicRef, isZipPicSrc, parsePicId, zipPathOf } from '../contracts/pic';
import type { ImageStore } from './image-store';

export type PicDefinitionMap = ReadonlyMap<string, PicDef>;

export function resolvePicSrc(
  pics: PicDefinitionMap,
  store: ImageStore | undefined,
  ref: string | undefined,
): string | undefined {
  if (!ref || !isPicRef(ref)) return undefined;
  const parsed = parsePicId(ref)!;
  const def = pics.get(ref);
  if (!def) return undefined;
  return resolveDefSrc(store, parsed.mod, def.src);
}

export function resolveDefSrc(
  store: ImageStore | undefined,
  mod: string,
  src: string,
): string | undefined {
  return isZipPicSrc(src) ? store?.get(mod, zipPathOf(src)) : src;
}
