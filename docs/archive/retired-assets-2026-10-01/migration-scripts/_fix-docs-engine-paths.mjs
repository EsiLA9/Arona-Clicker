// 文档路径更新脚本：把 docs-818/*.md 中旧的引擎顶层文件 wiki 链接更新为新子目录路径。
// 用法: node scripts/_fix-docs-engine-paths.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(new URL('..', import.meta.url).pathname, '');
// Windows 下 pathname 可能带前导 /
const dir = join('c:/Users/15229/Documents/Obsidian Vault/1-项目/ACProgram', 'docs-818');

const MAP = [
  // core
  ['src/engine/event-bus.ts','src/engine/core/event-bus.ts'],
  ['src/engine/entity-id.ts','src/engine/core/entity-id.ts'],
  ['src/engine/dev-log.ts','src/engine/core/dev-log.ts'],
  ['src/engine/display-name.ts','src/engine/core/display-name.ts'],
  ['src/engine/resource.ts','src/engine/core/resource.ts'],
  ['src/engine/tag.ts','src/engine/core/tag.ts'],
  ['src/engine/theme-runtime.ts','src/engine/core/theme-runtime.ts'],
  // expression
  ['src/engine/value-system.ts','src/engine/expression/value-system.ts'],
  ['src/engine/game-num.ts','src/engine/expression/game-num.ts'],
  ['src/engine/game-num-eval.ts','src/engine/expression/game-num-eval.ts'],
  ['src/engine/stat-dsl.ts','src/engine/expression/stat-dsl.ts'],
  ['src/engine/condition-system.ts','src/engine/expression/condition-system.ts'],
  ['src/engine/condition-deps.ts','src/engine/expression/condition-deps.ts'],
  ['src/engine/funclet-executor.ts','src/engine/expression/funclet-executor.ts'],
  // effect
  ['src/engine/effect-engine.ts','src/engine/effect/effect-engine.ts'],
  ['src/engine/trigger-system.ts','src/engine/effect/trigger-system.ts'],
  ['src/engine/affector-engine.ts','src/engine/effect/affector-engine.ts'],
  ['src/engine/affector-text.ts','src/engine/effect/affector-text.ts'],
  ['src/engine/event-driven-reactor.ts','src/engine/effect/event-driven-reactor.ts'],
  // extra
  ['src/engine/extra.ts','src/engine/extra/index.ts'],
  ['src/engine/extra-core.ts','src/engine/extra/extra-core.ts'],
  ['src/engine/extra-construct.ts','src/engine/extra/extra-construct.ts'],
  ['src/engine/extra-path.ts','src/engine/extra/extra-path.ts'],
  ['src/engine/extra-merge.ts','src/engine/extra/extra-merge.ts'],
  ['src/engine/extra-read.ts','src/engine/extra/extra-read.ts'],
  ['src/engine/extra-validate.ts','src/engine/extra/extra-validate.ts'],
  // visibility
  ['src/engine/visibility-engine.ts','src/engine/visibility/visibility-engine.ts'],
  ['src/engine/visibility-index.ts','src/engine/visibility/visibility-index.ts'],
  ['src/engine/visibility-eval.ts','src/engine/visibility/visibility-eval.ts'],
  ['src/engine/reveal.ts','src/engine/visibility/reveal.ts'],
  // system
  ['src/engine/state-mutation-service.ts','src/engine/system/state-mutation-service.ts'],
  ['src/engine/character-system.ts','src/engine/system/character-system.ts'],
  ['src/engine/character-availability.ts','src/engine/system/character-availability.ts'],
  ['src/engine/roster-system.ts','src/engine/system/roster-system.ts'],
  ['src/engine/color-system.ts','src/engine/system/color-system.ts'],
  ['src/engine/spot-functionality.ts','src/engine/system/spot-functionality.ts'],
  ['src/engine/loot-system.ts','src/engine/system/loot-system.ts'],
  ['src/engine/gacha-service.ts','src/engine/system/gacha-service.ts'],
  ['src/engine/passive-pool-system.ts','src/engine/system/passive-pool-system.ts'],
  ['src/engine/cultivate-system.ts','src/engine/system/cultivate-system.ts'],
  ['src/engine/tick-system.ts','src/engine/system/tick-system.ts'],
  // registry
  ['src/engine/registry.ts','src/engine/registry/registry.ts'],
  ['src/engine/registry-validate.ts','src/engine/registry/registry-validate.ts'],
  // stats
  ['src/engine/stats.ts','src/engine/stats/stats.ts'],
  ['src/engine/stats-counters.ts','src/engine/stats/stats-counters.ts'],
  ['src/engine/tag-stats.ts','src/engine/stats/tag-stats.ts'],
  ['src/engine/world-tilt.ts','src/engine/stats/world-tilt.ts'],
];

// 确保长路径先替换（extra.ts 不能先于 extra-core.ts 之类被误伤；按长度降序稳妥）
MAP.sort((a, b) => b[0].length - a[0].length);

for (const name of readdirSync(dir)) {
  if (!name.endsWith('.md')) continue;
  const file = join(dir, name);
  let src = readFileSync(file, 'utf8');
  const before = src;
  for (const [from, to] of MAP) {
    src = src.split(from).join(to);
  }
  if (src !== before) {
    writeFileSync(file, src);
    console.log('DOC ' + name);
  }
}
console.log('done');
