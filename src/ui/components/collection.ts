// ============================================================
// ui/components/collection.ts — 被动闲聊收集图鉴（弹窗内容体）
//
// 按 Pool 划分 PassiveStoryEntry，树状呈现（子池缩进）；
// 已收集/未收集状态来自 storyLog（跨世界线全局层）；
// 池 gate 以「已解锁 / 未解锁」徽标实时求值展示。
// 条目行复用 hover-wrap + data-tooltip 机制悬停查看详情。
// ============================================================

import type { PassivePoolDef, PassiveStoryEntry } from '../../engine/types';
import type { UIContext } from '../context';

// --- 色彩收集图鉴 ---

function colorCard(ctx: UIContext, def: import('../../engine/types').ColorDef): string {
  const esc = ctx.escapeHtml;
  const owned = ctx.game.colorSystem.isOwned(ctx.game.state, def.id);
  const active = ctx.game.state.activeColor === def.id;
  const desc = ctx.game.colorSystem.describeColor(def);
  const statusBadge = active
    ? '<span class="coll-gate is-open">● 使用中</span>'
    : owned
      ? '<span class="coll-gate is-open">已拥有</span>'
      : '<span class="coll-gate is-locked">未解锁</span>';
  const sourceBadge = desc.autoConstructed
    ? '<span class="coll-gate codex-auto">自动构造</span>'
    : '<span class="coll-gate codex-defined">已被定义</span>';
  const tokens = desc.tokens.map(t => `
    <li class="codex-token ${t.source === 'derived' ? 'is-derived' : 'is-defined'}">
      <span class="codex-token-key">${esc(t.key)}</span>
      <span class="codex-token-val" style="--sample:${t.value}">${esc(t.value)}</span>
      <span class="codex-token-src">${t.source === 'derived' ? '衍生' : '定义'}</span>
    </li>`).join('');
  return `
    <article class="codex-color ${owned ? 'is-owned' : 'is-locked'} ${active ? 'is-active' : ''}">
      <header class="codex-color-head">
        <span class="codex-swatch" style="--swatch:${def.theme['primary'] ?? '#888'}"></span>
        <div class="codex-color-title">
          <h3>${esc(def.name)}</h3>
          <small class="codex-color-id">${esc(def.id)}</small>
        </div>
        <div class="codex-badges">${statusBadge}${sourceBadge}</div>
      </header>
      ${def.description ? `<p class="codex-color-desc">${esc(def.description)}</p>` : ''}
      <ul class="codex-token-list">${tokens}</ul>
    </article>`;
}

export function renderColorCodex(ctx: UIContext): string {
  const all = ctx.game.colorSystem.getAll();
  const ownedCount = all.filter(c => ctx.game.colorSystem.isOwned(ctx.game.state, c.id)).length;
  const definedCount = all.filter(c => !ctx.game.colorSystem.describeColor(c).autoConstructed).length;
  const cards = all.map(c => colorCard(ctx, c)).join('');
  const summary = `
    <div class="coll-summary">
      <span class="eyebrow">COLOR CODEX</span>
      <strong>${ownedCount} / ${all.length} 已收集 · ${definedCount} 已被定义</strong>
    </div>`;
  return `${summary}<div class="codex-grid">${cards}</div>`;
}

interface CollectedInfo {
  count: number;
}

function collectStats(ctx: UIContext): Map<string, CollectedInfo> {
  const stats = new Map<string, CollectedInfo>();
  for (const record of ctx.game.state.storyLog ?? []) {
    const info = stats.get(record.storyId) ?? { count: 0 };
    info.count += 1;
    stats.set(record.storyId, info);
  }
  return stats;
}

/** 池 gate 徽标：无条件=常开；有条件则实时求值展示。 */
function gateBadge(ctx: UIContext, pool: PassivePoolDef): string {
  if (!pool.condition) return '<span class="coll-gate is-open">无条件</span>';
  const ok = ctx.game.conditionSystem.evaluateExpr(pool.condition, ctx.game.state as never);
  return ok
    ? '<span class="coll-gate is-open">已解锁</span>'
    : '<span class="coll-gate is-locked">未解锁</span>';
}

