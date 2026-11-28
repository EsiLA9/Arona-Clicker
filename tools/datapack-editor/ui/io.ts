/**
 * io.ts —— 数据导入/导出（浏览器环境）
 *
 * M5 完整实现分片写回；M4 先提供：默认数据加载、整体下载、复制、粘贴导入。
 */
import { jsonArchiveEntry, writeZipArchive } from '../../../src/data-services/archive/archive-writer';
import { openZipPackSource, FolderPackSource, SingleFilePackSource } from '../../../src/data-services/datapack/source';
import { readProject, type ProjectRead } from '../../../src/data-services/datapack/project-source';
import { parsePackManifest, type PackManifest } from '../../../src/data-services/datapack/manifest';
import type { EditorPackageMetadata } from '../model/editor-model';
import type { DatapackData } from '../validate/index';

export interface DatapackFileImport {
  datapack: DatapackData;
  manifest?: PackManifest;
  project: Extract<ProjectRead, { status: 'complete' }>;
  sourceName: string;
}

export async function readFormImport(files: readonly File[], directory = false): Promise<DatapackFileImport> {
  const project = await readEditorProject(files, directory);
  if (project.status === 'incomplete') {
    throw new Error(project.diagnostics.map(item => `${item.path}：${item.message}`).join('\n'));
  }
  const file = files[0];
  const standalone = !directory && project.files.length === 1 ? project.files[0].raw : undefined;
  return {
    datapack: { ...standalone, ...project.datapack },
    manifest: project.manifest,
    project,
    sourceName: directory ? file.webkitRelativePath.split('/')[0] : file.name,
  };
}

export async function readEditorProject(files: readonly File[], directory = false): Promise<ProjectRead> {
  if (!files.length) throw new Error('未选中文件。');
  const read = (file: File) => async () => new Uint8Array(await file.arrayBuffer());
  if (directory) {
    const entries = files.map(file => ({
      path: file.webkitRelativePath.slice(file.webkitRelativePath.indexOf('/') + 1),
      read: read(file),
    })).sort((left, right) => left.path.localeCompare(right.path, 'en'));
    return readProject(new FolderPackSource(entries));
  }
  const [file] = files;
  return readProject(/\.zip$/i.test(file.name) || /zip/i.test(file.type)
    ? await openZipPackSource(await file.arrayBuffer())
    : new SingleFilePackSource({ path: file.name, read: read(file) }));
}

export function downloadProjectZip(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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

export function fileInputImport(directory = false): Promise<DatapackFileImport | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    if (directory) input.setAttribute('webkitdirectory', '');
    else input.accept = '.json,.zip,application/json,application/zip,application/x-zip-compressed';
    const finish = (result: DatapackFileImport | null) => { input.remove(); resolve(result); };
    input.oncancel = () => finish(null);
    input.onchange = async () => {
      const files = [...input.files ?? []];
      if (!files.length) return finish(null);
      try {
        finish(await readFormImport(files, directory));
      } catch (e) {
        alert(`导入失败：${(e as Error).message}`);
        finish(null);
      }
    };
    document.body.append(input);
    input.click();
  });
}

export async function pasteImport(): Promise<DatapackFileImport | null> {
  try {
    const text = await navigator.clipboard.readText();
    return await readFormImport([new File([text], '剪贴板.json', { type: 'application/json' })]);
  } catch (e) {
    alert(`剪贴板导入失败：${(e as Error).message}`);
    return null;
  }
}
