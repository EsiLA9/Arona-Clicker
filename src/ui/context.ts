import { SaveSystem } from '../save/storage';
import { GameInstance } from '../engine/game-instance';
import { GameView, PlayerState } from '../engine/types';
import type { StoryView } from '../engine/types/results';
import type { DevLogEntry } from '../engine/core/dev-log';
import type { Registry } from '../engine/registry/registry';
import type { ValueSystem } from '../engine/expression/value-system';
import type { ConditionSystem } from '../engine/expression/condition-system';
import type { GameNumSystem } from '../engine/expression/game-num';
import type { AffectorEngine } from '../engine/effect/affector-engine';
import type { CharacterSystem } from '../engine/system/character-system';
import type { RosterSystem } from '../engine/system/roster-system';
import type { CharacterAvailabilityService } from '../engine/system/character-availability';
import type { ColorSystem } from '../engine/system/color-system';
import type { ColorEquipmentSystem } from '../engine/system/color-equipment-system';
import type { GachaService } from '../engine/system/gacha-service';
import type { SpotFunctionalitySystem } from '../engine/system/spot-functionality';
import type { StatsService } from '../engine/stats/stats';
import type { CharaProfileService } from '../engine/system/chara-profile-service';
import type { PicService } from '../engine/system/pic-service';
import type { StoryService } from '../engine/game/story-service';
import type { SpotService } from '../engine/game/spot-service';
import { displayName } from '../engine/core/display-name';

/**
 * 组件层可见的游戏只读门面：仅暴露渲染所需的状态读取与查询系统，
 * 不含写入口（mutations / 各命令门面 / 生命周期 / 存档）。
 * 写操作一律由 controller 层经完整 GameInstance 发起（架构纪律 #4）。
 */
export interface UIFacingGame {
  /** 只读状态（渲染数据源；全部消费走各系统只读查询）。 */
  readonly state: Readonly<PlayerState>;
  readonly registry: Registry;
  readonly valueSystem: ValueSystem;
  readonly conditionSystem: ConditionSystem;
  readonly gameNumSystem: GameNumSystem;
  readonly affectorEngine: AffectorEngine;
  readonly characterSystem: CharacterSystem;
  readonly rosterSystem: RosterSystem;
  readonly availabilityService: CharacterAvailabilityService;
  readonly colorSystem: ColorSystem;
  readonly colorEquipmentSystem: ColorEquipmentSystem;
  readonly gachaService: GachaService;
  readonly spotFunctionalitySystem: SpotFunctionalitySystem;
  readonly statsService: StatsService;
  readonly charaProfiles: CharaProfileService;
  readonly pics: PicService;
  /** 剧情只读查询（getSendState / getCurrentStoryView）。 */
  readonly story: StoryService;
  /** 设施只读查询（getEffectiveMaxLevel / getSpotYield 等）。 */
  readonly spot: SpotService;
  /** 指定聊天沙盒的当前剧情视图。 */
  getStoryView(owner: string): StoryView | null;
  getDevLogs(): readonly DevLogEntry[];
}

export interface UIContext {
  game: UIFacingGame;
  view: GameView;
  saveExists: boolean;
  formatNumber(value: number): string;
  escapeHtml(value: string): string;
  formatTime(timestamp: number): string;
  /** 将实体 ID 转为人类可读显示名。 */
  nameOf(type: string, id: string): string;
}

const formatNumber = (value: number) => Math.floor(value).toLocaleString('en-US');

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('zh-CN', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

export function createUIContext(game: GameInstance): UIContext {
  return {
    game,
    view: game.getView(),
    saveExists: SaveSystem.exists(),
    formatNumber,
    escapeHtml,
    formatTime,
    nameOf: (type, id) => displayName(game.registry, type, id),
  };
}
