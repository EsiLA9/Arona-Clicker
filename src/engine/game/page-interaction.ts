// ============================================================
// engine/game/page-interaction.ts — Talklet 交互/回显 纯谓词
//
// 收敛「一个页面是否要求玩家交互」「推进时是否把 sendText 回显为
// 玩家回复」的判定，供 story-service 的 getSendState / clickSend
// 等环节共用，避免在多个函数里重复推导同一套交互规则。
// ============================================================

import type { Talklet } from '../types';

/**
 * 该 Talklet 是否要求玩家主动交互（点击/选项/work）才能推进。
 * 注意：引擎读取已统一为"逐页点击推进"（不再自动吸收纯展示页），
 * 本谓词保留用于交互语义判断与单元测试（区分"纯展示"与"含操作点"的页面）。
 */
export function isInteractivePage(page: Talklet): boolean {
  return (
    page.kind === 'click' ||
    (page.choices ?? []).length > 0 ||
    !!page.sendText ||
    !!page.clickWork
  );
}

/**
 * 推进该页时，是否应把 sendText 以「老师」气泡回显到聊天流。
 * click 页为纯按钮交互、恒不回显；其余页仅在存在回显文案且未设 muteReply 时回显。
 */
export function shouldEchoReply(page: Talklet): boolean {
  if (page.kind === 'click') return false;
  if (page.muteReply) return false;
  return !!page.sendText && page.sendText.trim().length > 0;
}

/** 根据 clickWork 的 base/rand roll 出本次要求的点击总次数。 */
export function rollClickWorkTotal(base: number, rand?: number): number {
  return base + (rand ? Math.floor(Math.random() * rand) : 0);
}