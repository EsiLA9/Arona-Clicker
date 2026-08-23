// 临时重构脚本：移动 src/engine 顶层文件到子系统目录，并重写所有受影响 import 路径。
// 用法: node scripts/_refactor-move-engine.mjs [--dry-run] [--apply]
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---- 归类方案：顶层文件名 -> 目标子目录 ----
// 特殊：extra.ts 是聚合 barrel，移到 extra/ 目录后重命名为 index.ts，使
// `from './extra'` 自然解析到 extra/index.ts。
const MOVE = {
  // core
  'event-bus.ts': 'core', 'entity-id.ts': 'core', 'dev-log.ts': 'core', 'display-name.ts': 'core',
  'resource.ts': 'core', 'tag.ts': 'core', 'theme-runtime.ts': 'core',
  // expression
  'value-system.ts': 'expression', 'game-num.ts': 'expression', 'game-num-eval.ts': 'expression',
  'stat-dsl.ts': 'expression', 'condition-system.ts': 'expression', 'condition-deps.ts': 'expression',
  'funclet-executor.ts': 'expression',
  // effect
  'effect-engine.ts': 'effect', 'trigger-system.ts': 'effect', 'affector-engine.ts': 'effect',
  'affector-text.ts': 'effect', 'event-driven-reactor.ts': 'effect',
  // extra
  'extra.ts': 'extra:index', 'extra-core.ts': 'extra', 'extra-construct.ts': 'extra', 'extra-merge.ts': 'extra',
  'extra-path.ts': 'extra', 'extra-read.ts': 'extra', 'extra-validate.ts': 'extra',
  // visibility
  'visibility-engine.ts': 'visibility', 'visibility-eval.ts': 'visibility', 'visibility-index.ts': 'visibility',
  'reveal.ts': 'visibility',
  // system
  'character-system.ts': 'system', 'roster-system.ts': 'system', 'character-availability.ts': 'system',
  'color-system.ts': 'system', 'gacha-service.ts': 'system', 'passive-pool-system.ts': 'system',
  'cultivate-system.ts': 'system', 'spot-functionality.ts': 'system', 'loot-system.ts': 'system',
  'state-mutation-service.ts': 'system', 'tick-system.ts': 'system',
  // registry
  'registry.ts': 'registry', 'registry-validate.ts': 'registry',
  // stats
  'stats.ts': 'stats', 'stats-counters.ts': 'stats', 'tag-stats.ts': 'stats', 'world-tilt.ts': 'stats',
};

const SRC_DIR = join(ROOT, 'src', 'engine');

// 顶层文件当前绝对路径
const topFiles = new Set();
const oldToNew = new Map(); // 旧绝对路径(无扩展) -> 新绝对路径(无扩展)
for (const [file, target] of Object.entries(MOVE)) {
  const old = join(SRC_DIR, file);
  let newFile;
  if (target.includes(':')) {
    const [sub, name] = target.split(':');
    newFile = join(SRC_DIR, sub, name + '.ts');
  } else {
    newFile = join(SRC_DIR, target, file);
  }
  oldToNew.set(stripExt(old), stripExt(newFile));
  topFiles.add(stripExt(old));
}

function stripExt(p) { return p.replace(/\.(ts|tsx|mts|js|mjs)$/, ''); }

// 收集需要扫描的 .ts 源文件
function collectTsFiles(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'web-dist') continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) collectTsFiles(full, acc);
    else if (/\.(ts|mts|tsx)$/.test(ent.name)) acc.push(full);
  }
  return acc;
}

const scanDirs = [join(ROOT, 'src'), join(ROOT, 'tests'), join(ROOT, 'scripts'), join(ROOT, 'tools')];
const files = [];
for (const d of scanDirs) if (existsSync(d)) collectTsFiles(d, files);

