// ============================================================
// ui/player.ts — 玩家（老师）聊天身份
//
// 聊天流中"玩家发出的回复气泡"的身份单一来源。当前固定为"老师"；
// 后续 story editor 迁移时改为数据驱动（按故事/按作者可覆盖），
// 本模块提供可替换的身份宿主，UI 与引擎不再内联"老师"字样。
// ============================================================

export interface PlayerIdentity {
  /** 玩家回复气泡的说话人。 */
  speaker: string;
  /** 玩家回复是否为右侧（player）气泡。 */
  isPlayer: boolean;
}

/** 当前玩家身份。改这里即可全局调整，避免 controller 内联硬编码。 */
export const PLAYER_IDENTITY: PlayerIdentity = {
  speaker: '老师',
  isPlayer: true,
};