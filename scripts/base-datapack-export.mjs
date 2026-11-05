import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function exportBaseDatapackFolder({ datapack, assets, outputDir, projectRoot }) {
  if (!datapack || typeof datapack.name !== 'string' || typeof datapack.version !== 'string') {
    throw new Error('TypeScript Base 内容缺少 name 或 version。');
  }
  const root = path.resolve(outputDir);
  const assetByUrl = new Map();
  for (const asset of assets) {
    if (assetByUrl.has(asset.sourceUrl)) throw new Error(`Base 图片来源重复：${asset.sourceUrl}`);
    const packagePath = safePackagePath(root, asset.packagePath);
    assetByUrl.set(asset.sourceUrl, { ...asset, packagePath });
  }

  const content = JSON.parse(JSON.stringify(datapack));
  for (const pic of content.pics ?? []) {
    const asset = assetByUrl.get(pic.src);
    if (asset) pic.src = `zip:${asset.packagePath}`;
    else if (pic.src.startsWith('/src/')) throw new Error(`Base 图片未登记到导出资源清单：${pic.src}`);
  }

  await mkdir(root, { recursive: true });
  const manifest = {
    modName: 'base',
    name: datapack.name,
    version: datapack.version,
    author: 'AronaClicker',
    dependencies: [],
  };
  await writeFile(path.join(root, 'datapack.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const contentDir = path.join(root, 'content');
  await mkdir(contentDir, { recursive: true });
  await writeFile(path.join(contentDir, 'metadata.json'), `${JSON.stringify({ name: content.name, version: content.version }, null, 2)}\n`, 'utf8');
  for (const field of Object.keys(content).filter(key => key !== 'name' && key !== 'version').sort()) {
    const fragmentPath = safePackagePath(root, `content/${field}.json`);
    await writeFile(path.join(root, fragmentPath), `${JSON.stringify({ [field]: content[field] }, null, 2)}\n`, 'utf8');
  }

  for (const asset of assetByUrl.values()) {
    const destination = path.join(root, asset.packagePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.resolve(projectRoot, asset.sourcePath), destination);
  }
  await rm(path.join(root, 'content.json'), { force: true });
}

function safePackagePath(root, input) {
  const normalized = input.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`无效的包内资源路径：${input}`);
  }
  const resolved = path.resolve(root, normalized);
  if (!resolved.startsWith(root + path.sep)) throw new Error(`包内资源路径越界：${input}`);
  return normalized;
}
