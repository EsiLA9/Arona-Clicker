// 文档完整性静态检查：只做可机械核实、且对当前文档模型仍有意义的检查。
//
// 当前文档边界：
//   - docs/docs-830/ 是当前项目 Wiki；ai/guide、ai/plan、ai/archive 分别保存
//     Agent 指引、计划记录和退役材料。
//   - docs/docs-828/ 已退役删除；只读历史快照保存在 ai/archive/docs-history/docs-828-snapshot/，
//     旧路径链接按确定性前缀改写解析到快照（仍参与 R1 存在性校验）。
//
// 保留并扩展为机械检查：链接目标存在、ai/plan 内文件名唯一（裸名链接可解析）、
// 引用的源码路径存在、已使用的 YAML 路由元信息结构完整、旧计划目录不再承载 WikiLink。
import fs from 'node:fs';
import path from 'node:path';
import { buildWikiIndex, formatWikiLinks, projectWikiPath } from './wiki-link-format.mjs';

const root = process.cwd();
const docsRoot = path.join(root, 'docs');
const PLAN_DIR = 'ai/plan/';
const ARCHIVE_DIRS = new Set(['ai/archive', 'docs/archive', 'docs/plan-work/archive']);
const NAV_BASE = '00-index';

const errors = [];
const wikiIndex = buildWikiIndex(root);
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const METADATA_KEYS = ['scope', 'authority', 'read_when', 'avoid_when', 'related_modules'];

function mdFilesUnder(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(entry.name) || ARCHIVE_DIRS.has(rel(full))) continue;
      out.push(...mdFilesUnder(full));
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

const allMd = mdFilesUnder(docsRoot)
  .concat(mdFilesUnder(path.join(root, 'ai')))
  .concat(mdFilesUnder(path.join(root, 'ui-style')));
const rootMd = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.md'))
  .map((e) => path.join(root, e.name));

const byBase = new Map();
for (const f of allMd.concat(rootMd)) {
  // 归档不参与扫描或裸名解析；现行文档仍可用完整路径引用归档。
  const base = path.basename(f, '.md');
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(f);
}

// R2：ai/plan 内文件名唯一——裸名链接必须无歧义
for (const [base, hits] of byBase) {
  if (base === NAV_BASE) continue;
  const inPlan = hits.filter((f) => rel(f).startsWith(PLAN_DIR));
  if (inPlan.length > 1) {
    errors.push('[R2 重名] ai/plan 内文件名不唯一: ' + base + ' -> ' + hits.map(rel).join(', '));
  }
}

const SRC_RE = /`((?:src|tests|tools|scripts)\/[A-Za-z0-9_\-./]+\.(?:ts|mts|mjs|css|json|html))`/g;
const DELETION_HINT = /删除|已移除|已失联|已失效|移除|废弃|不再存在/;
const RETIRED_DOCS_828_PREFIX = 'docs/docs-828/';
const DOCS_828_SNAPSHOT_PREFIX = 'ai/archive/docs-history/docs-828-snapshot/';
const MOVED_DOC_PREFIXES = [
  ['docs/plan-work/archive/', 'ai/archive/'],
  ['docs/plan-work/', 'ai/plan/'],
  ['docs/archive/', 'ai/archive/docs-history/'],
  ['docs/docs-829/', 'ai/archive/docs-829/'],
  ['docs/ai/', 'ai/guide/'],
  ['docs/examples/', 'ai/guide/examples/'],
];

function resolveMovedDocPath(term) {
  if (term.startsWith(RETIRED_DOCS_828_PREFIX)) {
    return DOCS_828_SNAPSHOT_PREFIX + term.slice(RETIRED_DOCS_828_PREFIX.length);
  }
  const movedIndexes = new Map([
    ['docs/plan-work', 'ai/plan/00-index'],
    ['docs/ai', 'ai/guide/00-index'],
    ['docs/docs-829', 'ai/archive/docs-829/00-INDEX'],
    ['docs/examples', 'ai/guide/examples/00-index'],
  ]);
  if (movedIndexes.has(term)) return movedIndexes.get(term);
  if (term === 'docs/abstract' || term === 'docs/abstract.md') {
    return 'ai/guide/project-abstract' + (term.endsWith('.md') ? '.md' : '');
  }
  for (const [oldPrefix, newPrefix] of MOVED_DOC_PREFIXES) {
    if (term.startsWith(oldPrefix)) return newPrefix + term.slice(oldPrefix.length);
  }
  return term;
}

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
  checkFrontMatter(text, file);

  // Only current Wiki targets are normalized; archives are indexed as possible
  // filename collisions but their contents are not scanned or changed.
  const formatted = formatWikiLinks(text, wikiIndex);
  for (const issue of formatted.issues) errors.push('[R6 WikiLink 歧义] ' + r + '：' + issue);
  if (formatted.changes) {
    errors.push('[R6 WikiLink 写法] ' + r + '：有 ' + formatted.changes + ' 处可规范化；运行 npm run format:doc-links');
  }

  // R1：WikiLink 目标存在（裸名按文件名解析，全路径按路径解析）
  // 代码块与行内代码中的 [[...]] 是文档示例而非链接，先剥离再扫描
  const linkText = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  if (/\[\[docs\/newPlan\//.test(linkText)) {
    errors.push('[R5 旧计划链接] ' + r + '：当前文档不应使用 docs/newPlan/ WikiLink');
  }
  for (const m of linkText.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    const inner = m[1];
    const barIdx = inner.indexOf('|');
    const term = (barIdx >= 0 ? inner.slice(0, barIdx) : inner).split('#')[0].trim();
    if (!term || term.includes('...')) continue;

    // 退役目录中的链接按路径迁移表解析；只读快照本身不因此改写。
    const resolvedTerm = resolveMovedDocPath(projectWikiPath(term, wikiIndex) ?? term);

    const direct = path.join(root, resolvedTerm + '.md');
    const directPath = path.join(root, resolvedTerm);
    let target;
    if (fs.existsSync(direct)) {
      target = direct;
    } else if (fs.existsSync(directPath)) {
      target = directPath;
    } else if (fs.existsSync(path.join(directPath, 'index.md'))) {
      target = path.join(directPath, 'index.md');
    } else {
      const hits = byBase.get(path.basename(resolvedTerm, '.md'));
      if (!hits) {
        errors.push('[R1 目标缺失] ' + r + ' -> [[' + inner + ']]');
      } else if (hits.length > 1 && !term.includes('/')) {
        errors.push(
          '[R1 链接歧义] ' + r + ' -> [[' + inner + ']] 命中多个文件: ' + hits.map(rel).join(', ')
        );
      } else if (hits.length === 1) {
        target = hits[0];
      } else if (term.includes('/')) {
        errors.push('[R1 目标缺失] ' + r + ' -> [[' + inner + ']]');
      }
    }
  }

  // R3：引用的源码路径存在
  for (const line of text.split(/\r?\n/)) {
    if (DELETION_HINT.test(line)) continue;
    for (const m of line.matchAll(SRC_RE)) {
      if (!fs.existsSync(path.join(root, m[1]))) {
        errors.push('[R3 源码路径失效] ' + r + ' -> `' + m[1] + '`');
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
