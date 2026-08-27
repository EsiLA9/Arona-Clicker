// ============================================================
// ui/components/collection-modal.ts — 图鉴弹窗（含收集类型 Switch）
//
// 汇总"被动闲聊收集"与"色彩收集"两个子面板，顶部用 Switch
// 在两类之间切换。内容体由 controller 的弹窗按钮打开。
// 弹窗挂载于 body（ModalManager），Tooltip 由 PopoverManager
// 事件委托处理，切换重渲染不影响悬停详情。
// ============================================================

import { GameInstance } from '../../engine/game-instance';
import { createUIContext, type UIContext } from '../context';
import type { ModalManager } from '../modal';
import { renderCollectionBody, renderColorCodex, renderEquipmentCodex } from './collection';

/** 图鉴弹窗的收集类型。 */
export type CollectionTab = 'stories' | 'colors' | 'equipments';

const TABS: { id: CollectionTab; label: string }[] = [
  { id: 'stories', label: '闲聊收集' },
  { id: 'colors', label: '色彩收集' },
  { id: 'equipments', label: '装备图鉴' },
];

/** Switch 头部：当前类型高亮。 */
function tabBar(tab: CollectionTab): string {
  return `
    <div class="switch-tabs coll-switch">
      ${TABS.map(t => `
        <button class="switch-tab ${t.id === tab ? 'active' : ''}" data-collection-tab="${t.id}">${t.label}</button>
      `).join('')}
    </div>`;
}

/** 按当前类型渲染正文（含分区标题）。 */
function bodyHtml(ctx: UIContext, tab: CollectionTab): string {
  if (tab === 'colors') {
    return `
      <section class="codex-section">
        <h2 class="codex-section-title">色彩收集与管理</h2>
        <p class="codex-section-hint">每份配色都是一件可装备的「主题皮肤」：解锁后可在顶栏色彩面板切换。</p>
        ${renderColorCodex(ctx)}
      </section>`;
  }
  if (tab === 'equipments') {
    return `
      <section class="codex-section">
        <h2 class="codex-section-title">色彩装备图鉴</h2>
        <p class="codex-section-hint">装备捆绑头像视觉 + 数值效用，可装备到学生身上。</p>
        ${renderEquipmentCodex(ctx)}
      </section>`;
  }
  return `
    <section class="codex-section">
      <h2 class="codex-section-title">被动闲聊收集</h2>
      <p class="codex-section-hint">按闲聊池归类你触发过的被动剧情，打勾表示已收集。</p>
      ${renderCollectionBody(ctx)}
    </section>`;
}

/** 组装整个弹窗内容体：Switch + 正文容器。 */
export function renderCollectionModalBody(ctx: UIContext, tab: CollectionTab): string {
  return `${tabBar(tab)}<div class="collection-body">${bodyHtml(ctx, tab)}</div>`;
}

/**
 * 打开图鉴弹窗：顶部 Switch 切换收集类型，正文原位替换（不重开弹窗）。
 */
export function openCollectionModal(modal: ModalManager, game: GameInstance): void {
  const render = (tab: CollectionTab) => {
    const ctx = createUIContext(game);
    modal.open({
      title: '图鉴 · 收集',
      body: renderCollectionModalBody(ctx, tab),
      width: 640,
    });
    bindSwitch(modal, game, render);
  };
  render('stories');
}

/** 绑定 Switch 按钮：切换后以目标类型重渲染弹窗内容。 */
function bindSwitch(
  modal: ModalManager,
  game: GameInstance,
  render: (tab: CollectionTab) => void,
): void {
  document.querySelectorAll<HTMLButtonElement>('[data-collection-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.collectionTab as CollectionTab | undefined;
      if (!tab) return;
      render(tab);
    });
  });
}
