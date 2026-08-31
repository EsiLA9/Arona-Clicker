import { baseDatapack } from '../data/index';
import { GameInstance } from '../engine/game-instance';
import { UIController } from './controller';
// 样式按原 styles.css 分区拆分（variables 必须最先引入，其顶部 @import 为远程字体）
import './css/variables.css';
import './css/layout.css';
import './css/story-nav.css';
import './css/chat.css';
import './css/chat-input.css';
import './css/cards.css';
import './css/toast.css';
import './css/selectors.css';
import './css/popover.css';
import './css/modal.css';
import './css/codex.css';
import './css/contacts.css';
import './css/theme-panel.css';
import './css/entity-theme.css';
import './css/conversation.css';
import './css/story-overlays.css';
import './css/equipment.css';

const game = new GameInstance();
game.init([baseDatapack]);

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('UI root is missing');

const controller = new UIController(game, root);
controller.mount();

if (typeof window !== 'undefined') {
  (window as Window & { __game?: GameInstance; __ui?: UIController }).__game = game;
  (window as Window & { __game?: GameInstance; __ui?: UIController }).__ui = controller;
}
