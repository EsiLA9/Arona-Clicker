import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const root = process.cwd();
const archiveName = 'ai/archive/history.zip';
const usage = `npm run archive:docs -- add <ai/plan/文件或子目录 | ai/archive/inbox/内容> [...]
npm run archive:docs -- list [包内路径前缀]
npm run archive:docs -- read <完整包内路径>
add 会校验压缩包后移除原文件；list/read 不解压。`;

function localPath(name) {
  const full = path.resolve(root, name);
  const relative = path.relative(root, full);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('路径必须位于当前项目内');
  }
  for (let cursor = full; cursor !== root; cursor = path.dirname(cursor)) {
    if (fs.lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`不归档或写入符号链接：${name}`);
  }
  return full;
}

async function loadArchive() {
  const file = localPath(archiveName);
  return fs.existsSync(file) ? JSZip.loadAsync(fs.readFileSync(file), { checkCRC32: true }) : new JSZip();
}

async function add(names) {
  const files = new Map();
  const directories = new Set();
  function collect(full) {
    const name = path.relative(root, full).split(path.sep).join('/');
    const stat = fs.lstatSync(localPath(name));
    if (stat.isDirectory()) {
      directories.add(full);
      for (const child of fs.readdirSync(full).sort()) collect(path.join(full, child));
    } else if (stat.isFile()) {
      if (files.has(name)) throw new Error(`投入路径重复：${name}`);
      files.set(name, fs.readFileSync(full));
    } else throw new Error(`不支持的文件类型：${name}`);
  }
  for (const input of names) {
    const full = localPath(input);
    const name = path.relative(root, full).split(path.sep).join('/');
    if (!(name.startsWith('ai/plan/') && name !== 'ai/plan/00-index.md') && !name.startsWith('ai/archive/inbox/')) {
      throw new Error('只接收 ai/plan 的文件或子目录，以及 ai/archive/inbox 下的内容；不接收活动索引');
    }
    collect(full);
  }
  if (!files.size) throw new Error('没有可归档的文件');
  const archive = localPath(archiveName);
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  const lock = `${archive}.lock`;
  const handle = fs.openSync(lock, 'wx');
  const temporary = `${archive}.tmp`;
  let temporaryWritten = false;
  try {
    const zip = await loadArchive();
    for (const [name, content] of files) {
      if (zip.files[name]) throw new Error(`包内已存在，拒绝覆盖：${name}`);
      zip.file(name, content, { createFolders: false });
    }
    fs.writeFileSync(temporary, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), { flag: 'wx' });
    temporaryWritten = true;
    const verified = await JSZip.loadAsync(fs.readFileSync(temporary), { checkCRC32: true });
    for (const [name, content] of files) {
      if (!(await verified.file(name).async('nodebuffer')).equals(content)) throw new Error(`压缩校验失败：${name}`);
    }
    fs.renameSync(temporary, archive);
    // Recheck every source before deleting any; changed files remain beside a valid archive.
    for (const [name, content] of files) {
      if (!fs.readFileSync(localPath(name)).equals(content)) throw new Error(`源文件已变化，保留原件：${name}`);
    }
    for (const name of files.keys()) fs.unlinkSync(localPath(name));
    for (const dir of [...directories].sort((a, b) => b.length - a.length)) {
      try { fs.rmdirSync(dir); }
      catch (error) { if (error.code !== 'ENOTEMPTY') throw error; }
    }
    console.log(`已归档 ${files.size} 个文件至 ${archiveName}，原文件已移除。请同步更新活动索引和引用。`);
  } finally {
    fs.closeSync(handle);
    fs.unlinkSync(lock);
    if (temporaryWritten && fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'add' && args.length) await add(args);
  else if (command === 'list' && args.length <= 1) {
    const zip = await loadArchive();
    const names = Object.keys(zip.files).filter(name => !zip.files[name].dir && name.startsWith(args[0] ?? '')).sort();
    console.log(names.length ? names.join('\n') : '归档为空或没有匹配项。');
  } else if (command === 'read' && args.length === 1) {
    const entry = (await loadArchive()).file(args[0]);
    if (!entry) throw new Error(`包内文件不存在：${args[0]}`);
    process.stdout.write(await entry.async('nodebuffer'));
  } else if (!command || command === '--help') console.log(usage);
  else throw new Error(usage);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
