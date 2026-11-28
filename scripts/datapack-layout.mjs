import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
process.stdout.on('error', error => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

try {
  const { positionals: [command, input, ...extra], values } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean' }, by: { type: 'string' }, out: { type: 'string' },
      file: { type: 'string', multiple: true }, target: { type: 'string' },
      occurrence: { type: 'string', multiple: true }, rules: { type: 'string' },
      overrides: { type: 'string' }, compatible: { type: 'boolean' },
    },
  });
  if (values.help || !command) {
    process.stdout.write([
      'npm run datapack:layout -- inspect <目录|ZIP|JSON>',
      'npm run datapack:layout -- split <输入> --by table|entity [--out <新目录或ZIP>]',
      'npm run datapack:layout -- merge <输入> [--file <路径>] [--occurrence <inspect 中的声明标识>] [--target <包内路径>] [--compatible] [--out <新目录或ZIP>]',
      'npm run datapack:layout -- group <输入> --by type|init|character|series|custom [--rules <规则JSON>] [--overrides <路径映射JSON>] [--out <新目录或ZIP>]',
      '规则 JSON 为数组，每项使用 path 目标路径，按 table、source 或 key 匹配。--out 省略时只预览。',
    ].join('\n') + '\n');
  } else {
    if (!input || extra.length) throw new Error('请提供一个输入路径。');
    const request = await layoutRequest(command, values);
    const server = await createServer({ configFile: path.join(root, 'vite.config.ts'), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    try {
      const { readProject } = await server.ssrLoadModule('/src/data-services/datapack/project-source.ts');
      const sourceModule = await server.ssrLoadModule('/src/data-services/datapack/source.ts');
      const sourcePath = path.resolve(input);
      const source = await openSource(sourcePath, sourceModule);
      const project = await readProject(source);
      if (!request) {
        report({
          project: project.project, status: project.status, manifest: project.manifest, diagnostics: project.diagnostics,
          files: project.files.map(({ path, role }) => ({ path, role })),
          definitions: project.definitions.map(({ occurrenceId, table, ordinal, source }) => ({ occurrenceId, table, ordinal, source })),
        });
        if (project.status === 'incomplete') process.exitCode = 2;
      } else {
        const { planProjectLayout } = await server.ssrLoadModule('/src/data-services/datapack/project-layout.ts');
        const plan = planProjectLayout(project, request);
        if (!plan.archive) process.exitCode = 2;
        let output;
        if (plan.archive && values.out) {
          const requested = path.resolve(values.out);
          output = path.join(await realpath(path.dirname(requested)), path.basename(requested));
          const relative = path.relative(await realpath(sourcePath), output);
          if (relative === '' || (source.kind === 'folder' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) && relative !== '..')) {
            throw new Error('输出必须在输入目录之外。');
          }
          if (/\.zip$/i.test(output)) {
            const { writeZipArchive } = await server.ssrLoadModule('/src/data-services/archive/archive-writer.ts');
            await writeFile(output, await writeZipArchive(plan.archive), { flag: 'wx' });
          } else {
            await mkdir(output);
            for (const entry of plan.archive.entries) {
              const destination = path.join(output, entry.path);
              await mkdir(path.dirname(destination), { recursive: true });
              await writeFile(destination, entry.content, { flag: 'wx' });
            }
          }
        }
        const { archive, ...preview } = plan;
        report({ ...preview, paths: archive?.entries.map(entry => entry.path), output });
      }
    } finally { await server.close(); }
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function report(value) { process.stdout.write(JSON.stringify(value, null, 2) + '\n'); }

async function layoutRequest(command, values) {
  if (command === 'inspect') return undefined;
  const overrides = values.overrides ? JSON.parse(await readFile(values.overrides, 'utf8')) : undefined;
  if (command === 'split' && ['table', 'entity'].includes(values.by)) return { kind: 'split', by: values.by, overrides };
  if (command === 'merge') return {
    kind: 'merge', files: values.file, occurrences: values.occurrence, target: values.target, compatible: values.compatible,
  };
  if (command === 'group' && ['type', 'init', 'character', 'series', 'custom'].includes(values.by)) {
    const rules = values.rules ? JSON.parse(await readFile(values.rules, 'utf8')) : undefined;
    return { kind: 'group', by: values.by, rules, overrides };
  }
  throw new Error('无效的操作或 --by，请查看 --help。');
}

async function openSource(input, { FolderPackSource, SingleFilePackSource, openZipPackSource }) {
  const makeEntry = (path, absolute) => ({ path, read: () => readFile(absolute) });
  const info = await lstat(input);
  if (info.isSymbolicLink()) throw new Error('请输入真实目录或文件。');
  if (!info.isDirectory()) {
    return /\.zip$/i.test(input) ? openZipPackSource(await readFile(input))
      : new SingleFilePackSource(makeEntry(path.basename(input), input));
  }
  const entries = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(input, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) entries.push(makeEntry(relative, absolute));
      else entries.push({ path: relative, read: async () => { throw new Error('不支持读取链接或特殊文件。'); } });
    }
  }
  await walk(input);
  entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return new FolderPackSource(entries);
}
