import { GameInstance } from '../../arona-clicker/runtime/runtime-game-instance';
import { SaveSystem } from '../../data-services/persistence/storage';
import { UIController } from '../controller/controller';
import { bindEvents } from '../controller/controller-events';
import { loadAreaMapDemoPack } from './area-map-demo-pack';

/** Dedicated development session: ordinary saved games are neither read nor written. */
export async function mountAreaMapDemo(root: HTMLElement): Promise<void> {
  let memory: unknown = null;
  SaveSystem.save = data => { memory = structuredClone(data); return true; };
  SaveSystem.load = <T>() => memory === null ? null : structuredClone(memory) as T;
  SaveSystem.exists = () => memory !== null;
  SaveSystem.delete = () => { memory = null; };
  SaveSystem.export = () => memory === null ? null : JSON.stringify(memory);
  SaveSystem.import = json => { try { memory = JSON.parse(json); return true; } catch { return false; } };
  const parsed = await loadAreaMapDemoPack();
  const game = new GameInstance(); game.init([parsed.datapack]);
  const controller = new UIController(game, root);
  controller.started = true;
  bindEvents(controller); controller.render();
  game.start();
  const timer = setInterval(() => controller.refreshLight(), 500);
  // Keep the in-memory storage adapter for this document, including browser back-cache restores.
  const dispose = () => { clearInterval(timer); controller.destroy(); game.dispose(); };
  window.addEventListener('pagehide', dispose, { once: true });
  Object.assign(window, { __game: game, __ui: controller });
  document.title = '区域地图演示 · 临时会话';
}
