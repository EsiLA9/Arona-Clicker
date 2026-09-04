import { SaveSystem } from '../data-services/persistence/storage';
import type { GameView } from '../arona-clicker/contracts/view';
import type { GameReadModel } from '../arona-clicker/contracts';
import { displayName } from '../engine/core/display-name';
import type { BackgroundView } from './background-service';
import type { PresentationView } from './presentation-service';

/**
 * 组件层可见的游戏只读门面：仅暴露渲染所需的状态读取与查询系统，
 * 不含写入口（mutations / 各命令门面 / 生命周期 / 存档）。
 * 写操作一律由 controller 层经 GameCommands 发起（架构纪律 #4）。
 */
export interface UIContext {
  game: GameReadModel;
  world: GameReadModel['world'];
  view: GameView;
  saveExists: boolean;
  formatNumber(value: number): string;
  escapeHtml(value: string): string;
  formatTime(timestamp: number): string;
  /** 将实体 ID 转为人类可读显示名。 */
  nameOf(type: string, id: string): string;
  background: BackgroundView;
  presentation: PresentationView;
}

const formatNumber = (value: number) => Math.floor(value).toLocaleString('en-US');

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('zh-CN', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

const emptyPresentation: PresentationView = {
  region: () => ({ layers: [], components: [] }),
  panelOpacity: () => 0.8,
  asset: () => undefined,
  motion: () => undefined,
  stateAppearance: () => undefined,
};

export function createUIContext(game: GameReadModel, background?: BackgroundView, presentation?: PresentationView): UIContext {
  return {
    game,
    world: game.world,
    view: game.getView(),
    saveExists: SaveSystem.exists(),
    formatNumber,
    escapeHtml,
    formatTime,
    nameOf: (type, id) => displayName(game.registry, type, id),
    background: background ?? { layers: [] },
    presentation: presentation ?? emptyPresentation,
  };
}
