import type { AronaClickerRuntime } from '../arona-clicker/runtime/runtime';
import { runStartupPhase } from './startup/startup-phase';
import type { StartupLog, StartupServerTiming } from './startup/startup-phase';
import { describeStartupContent } from './startup/startup-content';

interface StartupShell {
  begin(id: string, label: string, detail?: string): void;
  update(label: string, detail?: string): void;
  complete(id: string): void;
  work(id: string): void;
  warn(message: string, detail?: string): void;
  fail(phase: string, error: unknown): void;
  finish(): void;
}

declare global {
  interface Window {
    __startupShell?: StartupShell;
    __startupLog?: StartupLog;
    __game?: AronaClickerRuntime;
    __ui?: import('./controller/controller').UIController;
  }
}

let activePhase = '加载游戏模块';

function setStartupStatus(id: string, message: string): void {
  activePhase = message;
  window.__startupShell?.begin(id, message);
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function runPhase<T>(id: string, message: string, work: () => T | Promise<T>, detail?: string): Promise<T> {
  activePhase = message;
  return runStartupPhase(window.__startupShell, id, message, nextPaint, async () => {
    const startedAt = performance.now();
    try {
      const result = await work();
      const duration = performance.now() - startedAt;
      if (import.meta.env.DEV) console.info(`[StartupTiming] ${id} ${duration.toFixed(1)} ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - startedAt;
      if (import.meta.env.DEV) console.info(`[StartupTiming] ${id} failed after ${duration.toFixed(1)} ms`);
      throw error;
    }
  }, detail);
}

async function boot(): Promise<void> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('areaMapDemo') === '1') {
    try {
      setStartupStatus('demo', '正在准备地图演示…');
      await nextPaint();
      window.__startupShell?.work('demo');
      const root = document.querySelector<HTMLDivElement>('#app');
      if (!root) throw new Error('UI root is missing');
      const { mountAreaMapDemo } = await import('./development/area-map-demo');
      await mountAreaMapDemo(root);
      await nextPaint();
      document.querySelector('#startup-shell')?.remove();
      window.__startupShell?.finish();
    } catch (error) {
      console.error(error);
      window.__startupShell?.fail(activePhase, error);
    }
    return;
  }

  try {
    const [
      runtimeBootstrap,
      dataServices,
      developmentLoader,
    ] = await runPhase('modules', '正在装载游戏模块…', async () => {
      let completed = 0;
      let total = 0;
      const log = window.__startupLog;
      const track = <T>(label: string, loading: Promise<T>): Promise<T> => {
        log?.taskBegin(label);
        return loading.then(module => {
          log?.taskEnd(label);
          completed += 1;
          window.__startupShell?.update(`正在装载游戏模块（${completed}/${total} 项就绪）…`);
          return module;
        }, error => {
          log?.taskEnd(label, error);
          window.__startupShell?.update('游戏模块装载失败', `无法装载：${label}`);
          throw error;
        });
      };
      const loads = [
        track('游戏运行环境与内置内容', import('../app/runtime-bootstrap')),
        track('数据服务', import('../data-services')),
        track('开发包读取器', import('./development/development-datapack-loader')),
        track('游戏服务配置', import('./runtime/service-definitions')),
        track('游戏界面样式', import('./css/game.css')),
      ] as const;
      total = loads.length;
      const hot = import.meta.hot;
      const receiveServerTiming = (sample: StartupServerTiming): void => log?.captureServerTiming(sample);
      if (hot && log) {
        hot.on('ac:startup-timing', receiveServerTiming);
        log.requestServerTiming = () => hot.send('ac:startup-timing');
      }
      try {
        const [bootstrap, services, loader] = await Promise.all(loads);
        return [bootstrap, services, loader] as const;
      } finally {
        if (hot && log) {
          hot.off('ac:startup-timing', receiveServerTiming);
          delete log.requestServerTiming;
        }
      }
    }, '读取游戏运行环境、内置内容、数据服务与各界面样式。');

    const game = await runPhase('runtime', '正在创建游戏运行环境…', () => runtimeBootstrap.createAppRuntime(),
      '创建游戏服务与数据包管理器，登记内置 Base 和玩法 B 内容。');
    const packStore = new dataServices.IndexedDbPackSnapshotStore();
    const contentDetails = (): string => {
      const enabled = new Set(game.packManager.configuration().enabledIds);
      return describeStartupContent(game.packManager.listPacks().filter(pack => enabled.has(pack.id)).map(pack => pack.datapack));
    };

    try {
      await runPhase('pack-library', '正在恢复本机数据包…', async () => {
        await game.restorePackManager(packStore);
        window.__startupShell?.update('本机数据包已恢复', `包库内共有 ${game.packManager.listPacks().length} 个包。\n${contentDetails()}`);
      }, '读取浏览器中的本机数据包、包顺序与启用选择。');
    } catch (error) {
      const detail = error instanceof Error ? error.stack || error.message : String(error);
      console.warn('[PackManager] 包库恢复失败，将继续使用当前会话：', error);
      window.__startupShell?.warn('本机数据包恢复失败，继续使用当前会话。', detail);
    }

    const developmentPacks = await runPhase('development-packs', '正在检查开发数据包…', () =>
      developmentLoader.discoverBundledDevelopmentDatapacks(progress => {
        const details = progress.currentPackage
          ? [
            `当前数据包：${progress.currentPackage}`,
            `${progress.stage === 'reading' ? '正在读取' : '正在解析'}：${progress.currentFile ?? progress.currentPackage}`,
            ...(progress.fileCount === undefined ? [] : [`已读取 ${progress.filesRead ?? 0} 个文件 · 目录内共 ${progress.fileCount} 个文件`]),
          ].join('\n')
          : progress.total === 0 ? '未发现开发数据包，继续使用本机与内置内容。' : `已检查全部 ${progress.total} 个开发数据包。`;
        window.__startupShell?.update(`正在检查开发数据包（${progress.completed}/${progress.total} 个已处理）…`, details);
      }), '扫描开发数据包目录与 ZIP；逐包读取清单、内容及图片文件。');

    await runPhase('development-reconcile', '正在登记开发数据包…', () => {
      game.reconcileDevelopmentPacks(developmentPacks.packs);
      for (const issue of developmentPacks.issues) {
        const message = `[Development Datapack] ${issue.sourcePath}: ${issue.message}`;
        console.warn(message);
        game.devLog.record(message, { source: 'datapack', level: 'error' });
      }
      if (developmentPacks.issues.length > 0) {
        window.__startupShell?.warn(
          `${developmentPacks.issues.length} 个开发数据包无法读取，游戏将继续启动。`,
          developmentPacks.issues.map(issue => `${issue.sourcePath}: ${issue.message}`).join('\n'),
        );
      }
    }, `可登记 ${developmentPacks.packs.length} 个开发数据包；发现 ${developmentPacks.issues.length} 项读取问题。\n${developmentPacks.packs.map(pack => `${pack.manifest.name} @ ${pack.manifest.version} · ${pack.sourcePath}`).join('\n')}`);

    const gameplayBQuickTestConsoleEnabled = import.meta.env.DEV
      && new URLSearchParams(window.location.search).get('devConsole') === 'gameplay-b';

    const root = document.querySelector<HTMLDivElement>('#app');
    if (!root) throw new Error('UI root is missing');

    await runPhase('content-apply', '正在校验并装载游戏内容…', () => runtimeBootstrap.loadDefaultDatapack(game),
      `${contentDetails()}\n正在校验定义与跨包引用，并构建游戏系统。`);

    const [{ UIController }, { loadSurfaceStyles }] = await runPhase('ui-module', '正在装载界面模块…', () =>
      Promise.all([import('./controller/controller'), import('./utilities/surface-styles')]),
      '读取大厅、工作区、内容编辑与交互控制模块。');
    const controller = await runPhase('ui-mount', '正在准备游戏界面…', async () => {
      const instance = new UIController(game, root, loadSurfaceStyles);
      instance.mount();
      await nextPaint();
      return instance;
    }, `已完成游戏内容校验，正在挂载大厅与交互组件。\n${contentDetails()}\n等待首个画面显示后进入游戏。`);

    if (gameplayBQuickTestConsoleEnabled) {
      const [{ applyGameplayBQuickTestMapOperations, mountGameplayBQuickTestConsole }] = await Promise.all([
        import('./development/gameplay-b-quick-test-console'), loadSurfaceStyles('map'),
      ]);
      mountGameplayBQuickTestConsole(game, () => controller.render(), (mapId, operations) => {
        const run = controller.commands.startMap(mapId);
        controller.replaceWorkspaceRoute({ kind: 'map', runId: run.runId });
        const summary = applyGameplayBQuickTestMapOperations(game.mapRun, controller.commands, run.runId, operations);
        controller.render();
        return summary;
      }, () => {
        controller.resumeInit('base:init:schale_office');
        return game.state.activeInit === 'base:init:schale_office';
      });
      document.body.dataset.gameplayBQuickTest = 'map';
      document.title = `${document.title} · Gameplay B quick test`;
    }

    window.__game = game;
    window.__ui = controller;
    await nextPaint();
    document.querySelector('#startup-shell')?.remove();
    window.__startupShell?.finish();
  } catch (error) {
    console.error('[Startup] 游戏启动失败：', error);
    window.__startupShell?.fail(activePhase, error);
  }
}

void boot();
