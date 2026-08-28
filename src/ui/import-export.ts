// ============================================================
// ui/import-export.ts — 数据包导入 / 日志导出
// 疏散自 controller.ts：把两个自包含的 IO 操作收拢到这里。
// ============================================================

import { GameInstance } from '../engine/game-instance';
import { SaveSystem } from '../save/storage';
import { loadDatapackFromZipFile } from '../data/zip-loader';
import type { ToastService } from './components/toast';

/** controller 暴露给 IO 服务的回调（避免反向依赖 controller）。 */
export interface ImportExportHost {
  game: GameInstance;
  toast: ToastService;
  /** 会话重置为默认页面（新游戏/读档后调用）。 */
  resetSessionPanel(): void;
  /** 会话开始标记（导入成功后置 true）。 */
  setStarted(): void;
  /** 清除待重启标记（导入成功后清 false）。 */
  clearPendingRestart(): void;
  /** 全量重建 UI。 */
  render(): void;
}

/** 数据包导入 / 日志导出服务。 */
export class ImportExportService {
  constructor(private readonly host: ImportExportHost) {}

  /**
   * 导入 Mod 压缩包：用户选择 .zip 后遍历其中所有 .json 文件构造 Datapack，
   * 运行时整体替换数据包（reload）并进入新会话。
   */
  importDatapack(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip,application/x-zip-compressed';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const { game, toast } = this.host;
      try {
        const { datapack, jsonFileCount, ignoredCount, images } = await loadDatapackFromZipFile(file);
        // 新 Mod 整体替换：先清空旧图片存储，再登记压缩包解出的图片，最后 reload
        game.imageStore.clear();
        game.pics.register(datapack.name, images);
        game.reload([datapack]);
        // 数据包更换后旧存档 id 可能失效，清除以免下次启动读档报错
        SaveSystem.delete();
        this.host.setStarted();
        this.host.clearPendingRestart();
        game.start();
        this.host.resetSessionPanel();
        game.devLog.record(
          `导入数据包：${datapack.name} v${datapack.version}（${jsonFileCount} 个 json 文件，提取 ${images.length} 张图片${ignoredCount > 0 ? `，忽略 ${ignoredCount} 个其他文件` : ''}）`,
          { source: 'datapack', level: 'success' },
        );
        toast.show(
          `已加载 Mod <b>${datapack.name}</b> v${datapack.version}<br><small>${jsonFileCount} 个 json 文件 · ${images.length} 张图片${ignoredCount > 0 ? ` · 忽略 ${ignoredCount} 个其他文件` : ''}</small>`,
          'success',
        );
        this.host.render();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        game.devLog.record(`导入数据包失败：${message}`, { source: 'datapack', level: 'error' });
        toast.show(`导入失败：${message}`, 'error');
      } finally {
        input.remove();
      }
    });
    input.click();
  }

  /** 导出开发日志：devLog 全量 + 运行上下文，下载为 JSON 文件。 */
  exportLog(): void {
    const { game } = this.host;
    const payload = game.devLog.export({
      frame: game.state.totalFrames,
      activeInit: game.state.activeInit,
      resources: { ...game.state.resources },
      saveVersion: '1.0.0',
    });
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `aronaclicker-log-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    game.devLog.record(`已导出日志（${game.getDevLogs().length} 条）`, { source: 'dev', level: 'info' });
    this.host.render();
  }
}
