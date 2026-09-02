export type PicId = string;
export type PicKind = string;

export interface PicDef {
  id: PicId;
  src: string;
  label?: string;
}

export interface PicRefParts { mod: string; type: string; id: string; }

const PIC_REF_RE = /^([^:]+):([^(]+)\(pic\):([^:]+)$/;

export function parsePicId(ref: string): PicRefParts | undefined {
  const m = PIC_REF_RE.exec(ref);
  if (!m) return undefined;
  const [, mod, type, id] = m;
  if (!mod || !type || !id) return undefined;
  return { mod, type, id };
}

export function isPicRef(ref: string): boolean { return parsePicId(ref) !== undefined; }
export function buildPicId(mod: string, type: string, id: string): string { return `${mod}:${type}(pic):${id}`; }

const DIRECT_URL_RE = /^(https?:|data:|blob:|file:|\/|\.\/|\.\.\/)/i;
export function isDirectUrl(src: string): boolean { return DIRECT_URL_RE.test(src); }
export const ZIP_PREFIX = 'zip:';
export function isZipPicSrc(src: string): boolean { return src.startsWith(ZIP_PREFIX); }
export function zipPathOf(src: string): string { return src.startsWith(ZIP_PREFIX) ? src.slice(ZIP_PREFIX.length) : ''; }
