import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planDir = path.join(root, 'ai/plan');
const indexPath = path.join(planDir, '00-index.md');
const templatePath = path.join(root, 'ai/guide/templates/execution-task.md');
const archivePath = path.join(root, 'ai/archive/history.zip');
const usage = `本地 Task 管理：
  npm run task -- newTask <slug> <标题>
  npm run task -- newSubtask <task-id> <范围> <负责人>
  npm run task -- archive <task-id>

Task 与 SubTask 内容保存在 ai/plan Markdown；归档复用 archive:docs。
newTask 只生成骨架；交付前按 ai/guide/task-workflow.md 补全当前依据与具体改动方案。`;

function fail(message) {
  throw new Error(message);
}

function cleanField(value, label) {
  const clean = value?.trim();
  if (!clean || /[\r\n|]/.test(clean)) fail(`${label}不能为空，也不能包含换行或 |。`);
  return clean;
}

async function usedTaskIds() {
  const ids = new Set();
  for (const name of fs.readdirSync(planDir)) {
    const match = name.match(/^task-(\d+)-.+\.md$/);
    if (match) ids.add(Number(match[1]));
  }
  if (fs.existsSync(archivePath)) {
    const zip = await JSZip.loadAsync(fs.readFileSync(archivePath), { checkCRC32: true });
    for (const name of Object.keys(zip.files)) {
      const match = name.match(/^ai\/plan\/task-(\d+)-.+\.md$/);
      if (match) ids.add(Number(match[1]));
    }
  }
  return ids;
}

function taskFile(taskId) {
  const matches = fs.readdirSync(planDir).filter(name => name.startsWith(`${taskId}-`) && name.endsWith('.md'));
  if (matches.length !== 1) fail(`${taskId} 必须唯一匹配一个活动 Task 文件，当前匹配 ${matches.length} 个。`);
  return path.join(planDir, matches[0]);
}

