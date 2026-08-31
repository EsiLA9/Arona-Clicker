// ============================================================
// ui/controller-core.ts — UI 控制器：刷新策略 / 生命周期
// 从 controller.ts 拆出：reveal 指纹与节流刷新 / refreshLight /
//   destroy / resetSessionPanel / 聊天历史持久化
// ============================================================

import type { SaveData } from '../engine/game-instance';
import { Resource } from '../engine/types';
import { createUIContext } from './context';
import type { ChatEntry } from './components/story';

/** 每个聊天沙盒（含一般聊天）持久化的历史条数上限。 */
export const MAX_CHAT_HISTORY = 60;
import {
  getSpotReveal,
  getEnhancementReveal,
  getInitReveal,
  getAreaReveal,
  getStoryReveal,
} from './components/tooltip';
import type { UIController } from './controller';

/** 揭示状态指纹：计算全部实体（Spot / Enhancement / Init / Area / Story）的当前揭示级别。 */
export function computeRevealFingerprint(ctrl: UIController): string {
  const ctx = createUIContext(ctrl.game);
  let fp = '';
  for (const spot of ctrl.game.registry.spots.values()) {
    const r = getSpotReveal(ctx, spot);
    fp += `${spot.id}:${r.stage}:${r.nameKnown}${r.conditionKnown}${r.utilityKnown};`;
  }
  for (const enh of ctrl.game.registry.enhancements.values()) {
    fp += `${enh.id}:${getEnhancementReveal(ctx, enh).stage};`;
  }
  for (const init of ctrl.game.registry.inits.values()) {
    fp += `i:${init.id}:${getInitReveal(ctx, init).stage};`;
  }
  for (const area of ctrl.game.registry.areas.values()) {
    fp += `a:${area.id}:${getAreaReveal(ctx, area).stage};`;
  }
  for (const entry of [...ctrl.game.registry.activeStories.values(), ...ctrl.game.registry.passiveStories.values()]) {
    fp += `s:${entry.id}:${getStoryReveal(ctx, entry).stage};`;
  }
  return fp;
}

/**
 * EventBus 事件驱动的揭示刷新：条件（资源/tag/flag/统计等）变化后，
 * 重算揭示指纹，与上次不同才重建 UI（无需玩家交互）。
 */
export function refreshRevealIfChanged(ctrl: UIController): void {
  if (!ctrl.started) return;
  const now = Date.now();
  if (now - ctrl.lastRevealCheck < 200) return; // 节流：tick 内多次事件只评估一次
  ctrl.lastRevealCheck = now;
  const fp = computeRevealFingerprint(ctrl);
  if (fp !== ctrl.revealFingerprint) {
    ctrl.revealFingerprint = fp;
    ctrl.render();
  }
}

/**
 * 轻量刷新：每 Tick 只更新资源数字节点，不重建 #app DOM。
 * 这样聊天流等区域的滚动位置与交互不受 Tick 干扰。
 */
export function refreshLight(ctrl: UIController): void {
  // 兜底：奖励/移动通知排队后若没有后续全量 render，由下一 Tick 补一次
  if (ctrl.pendingRewardChats.length > 0 || ctrl.pendingTravelChats.length > 0) {
    ctrl.render();
    return;
  }
  const view = ctrl.game.getView();
  const set = (res: string, value: number) => {
    const el = ctrl.root.querySelector<HTMLElement>(`[data-resource="${res}"]`);
    if (el) el.textContent = Math.floor(value).toLocaleString('en-US');
  };
  const setGain = (res: string) => {
    const el = ctrl.root.querySelector<HTMLElement>(`[data-gain="${res}"]`);
    if (el) {
      // 与 header.ts renderResourceStrip 的初始风格保持一致（+N/t），
      // 否则全量 render 与每 Tick 轻量刷新会来回改写两种风格造成跳变
      el.textContent = `+${Math.floor(ctrl.game.gameNumSystem.evaluateResourceGain(res, ctrl.game.state)).toLocaleString('en-US')}/t`;
    }
  };
  // Spot 产出实时刷新（最终值：含倍率与功能 Affector）
  ctrl.root.querySelectorAll<HTMLElement>('[data-spot-yield]').forEach(el => {
    const spotId = el.dataset.spotYield!;
    const yieldValue = Math.floor(ctrl.game.gameNumSystem.evaluateSpotYield(spotId, ctrl.game.state));
    el.textContent = `产出 ${yieldValue.toLocaleString('en-US')} / tick`;
  });
  set('frame', view.totalFrames);
  set(Resource.Credit, view.resources[Resource.Credit] ?? 0);
  set(Resource.Pyroxene, view.resources[Resource.Pyroxene] ?? 0);
  setGain(Resource.Credit);
  setGain(Resource.Pyroxene);
}

