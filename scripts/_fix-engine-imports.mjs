// 修正脚本：处理中间态——引擎文件已移动到子目录，但内部相对 import 尚未规范化。
// 对每个引擎文件，用【移动前位置】解析每个相对 import 的真实目标，
// 再用【当前位置】计算正确的相对路径。
// 用法: node scripts/_fix-engine-imports.mjs [--detail]
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'src', 'engine');

// 与主脚本一致的移动映射：目标子目录 / 'sub:name'
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
const oldToNew = new Map();
for (const [file, target] of Object.entries(MOVE)) {
  const old = join(SRC_DIR, file);
  const [sub, name] = target.includes(':') ? target.split(':') : [target, file.replace(/\.ts$/, '')];
  oldToNew.set(stripExt(old), join(SRC_DIR, sub, name));
}
// 反向：新路径 -> 旧路径
const newToOld = new Map();
for (const [o, n] of oldToNew) newToOld.set(n, o);

function resolveReal(baseFile, spec) {
  const base = resolve(dirname(baseFile), spec);
  const cands = [base, base+'.ts', base+'.tsx', base+'.mts', base+'.js', base+'/index.ts', base+'/index.tsx', base+'/index.mts', base+'/index.js'];
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

const files = collectTs(SRC_DIR);
let touched = 0;
const detail = process.argv.includes('--detail');
for (const file of files) {
  const oldFile = newToOld.has(stripExt(file)) ? newToOld.get(stripExt(file)) + '.ts' : file;
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(?:from\s*|import\s*\(\s*)(['"])([^'"]+)\1/);
    if (!m) continue;
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    // 先按旧位置解析（target 一般在 engine 根），失败再按当前位置解析（同目录引用）
    let real = resolveReal(oldFile, spec);
    if (!real) real = resolveReal(file, spec);
    if (!real) continue;
    const target = oldToNew.has(real) ? oldToNew.get(real) : real;
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
    console.log('FIX ' + file.replace(ROOT + sep, ''));
    if (detail) {
      for (let j = 0; j < lines.length; j++) {
        const orig = readFileSync(file, 'utf8').split('\n');
        if (orig[j] !== lines[j]) console.log(`   +${j + 1}: ${lines[j].trim()}`);
      }
    }
  }
}
console.log('\n修正文件数: ' + touched);
