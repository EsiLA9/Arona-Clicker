import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  configFile: path.join(projectRoot, 'vite.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const sourceModule = await server.ssrLoadModule('/src/arona-clicker/content/base-datapack-source.ts');
  const datapack = sourceModule.baseDatapackSource;
  const assets = sourceModule.baseDatapackExportAssets;
  const outputDir = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(projectRoot, 'datapack', `base@${datapack.version}`);

  assertOutputOutsideSource(outputDir);
  await exportFolder({ datapack, assets, outputDir });
  process.stdout.write(`Base 数据包已导出：${outputDir}\n`);
} finally {
  await server.close();
}

async function exportFolder({ datapack, assets, outputDir }) {
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
  await writeFile(path.join(root, 'content.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8');

  for (const asset of assetByUrl.values()) {
    const destination = path.join(root, asset.packagePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.resolve(projectRoot, asset.sourcePath), destination);
  }
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

function assertOutputOutsideSource(outputDir) {
  const resolved = path.resolve(outputDir);
  for (const protectedPath of [projectRoot, path.join(projectRoot, 'src'), path.join(projectRoot, 'tests'), path.join(projectRoot, 'scripts')]) {
    const relative = path.relative(protectedPath, resolved);
    const isInside = !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
    if ((protectedPath === projectRoot && !relative) || (protectedPath !== projectRoot && isInside)) {
      throw new Error(`导出目录不能位于源码或项目根目录中：${resolved}`);
    }
  }
}
