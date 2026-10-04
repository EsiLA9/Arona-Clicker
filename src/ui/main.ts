import { UIController } from './controller';
import type { AronaClickerRuntime } from '../arona-clicker/runtime';
import { IndexedDbPackSnapshotStore } from '../data-services';
import { createAppRuntime, loadDefaultDatapack } from '../app/runtime-bootstrap';
import { discoverBundledDevelopmentDatapacks } from './development-datapack-loader';
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
import './css/runtime-editor.css';
import './css/codex.css';
import './css/contacts.css';
import './css/theme-panel.css';
import './css/entity-theme.css';
import './css/conversation.css';
import './css/operation-workspace.css';
import './css/story-overlays.css';
import './css/equipment.css';
import './css/gear.css';
import './css/background.css';

const game = createAppRuntime();
const packStore = new IndexedDbPackSnapshotStore();

function setStartupStatus(message: string, state: 'loading' | 'error' = 'loading'): void {
  const shell = document.querySelector<HTMLElement>('#startup-shell');
  const status = document.querySelector<HTMLElement>('#startup-status');
  if (!shell || !status) return;
  shell.dataset.state = state;
  status.textContent = message;
  status.setAttribute('aria-busy', String(state === 'loading'));
}

async function boot(): Promise<void> {
  try {
    setStartupStatus('正在恢复本机数据包…');
    await game.restorePackManager(packStore);
  } catch (error) {
    console.warn('[PackManager] 包库恢复失败，将继续使用当前会话：', error);
  }
  try {
    setStartupStatus('正在检查开发数据包…');
    const developmentPacks = await discoverBundledDevelopmentDatapacks();
    game.reconcileDevelopmentPacks(developmentPacks.packs);
    for (const issue of developmentPacks.issues) {
      const message = `[Development Datapack] ${issue.sourcePath}: ${issue.message}`;
      console.warn(message);
      game.devLog.record(message, { source: 'datapack', level: 'error' });
    }
    setStartupStatus('正在装载游戏内容…');
    loadDefaultDatapack(game);

    const gameplayBQuickTestConsoleEnabled = import.meta.env.DEV
      && new URLSearchParams(window.location.search).get('devConsole') === 'gameplay-b';
    if (gameplayBQuickTestConsoleEnabled) {
      const { mountGameplayBQuickTestConsole } = await import('./development/gameplay-b-quick-test-console');
      mountGameplayBQuickTestConsole(game);
      document.body.dataset.gameplayBQuickTest = 'carousel-safety';
      document.title = `${document.title} · Gameplay B quick test`;
    }

    const root = document.querySelector<HTMLDivElement>('#app');
    if (!root) throw new Error('UI root is missing');

    setStartupStatus('正在准备游戏界面…');
    const controller = new UIController(game, root);
    controller.mount();
    document.querySelector('#startup-shell')?.remove();

    if (typeof window !== 'undefined') {
      (window as Window & { __game?: AronaClickerRuntime; __ui?: UIController }).__game = game;
      (window as Window & { __game?: AronaClickerRuntime; __ui?: UIController }).__ui = controller;
    }
  } catch (error) {
    console.error('[Startup] 游戏启动失败：', error);
    setStartupStatus('游戏启动失败，请刷新页面重试。', 'error');
  }
}

void boot();
