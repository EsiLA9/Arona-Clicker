import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { exportBaseDatapackFolder } from './base-datapack-export.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const requestedOutputDir = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : undefined;

const server = await createServer({
  configFile: path.join(projectRoot, 'vite.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const sourceModule = await server.ssrLoadModule('/src/arona-clicker/content/base-datapack-source.ts');
  const outputDir = requestedOutputDir ?? path.join(projectRoot, 'datapack', `base@${sourceModule.baseDatapackSource.version}`);
  assertOutputOutsideSource(outputDir);
  await exportBaseDatapackFolder({
    datapack: sourceModule.baseDatapackSource,
    assets: sourceModule.baseDatapackExportAssets,
    outputDir,
    projectRoot,
  });
  process.stdout.write(`Base 数据包已导出（按字段分片）：${outputDir}\n`);
} finally {
  await server.close();
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
