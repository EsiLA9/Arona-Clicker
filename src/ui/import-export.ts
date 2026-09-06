import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// ui/import-export.ts — 数据包导入 / 日志导出
// 疏散自 controller.ts：把两个自包含的 IO 操作收拢到这里。
// ============================================================

import { parsePackFromZipFile } from '../data-services/datapack/pack-parser';
import type { PackManifest } from '../data-services/datapack/manifest';
import type { GameReadModel } from '../arona-clicker/contracts';
import type { } from '../engine/types';
import type { SaveData } from '../arona-clicker/contracts/save-data';
import type { DevLog } from '../engine/core/dev-log';
import type { ImageStore, ResolvedImageEntry } from '../data-services/assets/image-store';
import type { ToastService } from './components/toast';
import type { ModalManager } from './modal';

/** controller 暴露给 IO 服务的回调（避免反向依赖 controller）。 */
export interface ImportExportHost {
  game: ImportExportGame;
  modal: ModalManager;
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

interface ImportExportGame extends GameReadModel {
  readonly imageStore: Pick<ImageStore, 'clear'>;
  readonly pics: GameReadModel['pics'] & { register(mod: string, entries: readonly ResolvedImageEntry[]): void };
  readonly devLog: Pick<DevLog, 'record' | 'export'>;
  reload(datapacks: Datapack[]): void;
  start(): void;
  registerParsedPack?(parsed: {
    manifest: PackManifest;
    datapack: Datapack;
    images: ResolvedImageEntry[];
    jsonFileCount: number;
    ignoredCount: number;
  }): void;
  applyEnabledPacks?(): void;
}

/** 数据包导入 / 日志导出服务。 */
export class ImportExportService {
  constructor(private readonly host: ImportExportHost) {}

  /**
   * 导入 Mod 压缩包：用户选择 .zip 后按 manifest + 分片解析为 Pack，
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
        const { manifest, datapack, jsonFileCount, ignoredCount, images } = await parsePackFromZipFile(file);
        if (game.registerParsedPack && game.applyEnabledPacks) {
          const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
          this.host.modal.open({
            title: '导入数据包预览',
            body: `
              <p><strong>${escape(manifest.name)}</strong> <span class="muted">v${escape(manifest.version)}</span></p>
              <dl class="pack-detail-list">
                <div><dt>命名空间</dt><dd>${escape(manifest.modName)}</dd></div>
                <div><dt>JSON 文件</dt><dd>${jsonFileCount}</dd></div>
                <div><dt>图片资源</dt><dd>${images.length}</dd></div>
                ${ignoredCount > 0 ? `<div><dt>忽略文件</dt><dd>${ignoredCount}</dd></div>` : ''}
              </dl>
              <p class="muted">确认后会加入包库，但不会立即改变当前运行内容；是否启用由“数据包”工作区中的启用集草案决定。</p>`,
            footer: '<button class="modal-close">取消</button><button class="primary-button" data-modal-action="confirm-import">加入包库</button>',
            onAction: action => {
              if (action !== 'confirm-import') return;
              game.registerParsedPack!({ manifest, datapack, images, jsonFileCount, ignoredCount });
              game.devLog.record(`已加入数据包库：${manifest.name} v${manifest.version}（尚未启用）`, { source: 'datapack', level: 'success' });
              toast.show(`已加入包库 <b>${escape(manifest.name)}</b> v${escape(manifest.version)}<br><small>当前运行内容未改变，可在数据包工作区中决定是否启用</small>`, 'success');
              this.host.modal.close();
              this.host.render();
            },
          });
          return;
        } else {
          // 导入后由运行时门面重新应用启用集。
          game.imageStore.clear();
          game.pics.register(manifest.modName, images);
          game.reload([datapack]);
        }
        // 兼容旧宿主：只有直接替换运行时的旧路径才会进入新会话。
        this.host.setStarted();
        this.host.clearPendingRestart();
        game.start();
        this.host.resetSessionPanel();
        game.devLog.record(
          `导入数据包：${manifest.name} v${manifest.version}（${jsonFileCount} 个 json 文件，提取 ${images.length} 张图片${ignoredCount > 0 ? `，忽略 ${ignoredCount} 个其他文件` : ''}）`,
          { source: 'datapack', level: 'success' },
        );
        toast.show(
          `已加载 Mod <b>${manifest.name}</b> v${manifest.version}<br><small>${jsonFileCount} 个 json 文件 · ${images.length} 张图片${ignoredCount > 0 ? ` · 忽略 ${ignoredCount} 个其他文件` : ''}</small>`,
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
