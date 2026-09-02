// ============================================================
// main.ts — 游戏入口
// ============================================================

import { SaveSystem } from './data-services/persistence/storage';
import { JsonPackSnapshotStore, LocalStorageAdapter } from './data-services';
import { DEFAULT_INIT_ID, createAppRuntime, loadDefaultDatapack } from './app/runtime-bootstrap';
import type { SaveData } from './arona-clicker/contracts/save-data';

// 创建游戏实例。开发模式下开启详细日志（verbose），便于排障导出。
const game = createAppRuntime({
  devLog: {
    verbose: import.meta.env.DEV,
    maxEntries: import.meta.env.DEV ? 20000 : undefined,
  },
  packStore: new JsonPackSnapshotStore(new LocalStorageAdapter()),
});

// 输出到全局以便调试
(window as any).__game = game;

// 启动流程
function boot(): void {
  console.log('=== AronaClicker Engine ===');

  // 加载数据包
  loadDefaultDatapack(game);
  console.log('[Boot] Datapacks loaded');

  // 尝试加载存档
  const saved = SaveSystem.load<SaveData>();
  if (saved) {
    game.load(saved);
    console.log('[Boot] Save loaded, resuming...');
  } else {
    // 新存档：解锁默认 Init
    game.inits.unlockInit(DEFAULT_INIT_ID);
    console.log('[Boot] New game started');
  }

  // 启动引擎
  game.start();

  // 注册页面关闭时自动存档
  window.addEventListener('beforeunload', () => {
    game.stop();
    SaveSystem.save(game.save());
  });

  console.log('[Boot] Engine running...');
  console.log('[Boot] Use window.__game to interact with the game instance');
  console.log('[Boot] Resources:', game.state.resources);
}

// DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
