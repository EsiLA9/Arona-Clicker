// 修正脚本 v3（全量）：处理所有引用被移动引擎文件的位置 + 引擎内部相对引用。
// 定位策略：
//  阶段1: 用当前位置存在的文件系统解析 spec（正常相对解析）→ 目标 oldToNew 换算
//  阶段2: 失败时用「engine 根命名空间 + spec 最后一段名」定位
// 用法: node scripts/_fix3-engine-imports.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, sep, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'src', 'engine');

const MOVE = {
  'event-bus.ts':'core','entity-id.ts':'core','dev-log.ts':'core','display-name.ts':'core',
  'resource.ts':'core','tag.ts':'core','theme-runtime.ts':'core',
  'value-system.ts':'expression','game-num.ts':'expression','game-num-eval.ts':'expression',
  'stat-dsl.ts':'expression','condition-system.ts':'expression','condition-deps.ts':'expression',
  'funclet-executor.ts':'expression',
  'effect-engine.ts':'effect','trigger-system.ts':'effect','affector-engine.ts':'effect',
  'affector-text.ts':'effect','event-driven-reactor.ts':'effect',
  'extra.ts':'extra:index','extra-core.ts':'extra','extra-construct.ts':'extra','extra-merge.ts':'extra',
  'extra-path.ts':'extra','extra-read.ts':'extra','extra-validate.ts':'extra',
  'visibility-engine.ts':'visibility','visibility-eval.ts':'visibility','visibility-index.ts':'visibility',
  'reveal.ts':'visibility',
  'character-system.ts':'system','roster-system.ts':'system','character-availability.ts':'system',
  'color-system.ts':'system','gacha-service.ts':'system','passive-pool-system.ts':'system',
  'cultivate-system.ts':'system','spot-functionality.ts':'system','loot-system.ts':'system',
  'state-mutation-service.ts':'system','tick-system.ts':'system',
  'registry.ts':'registry','registry-validate.ts':'registry',
  'stats.ts':'stats','stats-counters.ts':'stats','tag-stats.ts':'stats','world-tilt.ts':'stats',
};

const stripExt = (p) => p.replace(/\.(ts|tsx|mts)$/, '');
const oldNameToNewAbs = new Map(); // 旧无扩展名 -> 新绝对路径(无扩展)
for (const [file, target] of Object.entries(MOVE)) {
  const base = file.replace(/\.ts$/, '');
  const [sub, name] = target.includes(':') ? target.split(':') : [target, base];
  oldNameToNewAbs.set(base, join(SRC_DIR, sub, name));
}
const oldNameSet = new Set(oldNameToNewAbs.keys());

function resolveReal(baseFile, spec) {
  const base = resolve(dirname(baseFile), spec);
  const cands = [base, base+'.ts', base+'.tsx', base+'.mts', base+'.js', base+'/index.ts', base+'/index.tsx', base+'/index.mts'];
  for (const c of cands) if (existsSync(c)) return stripExt(c);
  return null;
}
// 从 engine 根命名空间解析 spec：定位到 engine 根之后的第一段作为目标名。
// 支持 ./xxx / ../xxx / ../../engine/xxx / ../../../engine/xxx 等多种相对深度。
function resolveFromEngineRoot(spec) {
  const rel = spec.replace(/^\.+(\/|$)+/, '');
  const segs = rel.split('/');
  // 找到 engine 段（src/engine 或 engine），其后的第一段即目标名
  let start = -1;
  for (let i = 0; i < segs.length; i++) {
    if (segs[i] === 'engine') { start = i + 1; break; }
  }
  if (start < 0) start = 0; // engine 内部文件，直接用第一段
  if (start >= segs.length) return null;
  const name = segs[start];
  if (oldNameSet.has(name)) {
    const rest = segs.slice(start + 1).join('/');
    return rest ? oldNameToNewAbs.get(name) + '/' + rest : oldNameToNewAbs.get(name);
  }
  // types / game 等未移动目录
  const base = join(SRC_DIR, segs.slice(start).join('/'));
  const cands = [base, base+'.ts', base+'.tsx', base+'/index.ts', base+'/index.tsx', base+'/index.mts'];
  for (const c of cands) if (existsSync(c)) return stripExt(c);
  return null;
}

function toSpec(fromFile, realNoExt) {
  let rel = relative(dirname(fromFile), realNoExt).split(sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function collectTs(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules','dist','web-dist'].includes(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) collectTs(full, acc);
    else if (/\.(ts|mts)$/.test(e.name)) acc.push(full);
  }
  return acc;
}

const dirs = [join(ROOT, 'src'), join(ROOT, 'tests'), join(ROOT, 'tools'), join(ROOT, 'scripts')];
const files = [];
for (const d of dirs) if (existsSync(d)) collectTs(d, files);

let touched = 0;
for (const file of files) {
  if (!existsSync(file)) continue;
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(?:from\s*|import\s*\(\s*)(['"])([^'"]+)\1/);
    if (!m) continue;
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    let target = resolveReal(file, spec);
    if (!target) target = resolveFromEngineRoot(spec);
    if (!target) continue;
    const newSpec = toSpec(file, target);
    if (newSpec !== spec) {
      const quote = m[1];
      const re = new RegExp('((?:from\\s*|import\\s*\\(\\s*)' + quote + ')' + escapeRe(spec) + quote, 'g');
      lines[i] = lines[i].replace(re, `$1${newSpec}${quote}`);
      changed = true;
    }
  }
  if (changed) {
    touched++;
    writeFileSync(file, lines.join('\n'));
    console.log('FIX3 ' + file.replace(ROOT + sep, ''));
  }
}
console.log('修正文件数: ' + touched);
