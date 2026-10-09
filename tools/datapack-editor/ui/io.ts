/**
 * io.ts —— 数据导入/导出（浏览器环境）
 *
 * M5 完整实现分片写回；M4 先提供：默认数据加载、整体下载、复制、粘贴导入。
 */
import { jsonArchiveEntry, writeZipArchive } from '../../../src/data-services/archive/archive-writer';
import { parsePackFromZipFile } from '../../../src/data-services/datapack/pack-parser';
import { parsePackManifest, type PackManifest } from '../../../src/data-services/datapack/manifest';
import type { EditorPackageMetadata } from '../model/editor-model';
import type { DatapackData } from '../validate';

export interface DatapackFileImport {
  datapack: DatapackData;
  manifest?: PackManifest;
}

/** 用 Vite import.meta.glob 批量加载真实 datapack 分片并合并 */
export function loadDefaultDatapack(): DatapackData {
  // 注意：import.meta.glob 只接受字面量，不能抽成变量
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mods = import.meta.glob('../../../datapack/AronaClickerCore/*.json', { eager: true }) as Record<string, { default: unknown }>;
  const merged: DatapackData = {};
  for (const file of Object.keys(mods).sort()) {
    const partial = mods[file].default as DatapackData;
    for (const [key, value] of Object.entries(partial)) {
      if (!(key in merged)) merged[key] = value;
      else if (Array.isArray(merged[key]) && Array.isArray(value)) {
        (merged[key] as unknown[]).push(...(value as unknown[]));
      }
    }
  }
  return merged;
}

export function downloadDatapack(data: DatapackData, filename = 'datapack.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 构造 PackParser 可直接读取的根 manifest + 单一内容 fragment ZIP。 */
export async function createDatapackPackage(
  data: DatapackData,
  metadata: EditorPackageMetadata,
): Promise<Uint8Array> {
  const manifest = parsePackManifest(metadata);
  const fragment = {
    ...data,
    name: manifest.name,
    version: manifest.version,
    modName: manifest.modName,
  };
  return writeZipArchive({ entries: [
    jsonArchiveEntry('datapack.json', manifest),
    jsonArchiveEntry('content.json', fragment),
  ] });
}

export async function downloadDatapackPackage(
  data: DatapackData,
  metadata: EditorPackageMetadata,
): Promise<void> {
  const bytes = await createDatapackPackage(data, metadata);
  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);
  const blob = new Blob([blobBytes.buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${metadata.modName}@${metadata.version}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyDatapack(data: DatapackData): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
}

export function fileInputImport(): Promise<DatapackFileImport | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,application/json,application/zip,application/x-zip-compressed';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        if (/\.zip$/i.test(file.name) || /zip/i.test(file.type)) {
          const parsed = await parsePackFromZipFile(file);
          resolve({ datapack: parsed.datapack as unknown as DatapackData, manifest: parsed.manifest });
          return;
        }
        const text = await file.text();
        resolve({ datapack: JSON.parse(text) as DatapackData });
      } catch (e) {
        alert(`导入失败：${(e as Error).message}`);
        resolve(null);
      }
    };
    input.click();
  });
}

export async function pasteImport(): Promise<DatapackData | null> {
  try {
    const text = await navigator.clipboard.readText();
    return JSON.parse(text) as DatapackData;
  } catch (e) {
    alert(`剪贴板导入失败：${(e as Error).message}`);
    return null;
  }
}
