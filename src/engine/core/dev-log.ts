// ============================================================
// engine/dev-log.ts - Small runtime log for the early prototype UI
// ============================================================

import { GameEvent } from '../types';
import type { TickResult } from '../contracts/tick';

export type DevLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface DevLogEntry {
  id: number;
  timestamp: number;
  level: DevLogLevel;
  source: string;
  message: string;
  details?: string;
  frame?: number;
}

export type DevLogRecordOptions = {
  level?: DevLogLevel;
  source?: string;
  details?: string;
  frame?: number;
};

export interface DevLogOptions {
  maxEntries?: number;
  clock?: () => number;
  /** 开发模式：记录 tick 明细、资源正负变化等高频细节。默认关闭。 */
  verbose?: boolean;
}

/**
 * UI-facing runtime trace. It stores presentation-ready facts, but exposes
 * snapshots so the UI never receives a mutable engine collection.
 *
 * verbose 模式用于开发期排障：尽量详细地保存每条生产、资源变动，且不节流。
 */
export class DevLog {
  private readonly maxEntries: number;
  private readonly clock: () => number;
  private readonly verbose: boolean;
  private entries: DevLogEntry[] = [];
  private nextId = 1;

  constructor(options: DevLogOptions = {}) {
    this.verbose = options.verbose ?? false;
    this.maxEntries = Math.max(1, options.maxEntries ?? (this.verbose ? 20000 : 80));
    this.clock = options.clock ?? (() => Date.now());
  }

  record(
    message: string,
    options: DevLogRecordOptions = {},
  ): DevLogEntry {
    const entry: DevLogEntry = {
      id: this.nextId++,
      timestamp: this.clock(),
      level: options.level ?? 'info',
      source: options.source ?? 'runtime',
      message,
      ...(options.details ? { details: options.details } : {}),
      ...(options.frame === undefined ? {} : { frame: options.frame }),
    };

    this.entries = [entry, ...this.entries].slice(0, this.maxEntries);
    return entry;
  }

  recordEvent(event: GameEvent, frame?: number): void {
    switch (event.type) {
      case 'initEntered':
        this.record(`已进入世界线 ${event.initId}`, { source: 'init', level: 'success', frame });
        break;
      case 'areaEntered':
        this.record(`已移动到 Area ${event.areaId}`, {
          source: 'area',
          level: 'success',
          details: event.fromAreaId ? `来自 ${event.fromAreaId}` : undefined,
          frame,
        });
        break;
      case 'spotLevelChanged':
        this.record(`${event.spotId} 已达到 Lv.${event.newLevel}`, {
          source: 'spot',
          level: 'success',
          frame,
        });
        break;
      case 'spotProduced':
        // 生产结算由 recordTick 汇总记录；verbose 下额外逐条记录每处 Spot 的产出。
        if (this.verbose) {
          this.record(`${event.spotId} 产出 ${formatAmount(event.amount)} ${event.resource}`, {
            source: 'tick',
            frame,
          });
        }
        break;
      case 'resourceChanged':
        if (event.delta < 0) {
          this.record(`消耗 ${formatAmount(Math.abs(event.delta))} ${event.resource}`, {
            source: 'resource',
            details: `余额 ${formatAmount(event.newValue)}`,
            frame,
          });
        } else if (this.verbose) {
          this.record(`入账 ${formatAmount(event.delta)} ${event.resource}`, {
            source: 'resource',
            details: `余额 ${formatAmount(event.newValue)}`,
            frame,
          });
        }
        break;
      case 'itemCollected':
        this.record(`${event.count >= 0 ? '获得' : '消耗'} ${event.itemId} x${Math.abs(event.count)}`, {
          source: 'inventory',
          level: event.count >= 0 ? 'success' : 'info',
          details: `持有 ${event.newTotal}`,
          frame,
        });
        break;
      case 'initUnlocked':
        this.record(`已解锁世界线 ${event.initId}`, { source: 'init', level: 'success', frame });
        break;
      case 'storyTriggered':
        this.record(`开始剧情 ${event.storyId}`, { source: 'story', level: 'info', frame });
        break;
      case 'storyCompleted':
        this.record(`完成剧情 ${event.storyId}`, { source: 'story', level: 'success', frame });
        break;
      case 'affectorMounted':
        this.record(`挂载效果体 ${event.packId}`, {
          source: 'affector',
          details: event.mountEntityId,
          frame,
        });
        break;
      case 'affectorStateChanged':
        this.record(`效果体 ${event.instanceId}：${event.newState}`, {
          source: 'affector',
          details: `${event.oldState} -> ${event.newState}`,
          frame,
        });
        break;
      case 'affectorUnmounted':
        this.record(`卸载效果体 ${event.instanceId}`, {
          source: 'affector',
          level: 'warning',
          details: event.reason,
          frame,
        });
        break;
      default:
        break;
    }
  }

  recordTick(result: TickResult): void {
    if (result.productions.length === 0) return;
    // 生产汇总避免高频刷屏：非 verbose 时整 30 帧才记录一条，或累计较大产出时记录；
    // verbose 时每帧都记录（明细已由 spotProduced 逐条画入）。
    if (!this.verbose && result.frame % 30 !== 0) return;
    this.record(`第 ${result.frame} 帧完成 ${result.productions.length} 个生产结算`, {
      source: 'tick',
      details: `${result.productions.reduce((sum, item) => sum + item.amount, 0)} total output`,
      frame: result.frame,
    });
  }

  getEntries(): readonly DevLogEntry[] {
    return this.entries.map(entry => ({ ...entry }));
  }

  clear(): void {
    this.entries = [];
  }

  /**
   * 导出为 JSON 字符串（按时间正序），供开发期排障下载。
   * @param meta 额外元数据（版本号、运行帧、资源快照等），合并进导出对象。
   */
  export(meta: Record<string, unknown> = {}): string {
    const ordered = [...this.entries].reverse();
    return JSON.stringify({
      exportedAt: new Date(this.clock()).toISOString(),
      verbose: this.verbose,
      count: ordered.length,
      entries: ordered,
      ...meta,
    }, null, 2);
  }
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