function lineEnding(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function addIndexRow(index, row, newline) {
  const lines = index.split(/\r?\n/);
  const header = lines.findIndex(line => /^\|\s*Task\s*\|\s*状态\s*\|/.test(line));
  if (header < 0 || !/^\|\s*-+/.test(lines[header + 1] ?? '')) fail('活动索引没有识别到 Task 表格。');
  lines.splice(header + 2, 0, row);
  return lines.join(newline);
}

async function newTask(args) {
  if (args.length !== 2) fail(usage);
  const slug = args[0];
  const title = cleanField(args[1], '标题');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('slug 只允许小写英文、数字和单个连字符。');

  const ids = await usedTaskIds();
  const id = `task-${String(Math.max(0, ...ids) + 1).padStart(4, '0')}`;
  const fileName = `${id}-${slug}.md`;
  const filePath = path.join(planDir, fileName);
  if (fs.existsSync(filePath)) fail(`目标文件已存在：ai/plan/${fileName}`);

  const template = fs.readFileSync(templatePath, 'utf8');
  const body = template.match(/```markdown\r?\n([\s\S]*?)\r?\n```/)?.[1];
  if (!body) fail('Task 模板中没有 Markdown 模板区块。');
  const document = body.replace('# Task：<可独立验收的结果>', `# Task：${title}`);

  let index = fs.readFileSync(indexPath, 'utf8');
  const indexNewline = lineEnding(index);
  index = addIndexRow(index, `| [[ai/plan/${id}-${slug}]] | 待处理 | 补全当前依据与具体改动方案 |`, indexNewline);
  fs.writeFileSync(filePath, document, { flag: 'wx' });
  fs.writeFileSync(indexPath, index);
  console.log(`已创建 ${id}：ai/plan/${fileName}`);
  console.log('已生成待补全骨架；交付前按 ai/guide/task-workflow.md 写明具体改动、调用衔接与验证，删除模板占位符。');
}

function ensureSubtasksSection(text, newline) {
  let document = text;
  if (document.includes('## SubTasks')) return document;
  const section = `## SubTasks${newline}${newline}| ID | 范围 | 负责人 | 状态 |${newline}| --- | --- | --- | --- |${newline}${newline}`;
  const related = document.indexOf('## 相关文件与资料');
  document = related < 0 ? `${document.trimEnd()}${newline}${newline}${section}` : `${document.slice(0, related)}${section}${document.slice(related)}`;
  return document;
}

function newSubtask(args) {
  if (args.length !== 3) fail(usage);
  const [taskId, scope, owner] = args;
  if (!/^task-\d+$/.test(taskId)) fail('Task ID 格式应为 task-编号。');
  const cleanScope = cleanField(scope, '范围');
  const cleanOwner = cleanField(owner, '负责人');
  const filePath = taskFile(taskId);
  const original = fs.readFileSync(filePath, 'utf8');
  const newline = lineEnding(original);
  let document = ensureSubtasksSection(original, newline);
  const ids = [...document.matchAll(/\bST-(\d+)\b/g)].map(([, number]) => Number(number));
  const id = `ST-${String(Math.max(0, ...ids) + 1).padStart(2, '0')}`;
  const lines = document.split(/\r?\n/);
  const header = lines.findIndex(line => line.trim() === '## SubTasks');
  let end = lines.findIndex((line, index) => index > header && /^##\s/.test(line));
  if (end < 0) end = lines.length;
  const tableHeader = lines.findIndex((line, index) => index > header && index < end && /^\|\s*ID\s*\|/.test(line));
  if (tableHeader < 0) fail('SubTasks 区域没有识别到编号表格。');
  let insertAt = tableHeader + 2;
  while (insertAt < end && /^\|\s*ST-\d+\s*\|/.test(lines[insertAt])) insertAt++;
  lines.splice(insertAt, 0, `| ${id} | ${cleanScope} | ${cleanOwner} | 待分派 |`);
  fs.writeFileSync(filePath, lines.join(newline));
  console.log(`已登记 ${id}：${taskId} / ${scope} / ${owner}`);
}

function archiveTask(args) {
  if (args.length !== 1 || !/^task-\d+$/.test(args[0])) fail(usage);
  const [taskId] = args;
  const filePath = taskFile(taskId);
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  const task = fs.readFileSync(filePath, 'utf8');
  const status = task.match(/^状态：([^\r\n]+)/m)?.[1] ?? '';
  if (!/(完成|已完成|取消|已取消|complete|cancelled)/i.test(status) || /(待|进行中|受阻)/.test(status)) {
    fail(`只归档已完成或已取消的 Task；当前状态为“${status || '未填写'}”。`);
  }
  const taskLines = task.split(/\r?\n/);
  const subtaskHeader = taskLines.findIndex(line => line.trim() === '## SubTasks');
  let subtaskEnd = subtaskHeader < 0 ? -1 : taskLines.findIndex((line, index) => index > subtaskHeader && /^##\s/.test(line));
  if (subtaskHeader >= 0 && subtaskEnd < 0) subtaskEnd = taskLines.length;
  const unfinishedSubtask = subtaskHeader >= 0 && taskLines.slice(subtaskHeader + 1, subtaskEnd).some(line => {
    if (!/^\|\s*ST-\d+\s*\|/.test(line)) return false;
    const state = line.split('|').at(-2)?.trim() ?? '';
    return /(待|进行中|受阻|blocked|in progress)/i.test(state);
  });
  if (unfinishedSubtask) fail('仍有待分派、进行中或受阻的 SubTask，不能归档。');

  const index = fs.readFileSync(indexPath, 'utf8');
  const base = path.basename(filePath, '.md');
  const indexLines = index.split(/\r?\n/);
  const row = indexLines.findIndex(line => line.includes(`[[ai/plan/${base}]]`));
  if (row < 0) fail(`活动索引没有 ${taskId} 条目。`);

  const result = spawnSync(process.execPath, ['scripts/archive-docs.mjs', 'add', relative], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`归档命令失败，Task 原件与索引均保留：${taskId}`);
  indexLines.splice(row, 1);
  fs.writeFileSync(indexPath, indexLines.join(lineEnding(index)));
  console.log(`已归档 ${taskId}，并从活动索引移除。请检查正文中的旧 WikiLink 引用。`);
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'newTask') await newTask(args);
  else if (command === 'newSubtask') newSubtask(args);
  else if (command === 'archive') archiveTask(args);
  else if (!command || command === '--help') console.log(usage);
  else fail(usage);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