function entryRow(ctx: UIContext, entry: PassiveStoryEntry, collected: Map<string, CollectedInfo>): string {
  const info = collected.get(entry.storyId);
  const done = (info?.count ?? 0) > 0;
  const name = ctx.nameOf('story', entry.storyId);
  const esc = ctx.escapeHtml;
  return `
    <div class="coll-entry hover-wrap ${done ? 'is-done' : 'is-missed'}" data-tooltip="passive:${esc(entry.id)}">
      <span class="coll-mark">${done ? '✓' : '✗'}</span>
      <span class="coll-name">${esc(name)}</span>
      <span class="coll-meta">w${entry.weight}</span>
      ${done ? `<span class="coll-count">×${info!.count}</span>` : '<span class="coll-count coll-new">未收集</span>'}
    </div>`;
}

/** 渲染单个池节点（含子池递归）。返回 false 表示该池在本次渲染中已被访问过（环防护剪枝）。 */
function renderPool(
  ctx: UIContext,
  pool: PassivePoolDef,
  depth: number,
  visited: Set<string>,
  referenced: Set<string>,
  collected: Map<string, CollectedInfo>,
): string {
  if (visited.has(pool.id)) return '';
  visited.add(pool.id);

  const directEntries: PassiveStoryEntry[] = [];
  const subPools: PassivePoolDef[] = [];
  for (const child of pool.children) {
    const sub = ctx.game.registry.passivePools.get(child.id);
    if (sub) subPools.push(sub);
    else {
      const entry = ctx.game.registry.passiveStories.get(child.id);
      if (entry) directEntries.push(entry);
    }
  }

  const doneCount = directEntries.filter(e => (collected.get(e.storyId)?.count ?? 0) > 0).length;
  const indent = depth * 14;

  return `
    <section class="coll-pool" style="margin-left:${indent}px">
      <header class="coll-pool-head hover-wrap" data-tooltip="pool:${ctx.escapeHtml(pool.id)}">
        <h3>${ctx.escapeHtml(pool.name ?? pool.id)}</h3>
        ${gateBadge(ctx, pool)}
        <span class="index">${doneCount}/${directEntries.length}</span>
      </header>
      <div class="coll-pool-body">
        ${directEntries.map(e => entryRow(ctx, e, collected)).join('')}
        ${subPools.map(sub => renderPool(ctx, sub, depth + 1, visited, referenced, collected)).join('')}
      </div>
    </section>`;
}

export function renderCollectionBody(ctx: UIContext): string {
  const collected = collectStats(ctx);
  const pools = [...ctx.game.registry.passivePools.values()];
  const entries = [...ctx.game.registry.passiveStories.values()];

  // 结构性引用集：被任何池引用的 entry 不再进入「未编组」
  const referenced = new Set<string>();
  const childPoolRefs = new Set<string>();
  for (const pool of pools) {
    for (const child of pool.children) {
      referenced.add(child.id);
      if (pools.some(p => p.id === child.id)) childPoolRefs.add(child.id);
    }
  }

  const visited = new Set<string>();
  const roots = pools.filter(p => !childPoolRefs.has(p.id));
  const treeHtml = roots.map(pool => renderPool(ctx, pool, 0, visited, referenced, collected)).join('');

  // 未被任何池编组的 entry → 默认根池分组
  const orphans = entries.filter(e => !referenced.has(e.id));
  const orphanHtml = orphans.length
    ? `
      <section class="coll-pool">
        <header class="coll-pool-head"><h3>默认池</h3><span class="coll-gate is-open">引擎自动归组</span><span class="index">${orphans.filter(e => (collected.get(e.storyId)?.count ?? 0) > 0).length}/${orphans.length}</span></header>
        <div class="coll-pool-body">${orphans.map(e => entryRow(ctx, e, collected)).join('')}</div>
      </section>`
    : '';

  const totalDone = entries.filter(e => (collected.get(e.storyId)?.count ?? 0) > 0).length;
  const summary = `<div class="coll-summary"><span class="eyebrow">COLLECTION PROGRESS</span><strong>${totalDone} / ${entries.length}</strong></div>`;

  return `${summary}<div class="coll-tree">${treeHtml}${orphanHtml || (pools.length ? '' : '')}</div>${
    pools.length === 0 ? '<p class="chat-empty">当前数据包未声明任何 Pool，全部闲聊按默认池平铺。</p>' : ''
  }`;
}
