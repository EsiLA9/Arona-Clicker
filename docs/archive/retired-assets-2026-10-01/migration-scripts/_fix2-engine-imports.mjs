// 修正脚本 v2：只处理被移动的引擎文件，用「engine 根命名空间 + spec 名」定位目标。
// 被移动文件原本都在 engine 根，其相对 import 的目标必然在 engine 根命名空间下
// （被移动文件 / types / game 子目录）。
// 用法: node scripts/_fix2-engine-imports.mjs
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
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
const oldNameToNewAbs = new Map(); // 旧无扩展名(如 'tag') -> 新绝对路径(无扩展)
for (const [file, target] of Object.entries(MOVE)) {
  const base = file.replace(/\.ts$/, '');
  const [sub, name] = target.includes(':') ? target.split(':') : [target, base];
  oldNameToNewAbs.set(base, join(SRC_DIR, sub, name));
}

function resolveFromEngineRoot(spec) {
  // spec 形如 ./xxx 或 ./xxx/yyy
  const rel = spec.replace(/^\.\//, '');
  const segs = rel.split('/');
  const firstName = segs[0];
  if (oldNameToNewAbs.has(firstName)) {
    // 目标是根下被移动文件；rest 路径拼到其新位置
    const rest = segs.slice(1).join('/');
    return rest ? oldNameToNewAbs.get(firstName) + '/' + rest : oldNameToNewAbs.get(firstName);
  }
  // 否则目标是 engine 根下的目录（types / game）
  const base = join(SRC_DIR, rel);
  const cands = [base, base+'.ts', base+'.tsx', base+'.mts', base+'.js', base+'/index.ts', base+'/index.tsx', base+'/index.mts'];
  for (const c of cands) if (existsSync(c)) return stripExt(c);
  return null;
}

function toSpec(fromFile, realNoExt) {
  let rel = relative(dirname(fromFile), realNoExt).split(sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 只处理被移动的文件（位于 MOVE 的目标子目录内）
const movedAbs = new Set([...oldNameToNewAbs.values()].map((p) => p + '.ts'));

let touched = 0;
for (const abs of movedAbs) {
  if (!existsSync(abs)) continue;
  const file = abs;
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(?:from\s*|import\s*\(\s*)(['"])([^'"]+)\1/);
    if (!m) continue;
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    const target = resolveFromEngineRoot(spec);
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
    console.log('FIX2 ' + file.replace(ROOT + sep, ''));
  }
}
console.log('修正文件数: ' + touched);