// 把解析到的 import 目标映射为真实文件（无扩展）
function resolveReal(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // 裸模块
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base, base + '.ts', base + '.tsx', base + '.mts', base + '.js', base + '/index.ts', base + '/index.tsx', base + '/index.mts', base + '/index.js'];
  for (const c of candidates) if (existsSync(c)) return stripExt(c);
  return null;
}

// 将无扩展绝对路径转回 from 文件的相对 import spec（保留无扩展形式）
function toSpec(fromFile, realNoExt) {
  let rel = relative(dirname(fromFile), realNoExt).split(sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// ---- 重写单个文件的 import spec ----
const IMPORT_RE = /((?:import|export)\b[^;'"]*?)(?:from\s*)?['"]([^'"]+)['"]/g;
// 需同时覆盖: import x from '..'; import '..'; export * from '..'; export {x} from '..'; import('..')
const SPEC_RE = /(['"])([^'"]+)\1/g;

// oldFile: 移动前路径，用于解析 import 目标的真实位置（当前文件仍在原位）
// newFile: 移动后路径，用于计算改写后的相对 spec（目标已换算到移动后位置）
function rewriteFile(oldFile, newFile) {
  const src = readFileSync(oldFile, 'utf8');
  const lines = src.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/(?:from\s*|import\s*\(\s*)(['"])([^'"]+)\1/);
    if (!m) continue;
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    const real = resolveReal(oldFile, spec);
    if (!real) continue;
    let target;
    if (oldToNew.has(real)) {
      target = oldToNew.get(real); // 目标是移动的顶层文件
    } else {
      target = real; // 目标未移动
    }
    // 基于源文件【移动后】位置计算新 spec；与旧 spec 不同才改写
    const newSpec = toSpec(newFile, target);
    if (newSpec !== spec) {
      const quote = m[1];
      // 保留前缀（from / import( ）与引号，仅替换中间的 spec
      const re = new RegExp('((?:from\\s*|import\\s*\\(\\s*)' + quote + ')' + escapeRe(spec) + quote, 'g');
      lines[i] = lines[i].replace(re, `$1${newSpec}${quote}`);
      changed = true;
    }
  }
  return { changed, content: lines.join('\n'), lines };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 移动前路径 -> 移动后路径（无扩展）；未移动则返回原路径
function newPathOf(p) {
  if (oldToNew.has(stripExt(p))) return oldToNew.get(stripExt(p));
  return stripExt(p);
}

// ---- 执行 ----
const dryRun = process.argv.includes('--dry-run');
const apply = process.argv.includes('--apply');
const printDetail = process.argv.includes('--detail');

// 1. 重写 import（此时文件仍在原位，用旧路径解析目标、用新路径算新 spec）
let touched = 0;
for (const f of files) {
  if (!existsSync(f)) continue;
  const newFile = newPathOf(f) + '.ts';
  const { changed, content, lines } = rewriteFile(f, newFile);
  if (changed) {
    touched++;
    if (apply) writeFileSync(f, content); // 写回原位（随后移动）
    console.log((apply ? 'REWRITE ' : '[dry] ') + f.replace(ROOT + sep, ''));
    if (printDetail) {
      for (let i = 0; i < lines.length; i++) {
        const orig = readFileSync(f, 'utf8').split('\n');
        if (orig[i] !== lines[i]) console.log(`   +${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
}

// 2. 移动文件
if (apply) {
  for (const [file, target] of Object.entries(MOVE)) {
    const old = join(SRC_DIR, file);
    const [sub, name] = target.includes(':') ? target.split(':') : [target, file.replace(/\.ts$/, '')];
    const dir = join(SRC_DIR, sub);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const nw = join(dir, name + '.ts');
    if (existsSync(old)) { renameSync(old, nw); console.log('MOVE', `engine/${file}`, '->', `engine/${sub}/${name}.ts`); }
  }
}

console.log(`\n[${dryRun ? 'DRY-RUN' : 'APPLY'}] 重写文件数: ${touched}`);
if (dryRun) console.log('(仅预览，未写入。加 --apply 实际执行)');
