import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputFile = path.join(projectRoot, 'src/arona-clicker/content/base-pack/content.json');
const args = new Set(process.argv.slice(2));
const wantsWrite = args.has('--write');
const wantsCheck = args.has('--check');

if (wantsWrite && wantsCheck) throw new Error('Choose either --write or --check.');
if ([...args].some(arg => !['--write', '--check', '--help', '-h'].includes(arg))) {
  throw new Error('Only --write and --check are supported.');
}
if (args.has('--help') || args.has('-h')) {
  process.stdout.write('Usage: node scripts/sync-base-datapack-bundle.mjs [--write | --check]\nDefault mode is a read-only preview.\n');
} else {
  await sync();
}

async function sync() {
  const server = await createServer({
    configFile: path.join(projectRoot, 'vite.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const module = await server.ssrLoadModule('/src/arona-clicker/content/base-datapack-source.ts');
    const content = module.baseDatapackSource;
    if (!content || typeof content.name !== 'string' || !Array.isArray(content.stories)) {
      throw new Error('TypeScript Base source is missing name or stories.');
    }
    const legacyStories = content.stories.filter(story => Object.hasOwn(story, 'talklets'));
    const invalidStories = content.stories.filter(story => !Array.isArray(story.nodes) || !story.stages || Object.hasOwn(story, 'talklets'));
    if (legacyStories.length || invalidStories.length) {
      throw new Error(`Base Story source must be nodes/stages-only (legacy=${legacyStories.length}, invalid=${invalidStories.length}).`);
    }
    if (content.stories.length !== 43) {
      throw new Error(`Expected the current 43 production Stories, found ${content.stories.length}.`);
    }

    // The runtime bundle is also the published Base pack fragment; preserve its mod identity.
    const generated = `${JSON.stringify({ ...content, modName: 'base' }, null, 2)}\n`;
    const current = await readFile(outputFile, 'utf8').catch(() => '');
    const same = current === generated;
    if (wantsCheck) {
      if (!same) {
        process.stderr.write(`Base Runtime bundle is stale: ${path.relative(projectRoot, outputFile)}\n`);
        process.exitCode = 1;
      } else process.stdout.write(`Base Runtime bundle matches TypeScript source: stories=${content.stories.length}\n`);
      return;
    }
    if (wantsWrite) {
      await writeFile(outputFile, generated, 'utf8');
      process.stdout.write(`Wrote ${path.relative(projectRoot, outputFile)}: stories=${content.stories.length}, bytes=${Buffer.byteLength(generated)}\n`);
      return;
    }
    process.stdout.write(`Preview ${path.relative(projectRoot, outputFile)}: stories=${content.stories.length}, changed=${!same}, bytes=${Buffer.byteLength(generated)} (no file written)\n`);
  } finally {
    await server.close();
  }
}
