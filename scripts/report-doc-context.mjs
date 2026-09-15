// 输出文档分区规模，辅助判断上下文包是否需要拆分。
// 这是估算报告，不尝试替代模型 tokenizer，也不读取源码内容。
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function mdFilesUnder(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
      out.push(...mdFilesUnder(full));
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file) => path.relative(root, file).split(path.sep).join('/');
const estimateTokens = (chars) => Math.ceil(chars / 4);

const groups = [
  ['docs/docs-828', 'docs/docs-828'],
  ['docs/ai', 'docs/ai'],
  ['docs/plan-work/mechanisms', 'docs/plan-work/mechanisms'],
  ['docs/plan-work/archive', 'docs/plan-work/archive'],
  ['docs/newPlan', 'docs/newPlan'],
];

const rows = groups.map(([label, relativeDir]) => {
  const files = mdFilesUnder(path.join(root, relativeDir));
  const chars = files.reduce((sum, file) => sum + fs.readFileSync(file, 'utf8').length, 0);
  return {
    path: label,
    files: files.length,
    chars,
    estimatedTokens: estimateTokens(chars),
  };
});

console.table(rows);
console.log('估算说明：estimatedTokens = 字符数 / 4，仅用于相对比较，不代表具体模型 tokenizer 结果。');

const oversized = rows.filter((row) => row.estimatedTokens > 60000);
if (oversized.length) {
  console.log('提示：以下分区超过 60k token 估算值，默认不应作为单个施工 Unit 的上下文：');
  for (const row of oversized) console.log(`- ${row.path}: ~${row.estimatedTokens} tokens`);
}

const legacy = mdFilesUnder(path.join(root, 'docs/newPlan'));
if (legacy.length) {
  console.log(`提示：docs/newPlan/ 仍有 ${legacy.length} 篇 Markdown，需要整理。`);
}
