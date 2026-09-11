import { UIController } from './controller';
import type { AronaClickerRuntime } from '../arona-clicker/runtime';
import { IndexedDbPackSnapshotStore } from '../data-services';
import { createAppRuntime, loadDefaultDatapack } from '../app/runtime-bootstrap';
import './service-definitions';
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
import './css/gear.css';
import './css/background.css';

const game = createAppRuntime();
const packStore = new IndexedDbPackSnapshotStore();

async function boot(): Promise<void> {
  try {
    await game.restorePackManager(packStore);
  } catch (error) {
    console.warn('[PackManager] 包库恢复失败，将继续使用当前会话：', error);
  }
  loadDefaultDatapack(game);

  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) throw new Error('UI root is missing');

  const controller = new UIController(game, root);
  controller.mount();

  if (typeof window !== 'undefined') {
    (window as Window & { __game?: AronaClickerRuntime; __ui?: UIController }).__game = game;
    (window as Window & { __game?: AronaClickerRuntime; __ui?: UIController }).__ui = controller;
  }
}

void boot();
