import type { Datapack } from '../contracts/datapack';
import JSZip from 'jszip';
import type { } from '../../engine/types';
import { parsePackManifest, type PackManifest } from './manifest';
import { mergeFragments, parseFragment } from './fragment-parser';
import { PackSource, ZipPackSource } from './source';

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|apng|avif|bmp|ico)$/i;
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.apng': 'image/apng',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
};

export interface ParsedPack {
  manifest: PackManifest;
  datapack: Datapack;
  images: { path: string; url: string }[];
  jsonFileCount: number;
  ignoredCount: number;
}

export class PackParseError extends Error {
  readonly path?: string;
  constructor(message: string, path?: string) {
    super(path ? '[' + path + '] ' + message : message);
    this.name = 'PackParseError';
    this.path = path;
  }
}

function mimeOfPath(path: string): string {
  return IMAGE_MIME[path.slice(path.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';
}

function base64Of(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function readJson(entry: { path: string; read(): Promise<Uint8Array> }): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await entry.read()));
  } catch (error) {
    if (error instanceof SyntaxError) throw new PackParseError('JSON 解析失败：' + error.message, entry.path);
    throw error;
  }
}

export async function parsePack(source: PackSource): Promise<ParsedPack> {
  const entries = await source.list();
  const manifestEntry = entries.find(entry => entry.path === 'datapack.json');
  if (!manifestEntry) throw new PackParseError('缺少根目录 datapack.json。', 'datapack.json');
  const manifest = parsePackManifest(await readJson(manifestEntry), manifestEntry.path);
  const jsonEntries = entries.filter(entry => entry.path !== 'datapack.json' && /\.json$/i.test(entry.path));
  const imageEntries = entries.filter(entry => IMAGE_EXT_RE.test(entry.path));
  const ignoredCount = entries.length - 1 - jsonEntries.length - imageEntries.length;
  if (jsonEntries.length === 0) throw new PackParseError('除 manifest 外未找到任何 .json 分片。');
  const fragments = await Promise.all(jsonEntries.map(async entry => parseFragment(entry.path, new TextDecoder().decode(await entry.read()))));
  const images = await Promise.all(imageEntries.map(async entry => ({
    path: entry.path,
    url: 'data:' + mimeOfPath(entry.path) + ';base64,' + base64Of(await entry.read()),
  })));
  const datapack = mergeFragments(fragments);
  if (datapack.name !== manifest.name || datapack.version !== manifest.version) {
    throw new PackParseError('manifest 与 Datapack 分片的 name/version 不一致。', manifestEntry.path);
  }
  return { manifest, datapack, images, jsonFileCount: jsonEntries.length, ignoredCount };
}

export async function parsePackFromZipBuffer(input: ArrayBuffer | Uint8Array | Blob): Promise<ParsedPack> {
  return parsePack(new ZipPackSource(await JSZip.loadAsync(input)));
}

export async function parsePackFromZipFile(file: File | Blob): Promise<ParsedPack> {
  return parsePackFromZipBuffer(file);
}
