import { SaveSystem } from '../save/storage';
import { GameInstance } from '../engine/game-instance';
import { GameView } from '../engine/types';
import { displayName } from '../engine/display-name';

export interface UIContext {
  game: GameInstance;
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
