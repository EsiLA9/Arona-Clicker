import { createAppRuntime } from '../../app/runtime-bootstrap';
import { defaultDatapack } from '../../arona-clicker/content/default-datapack';
import { CAROUSEL_SCENE_ACTION_IDS } from '../../arona-clicker/content/operation-samples/carousel-scene-action-slice';
import { gameplayBCarouselDatapack } from '../../arona-clicker/content/operation-samples/gameplay-b-datapack';
import { Character } from '../../arona-clicker/types/ids';
import { UIController } from '../controller';

const INSPECTOR_QUERY_KEY = 'gameplayBCardInspector';
const INSPECTOR_QUERY_VALUE = '1';
const FIXED_ROSTER = [
  { characterId: Character.Hoshino, variantId: 'Hoshino' },
  { characterId: Character.Serika, variantId: 'Serika' },
  { characterId: Character.Shiroko, variantId: 'Shiroko' },
] as const;

interface InspectorSession {
  readonly game: ReturnType<typeof createAppRuntime>;
  readonly controller: UIController;
  readonly overlay: HTMLElement;
}

export interface GameplayBCardInspectorMount {
  destroy(): void;
}

/** The card inspector is deliberately opt-in even in a development build. */
export function shouldMountGameplayBCardInspector(isDevelopmentBuild: boolean, search: string): boolean {
  return isDevelopmentBuild
    && new URLSearchParams(search).get(INSPECTOR_QUERY_KEY) === INSPECTOR_QUERY_VALUE;
}

/**
 * Mount an isolated in-memory copy of the official sample. The primary Runtime,
 * SaveData, and save controls are never passed to or replaced by this surface.
 */
export function mountGameplayBCardInspector(): GameplayBCardInspectorMount {
  const existing = document.querySelector<HTMLElement>('[data-gameplay-b-card-inspector]');
  if (existing) return { destroy: () => existing.remove() };

  const launcher = document.createElement('aside');
  launcher.dataset.gameplayBCardInspector = 'true';
  launcher.setAttribute('aria-label', 'Gameplay B 卡牌检查入口');
  launcher.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:1000',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'max-width:min(520px,calc(100vw - 32px))',
    'padding:10px 12px',
    'border:1px solid var(--border-color,#667085)',
    'border-radius:8px',
    'background:var(--panel-bg,#18202b)',
    'color:var(--text-color,#f5f7fa)',
    'box-shadow:0 4px 16px #0004',
  ].join(';');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary-button';
  button.textContent = '启动隔离的 Gameplay B 检查';

  const status = document.createElement('span');
  status.dataset.gameplayBCardInspectorStatus = 'true';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = '独立临时 Runtime · 不读写主存档';

  let session: InspectorSession | null = null;
  const closeSession = (): void => {
    if (!session) return;
    const current = session;
    session = null;
    current.controller.destroy();
    if (current.game.running) current.game.stop();
    current.overlay.remove();
    button.disabled = false;
    button.focus();
  };

  const destroy = (): void => {
    closeSession();
    launcher.remove();
  };

  button.addEventListener('click', () => {
    if (session) return;
    button.disabled = true;
    let game: ReturnType<typeof createAppRuntime> | null = null;
    let controller: UIController | null = null;
    let overlay: HTMLElement | null = null;
    try {
      // Load the same formal packs used by the Runtime sample and the fixed roster in existing acceptance tests.
      game = createAppRuntime();
      game.init([defaultDatapack, gameplayBCarouselDatapack], { enterDefaultInit: true });
      for (const student of FIXED_ROSTER) game.mutations.acquireCharacter(student.variantId, 'story');

      overlay = document.createElement('section');
      overlay.dataset.gameplayBCardInspectorSurface = 'true';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Gameplay B 卡牌检查 · 隔离运行时');
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:1100',
        'overflow:auto',
        'background:var(--canvas,#f3f5f7)',
      ].join(';');

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'toolbar-button';
      closeButton.dataset.gameplayBCardInspectorClose = 'true';
      closeButton.textContent = '退出检查';
      closeButton.style.cssText = 'position:fixed;top:8px;right:16px;z-index:1101';
      closeButton.addEventListener('click', closeSession);

      const surfaceRoot = document.createElement('div');
      surfaceRoot.dataset.gameplayBCardInspectorOperationRoot = 'true';
      surfaceRoot.style.cssText = 'min-height:100vh;color:var(--ink-on-canvas,#1e2a38)';
      overlay.append(closeButton, surfaceRoot);
      document.body.append(overlay);

      // Use a dedicated controller for the temporary Runtime; its Save navigation is removed below.
      controller = new UIController(game, surfaceRoot);
      controller.started = true;
      const run = game.operationEntry.start(
        CAROUSEL_SCENE_ACTION_IDS.event,
        FIXED_ROSTER.map(student => student.characterId),
      );
      controller.openOperationWorkspace(run.runId);
      controller.render();
      // The inspector needs the ordinary controller's live Operation flow, not its global Save UI.
      surfaceRoot.querySelector('.topbar')?.remove();
      surfaceRoot.querySelector('[data-operation-back]')?.remove();
      if (!surfaceRoot.querySelector('[data-workspace-frame="operation"]')) {
        throw new Error('Runtime did not render the newly started Gameplay B Operation Surface');
      }
      surfaceRoot.querySelector<HTMLElement>('[data-operation-commit]:not(:disabled)')?.focus({ preventScroll: true });

      overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSession();
        }
      });
      session = { game, controller, overlay };
      setInspectorStatus(status, `已启动隔离 Run ${run.runId}；刷新或退出检查会丢弃本次试玩。`);
    } catch (error) {
      controller?.destroy();
      if (game?.running) game.stop();
      overlay?.remove();
      button.disabled = false;
      const detail = error instanceof Error ? error.message : String(error);
      setInspectorStatus(status, `Gameplay B 检查启动失败：${detail}`);
    }
  });

  launcher.append(button, status);
  document.body.append(launcher);
  return { destroy };
}

function setInspectorStatus(status: HTMLElement, message: string): void {
  status.textContent = message;
}