/** 销毁：停止定时刷新。 */
export function destroy(ctrl: UIController): void {
  if (ctrl.refreshTimer !== null) clearInterval(ctrl.refreshTimer);
  ctrl.refreshTimer = null;
}

/**
 * 重置会话 UI：三种进入世界线的方式（新游戏 / 保存式重启 / 不保存式重启 / 读档）
 * 都回到一致的默认页面（左=区域、中=聊天、右=Spot），聊天流清空。
 */
export function resetSessionPanel(ctrl: UIController): void {
  ctrl.panelState.leftTab = 'area';
  ctrl.panelState.centerTab = 'chat';
  ctrl.panelState.rightTab = 'spot';
  ctrl.panelState.chatEntries = [];
  ctrl.panelState.chatTexts = [];
  // 彻底重置会话级 UI 状态：退出对话空间、清空选中差分与各学生聊天流，
  // 避免新游戏 / 读档后残留上一会话的角色聊天记录或对话空间视图。
  ctrl.panelState.conversationVariantId = null;
  ctrl.panelState.selectedVariantId = null;
  ctrl.panelState.studentChats = {};
  ctrl.panelState.studentChatTexts = {};
  ctrl.chat.reset();
  ctrl.scroll.reset();
}

/** 截断聊天历史到上限（保留最近 N 条）。 */
export function trimHistory(ctrl: UIController, entries: ChatEntry[]): ChatEntry[] {
  const n = MAX_CHAT_HISTORY;
  return entries.length > n ? entries.slice(entries.length - n) : entries;
}

/** 保存前：把各聊天沙盒 + 一般聊天历史（限 N 条）写入 SaveData（typing 瞬态条目不入档）。 */
export function withHistories(ctrl: UIController, data: SaveData): SaveData {
  const histories: Record<string, unknown[]> = {};
  for (const [variantId, entries] of Object.entries(ctrl.panelState.studentChats)) {
    histories[`variant:${variantId}`] = trimHistory(ctrl, persistableEntries(entries));
  }
  histories['global'] = trimHistory(ctrl, persistableEntries(ctrl.panelState.chatEntries));
  return { ...data, chatHistories: histories };
}

/** 页级打字提示（§4）是瞬态条目：不持久化，读档后由剧情同步重新压入。 */
function persistableEntries(entries: ChatEntry[]): ChatEntry[] {
  return entries.filter(e => e.kind !== 'typing');
}

/** 读档后：把持久化的聊天历史恢复到各沙盒（需在 resetSessionPanel 清空之后调用）。 */
export function restoreHistories(ctrl: UIController, data: SaveData): void {
  const histories = data.chatHistories;
  if (!histories) return;
  ctrl.panelState.studentChats = {};
  for (const [key, entries] of Object.entries(histories)) {
    if (!key.startsWith('variant:')) continue;
    const variantId = key.slice('variant:'.length);
    ctrl.panelState.studentChats[variantId] = entries as ChatEntry[];
  }
  // 一般聊天历史（非沙盒）仅在有沙盒占用时作为回退保留，恢复后并入 chatEntries
  const globalEntries = histories['global'];
  if (globalEntries && ctrl.panelState.chatEntries.length === 0) {
    ctrl.panelState.chatEntries = globalEntries as ChatEntry[];
  }
}
