// 文档完整性静态检查：只做可机械核实、且对当前文档模型仍有意义的检查。
//
// 模型背景（2026-09-15 起）：
//   - docs/docs-828/   当前事实源（核心）
//   - docs/plan-work/  冻结考古层（archive/ + mechanisms/ + 00-index），不再有生命周期目录，
//                      因此不再检查准出、状态词表与目录一致性。
//
// 保留并扩展为机械检查：链接目标存在、plan-work 内文件名唯一（裸名链接可解析）、
// 引用的源码路径存在、已使用的 YAML 路由元信息结构完整、旧计划目录不再承载 WikiLink。
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docsRoot = path.join(root, 'docs');
const PLAN_DIR = 'docs/plan-work/';
const NAV_BASE = '00-index';

const errors = [];
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const METADATA_KEYS = ['scope', 'authority', 'read_when', 'avoid_when', 'related_modules'];

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

const allMd = mdFilesUnder(docsRoot);
const rootMd = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.md'))
  .map((e) => path.join(root, e.name));

const byBase = new Map();
for (const f of allMd.concat(rootMd)) {
  const base = path.basename(f, '.md');
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(f);
}

// R2：plan-work 内文件名唯一——裸名链接必须无歧义
for (const [base, hits] of byBase) {
  if (base === NAV_BASE) continue;
  const inPlan = hits.filter((f) => rel(f).startsWith(PLAN_DIR));
  if (inPlan.length > 1) {
    errors.push('[R2 重名] plan-work 内文件名不唯一: ' + base + ' -> ' + hits.map(rel).join(', '));
  }
}

const SRC_RE = /`((?:src|tests|tools|scripts)\/[A-Za-z0-9_\-./]+\.(?:ts|mts|mjs|css|json|html))`/g;
const DELETION_HINT = /删除|已移除|已失联|已失效|移除|废弃|不再存在/;

function checkFrontMatter(text, file) {
  if (!/^---\r?\n/.test(text)) return;
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const r = rel(file);
  if (!match) {
    errors.push('[R4 元信息格式] ' + r + '：YAML 元信息缺少闭合分隔线');
    return;
  }
  for (const key of METADATA_KEYS) {
    if (!new RegExp('^' + key + ':', 'm').test(match[1])) {
      errors.push('[R4 元信息字段缺失] ' + r + '：缺少 ' + key);
    }
  }
}

const legacyPlanDir = path.join(root, 'docs/newPlan');
if (fs.existsSync(legacyPlanDir)) {
  const legacyMarkdown = mdFilesUnder(legacyPlanDir);
  if (legacyMarkdown.length) {
    errors.push('[R5 旧计划目录非空] docs/newPlan/ 仍包含 Markdown 文件: ' + legacyMarkdown.map(rel).join(', '));
  }
}

for (const file of allMd.concat([path.join(root, 'AGENTS.md')])) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const r = rel(file);
  const isArchive = r.startsWith(PLAN_DIR + 'archive/');

  checkFrontMatter(text, file);

  // R1：WikiLink 目标存在（裸名按文件名解析，全路径按路径解析）
  // 代码块与行内代码中的 [[...]] 是文档示例而非链接，先剥离再扫描
  const linkText = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  if (!isArchive && /\[\[docs\/newPlan\//.test(linkText)) {
    errors.push('[R5 旧计划链接] ' + r + '：当前文档不应使用 docs/newPlan/ WikiLink');
  }
  for (const m of linkText.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    const inner = m[1];
    const barIdx = inner.indexOf('|');
    const term = (barIdx >= 0 ? inner.slice(0, barIdx) : inner).split('#')[0].trim();
    if (!term || term.includes('...')) continue;

    const direct = path.join(root, term + '.md');
    if (fs.existsSync(direct)) continue;
    if (fs.existsSync(path.join(root, term)) || fs.existsSync(path.join(root, term, 'index.md'))) continue;

    const hits = byBase.get(path.basename(term, '.md'));
    if (!hits) {
      errors.push('[R1 目标缺失] ' + r + ' -> [[' + inner + ']]');
    } else if (hits.length > 1 && !term.includes('/')) {
      errors.push(
        '[R1 链接歧义] ' + r + ' -> [[' + inner + ']] 命中多个文件: ' + hits.map(rel).join(', ')
      );
    }
  }

  // R3：引用的源码路径存在（冻结考古层为历史记录，豁免）
  if (!isArchive) {
    for (const line of text.split(/\r?\n/)) {
      if (DELETION_HINT.test(line)) continue;
      for (const m of line.matchAll(SRC_RE)) {
        if (!fs.existsSync(path.join(root, m[1]))) {
          errors.push('[R3 源码路径失效] ' + r + ' -> `' + m[1] + '`');
        }
      }
    }
  }
}

console.log('errors: ' + errors.length);
for (const item of errors) console.log('  ' + item);
console.log('');
console.log('scanned markdown: ' + allMd.length);

if (errors.length) {
  console.log('\ncheck:docs FAILED');
  process.exit(1);
}
console.log('\ncheck:docs passed');
