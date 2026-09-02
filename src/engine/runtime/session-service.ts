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
  devLog: DevLog;
  eventBus: EventBus;
  effectEngine: EffectEngine;
  getState: () => EffectRuntimeState;
}

export class SessionService {
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private _running = false;
  private lastTickTimestamp: number = Date.now();

  constructor(private readonly opts: SessionServiceOptions) {}

  get running(): boolean { return this._running; }

  getLastTick(): number { return this.lastTickTimestamp; }

  /** 记载本次会话起始/重置的基准时间（init/reset 后调用）。 */
  touchLastTick(): void { this.lastTickTimestamp = Date.now(); }

  /** 存档恢复：以其 timestamp 作为离线收益基准。 */
  setLastTick(timestamp: number): void { this.lastTickTimestamp = timestamp; }

  /** 开始 Tick 循环 (1 tick/秒)。 */
  start(): void {
    if (this._running) return;
    this._running = true;
    this.lastTickTimestamp = Date.now();

    // 计算离线收益
    this.processOfflineProgress();

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
    this.opts.devLog.record('自动生产循环已暂停', { source: 'runtime', level: 'warning' });
  }

  /** 计算离线收益（上限 8 小时，产出耗尽后提前终止）。 */
  private processOfflineProgress(): void {
    // 简单实现：离线时间的帧数直接累加
    const offlineMs = Date.now() - this.lastTickTimestamp;
    let offlineFrames = Math.floor(offlineMs / 1000);

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
      for (let i = 0; i < offlineFrames; i++) {
        const result = this.opts.doTick();
        // 产出全部耗尽（容量已满）时提前终止
        if (result.productions.length === 0) break;
      }
      this.opts.effectEngine.setState(this.opts.getState());
      this.opts.eventBus.flush();
    }
  }
}
