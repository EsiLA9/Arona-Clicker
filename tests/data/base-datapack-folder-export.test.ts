import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { baseDatapackExportAssets, baseDatapackSource } from '../../src/arona-clicker/content/base-datapack-source';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { parsePack } from '../../src/data-services/datapack/pack-parser';
import { FolderPackSource } from '../../src/data-services/datapack/source';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const exportScript = path.join(projectRoot, 'scripts/export-base-datapack.mjs');

describe('Base TypeScript → 数据包文件夹导出', () => {
  test('输出可解析的完整文件夹包，数据与 TS 组合逐字段相等，重复导出稳定', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ac-base-pack-export-'));
    const outputDir = path.join(tempRoot, 'base');
    try {
      runExport(outputDir);
      const firstSnapshot = await snapshotFolder(outputDir);
      const files = await readFolderEntries(outputDir);
      const parsed = await parsePack(new FolderPackSource(files));

      expect(parsed.manifest).toMatchObject({
        modName: 'base',
        name: baseDatapackSource.name,
        version: baseDatapackSource.version,
        dependencies: [],
      });
      expect(parsed.datapack).toEqual(expectedPackageProjection());
      expect(runtimeProjection()).toEqual(defaultDatapack);
      expect(parsed.images.map(image => image.path).sort()).toEqual(
        baseDatapackExportAssets.map(asset => asset.packagePath).sort(),
      );
      expect(parsed.jsonFileCount).toBe(1);
      expect(parsed.ignoredCount).toBe(0);

      for (const asset of baseDatapackExportAssets) {
        const sourceBytes = await readFile(path.join(projectRoot, asset.sourcePath));
        const packageBytes = await readFile(path.join(outputDir, asset.packagePath));
        expect(packageBytes).toEqual(sourceBytes);
      }

      runExport(outputDir);
      expect(await snapshotFolder(outputDir)).toEqual(firstSnapshot);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 20_000);
});

function runExport(outputDir: string): void {
  const result = spawnSync(process.execPath, [exportScript, outputDir], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Base 包导出失败：${result.stderr || result.stdout || result.error?.message || result.status}`);
  }
}

function expectedPackageProjection(): Datapack {
  const expected = JSON.parse(JSON.stringify(baseDatapackSource)) as Datapack;
  expected.modName = 'base';
  const packagePathByUrl = new Map(baseDatapackExportAssets.map(asset => [asset.sourceUrl, asset.packagePath] as const));
  for (const pic of expected.pics ?? []) {
    const packagePath = packagePathByUrl.get(pic.src);
    if (packagePath) pic.src = `zip:${packagePath}`;
  }
  return expected;
}

function runtimeProjection(): Datapack {
  const runtime = expectedPackageProjection();
  const sourceUrlByPackagePath = new Map<string, string>(baseDatapackExportAssets.map(asset => [asset.packagePath, asset.sourceUrl]));
  for (const pic of runtime.pics ?? []) {
    if (!pic.src.startsWith('zip:')) continue;
    const sourceUrl = sourceUrlByPackagePath.get(pic.src.slice('zip:'.length));
    if (sourceUrl) pic.src = sourceUrl;
  }
  return runtime;
}

async function readFolderEntries(root: string): Promise<Array<{ path: string; read(): Promise<Uint8Array> }>> {
  const files: Array<{ path: string; absolutePath: string }> = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath);
      else files.push({ path: path.relative(root, absolutePath).replace(/\\/g, '/'), absolutePath });
    }
  };
  await visit(root);
  return files.map(file => ({ path: file.path, read: async () => new Uint8Array(await readFile(file.absolutePath)) }));
}

async function snapshotFolder(root: string): Promise<Record<string, string>> {
  const entries = await readFolderEntries(root);
  const snapshot: Record<string, string> = {};
  for (const entry of entries.sort((left, right) => left.path.localeCompare(right.path))) {
    const bytes = await entry.read();
    snapshot[entry.path] = Buffer.from(bytes).toString('base64');
  }
  return snapshot;
}
