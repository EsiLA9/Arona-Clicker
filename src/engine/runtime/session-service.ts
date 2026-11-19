// ============================================================
// engine/runtime/session-service.ts — 会话（帧循环/离线收益）
// 从 GameInstance 门面拆出，持有循环状态（running / interval / lastTick）。
// GameInstance 保留 start/stop/tick 为门面委托；tick 帧逻辑经 doTick 回调注入。
// ============================================================

import type { EffectRuntimeState } from '../contracts/state-query';
import type { TickResult } from '../contracts/tick';
import { EventBus } from '../core/event-bus';
import { EffectEngine } from '../effect/effect-engine';
import { DevLog } from '../core/dev-log';
import { TICK_INTERVAL_MS } from '../system/tick-system';

export interface SessionServiceOptions {
  doTick: () => TickResult;
  doOfflineTicks: (frames: number) => void;
  devLog: DevLog;
  eventBus: EventBus;
  effectEngine: EffectEngine;
  getState: () => EffectRuntimeState;
}

export class SessionService {
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private _running = false;
  private lastTickTimestamp: number = Date.now();
  private offlineBasePending = false;

  constructor(private readonly opts: SessionServiceOptions) {}

  get running(): boolean { return this._running; }

  getLastTick(): number { return this.lastTickTimestamp; }

  /** 记载本次会话起始/重置的基准时间（init/reset 后调用）。 */
  touchLastTick(): void {
    this.lastTickTimestamp = Date.now();
    this.offlineBasePending = false;
  }

  /** 存档恢复：以其 timestamp 作为离线收益基准。 */
  setLastTick(timestamp: number): void {
    this.lastTickTimestamp = timestamp;
    this.offlineBasePending = true;
  }

  /** 开始 Tick 循环 (1 tick/秒)。 */
  start(): void {
    if (this._running) return;
    this._running = true;
    const offlineBase = this.offlineBasePending ? this.lastTickTimestamp : undefined;
    this.lastTickTimestamp = Date.now();
    this.offlineBasePending = false;
    try {
      if (offlineBase !== undefined && Number.isFinite(offlineBase)) this.processOfflineProgress(offlineBase);
    } catch (error) {
      if (this.tickInterval === null) this._running = false;
      throw error;
    }
    if (!this._running || this.tickInterval !== null) return;

    this.tickInterval = setInterval(() => {
      this.opts.doTick();
      this.opts.effectEngine.setState(this.opts.getState());
      this.opts.eventBus.flush();
    }, TICK_INTERVAL_MS);

    this.opts.devLog.record('自动生产循环已启动', { source: 'runtime', level: 'success' });
  }

  /** 停止 Tick 循环。 */
  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.lastTickTimestamp = Date.now();
    this.offlineBasePending = false;
    this.opts.devLog.record('自动生产循环已暂停', { source: 'runtime', level: 'warning' });
  }

  /** 按恢复后的产出率结算离线收益（上限 8 小时）。 */
  private processOfflineProgress(offlineBase: number): void {
    let offlineFrames = Math.floor((this.lastTickTimestamp - offlineBase) / TICK_INTERVAL_MS);

    // 上限 8 小时 = 28800 帧，防止陈旧存档一次性补算过多导致卡顿
    const maxOfflineFrames = 8 * 60 * 60;
    if (offlineFrames > maxOfflineFrames) {
      this.opts.devLog.record(`离线时长超过 8 小时，补算截断为 ${maxOfflineFrames} 帧`, {
        source: 'runtime',
        level: 'warning',
        details: 'offline cap',
      });
      offlineFrames = maxOfflineFrames;
    }

    if (offlineFrames > 5) {
      this.opts.devLog.record(`补算 ${offlineFrames} 帧离线进度`, {
        source: 'runtime',
        level: 'info',
        details: 'offline progress',
      });
      this.opts.doOfflineTicks(offlineFrames);
      this.opts.effectEngine.setState(this.opts.getState());
      this.opts.eventBus.flush();
    }
  }
}
