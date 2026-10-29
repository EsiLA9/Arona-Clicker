import fs from 'node:fs';
import path from 'node:path';
import { activeMarkdownFiles, buildWikiIndex, formatWikiLinks } from './wiki-link-format.mjs';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--write' && arg !== '--check') || (args.includes('--write') && args.includes('--check'))) {
  console.error('用法：node scripts/format-doc-links.mjs [--check | --write]');
  process.exit(2);
}
const write = args.includes('--write');
const index = buildWikiIndex(process.cwd());
let filesChanged = 0, linksChanged = 0, issueCount = 0;
for (const file of activeMarkdownFiles(process.cwd())) {
  const source = fs.readFileSync(file, 'utf8');
  const result = formatWikiLinks(source, index);
  const relative = path.relative(process.cwd(), file).split(path.sep).join('/');
  for (const issue of result.issues) { console.error(`${relative}: ${issue}`); issueCount++; }
  if (!result.changes) continue;
  filesChanged++; linksChanged += result.changes;
  if (write) fs.writeFileSync(file, result.text, 'utf8');
}
console.log(`${write ? '已更新' : '待更新'} ${filesChanged} 个文件、${linksChanged} 个链接；歧义 ${issueCount} 处。`);
console.log(`名称检查范围：${index.vaultRoot}`);
if (issueCount || (!write && args.includes('--check') && linksChanged)) process.exitCode = 1;
