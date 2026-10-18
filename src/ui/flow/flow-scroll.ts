// ============================================================
// ui/flow/flow-scroll.ts — 按流实例工作的滚动状态
// 状态按「流实例键」保存，而不是按 DOM 元素：普通 Chat 的 `.chat-stream`
// 每次全量 render 都会换节点，Map 的 feed 由 patchMapDOM 保留；两者都必须
// 用同一份流状态恢复阅读位置。观察器仍绑定真实宿主元素。
// ============================================================

import { FLOW_ENTRY_KEY_ATTRIBUTE } from './flow-entry';

/** 距底部 24px 内视为贴底：新内容到达时跟随，否则保持阅读位置。 */
const BOTTOM_TOLERANCE = 24;

/** 未显式提供流实例键时的缺省槽位（单流宿主）。 */
const DEFAULT_STREAM_KEY = 'default';

/** 宿主最小形状：真实 HTMLElement 与其测试替身都满足。 */
export interface FlowScrollHost {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  querySelectorAll(selector: string): ArrayLike<Element>;
  addEventListener(type: 'scroll', listener: () => void): void;
  removeEventListener(type: 'scroll', listener: () => void): void;
  getBoundingClientRect?(): { readonly top: number };
}

export type FlowScrollMode = 'ratio' | 'anchor';

export interface FlowRestoreOptions {
  /** `ratio` 供普通 Chat 保留原比例行为；`anchor` 供 Map 按条目恢复阅读位置。 */
  readonly mode: FlowScrollMode;
  /** 有新内容且原本贴底：滚到底。 */
  readonly follow?: boolean;
  /** 显式强制滚到底（切回聊天等）。 */
  readonly force?: boolean;
  /** 流实例键；缺省为单流槽位。 */
  readonly streamKey?: string;
}

interface AnchorState {
  readonly key: string;
  readonly index: number;
  /** 锚点条目顶边相对宿主顶边的偏移。 */
  readonly offset: number;
}

interface StreamState {
  atBottom: boolean;
  ratio: number;
  scrollTop: number;
  anchor: AnchorState | null;
}

interface Observation {
  readonly listener: () => void;
  readonly observer: ResizeObserver;
}

function stateOf(): StreamState {
  return { atBottom: true, ratio: 1, scrollTop: 0, anchor: null };
}

function maxScroll(host: FlowScrollHost): number {
  return Math.max(0, host.scrollHeight - host.clientHeight);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function entryKey(element: Element): string | null {
  return element.getAttribute(FLOW_ENTRY_KEY_ATTRIBUTE);
}

function entryElements(host: FlowScrollHost): Element[] {
  if (typeof host.querySelectorAll !== 'function') return [];
  return Array.from(host.querySelectorAll(`[${FLOW_ENTRY_KEY_ATTRIBUTE}]`))
    .filter(element => typeof element.getBoundingClientRect === 'function');
}

/** 记录当前阅读锚点：视口内最上方仍可见的条目；全部在上方时取最后一条。 */
function captureAnchor(host: FlowScrollHost): AnchorState | null {
  if (typeof host.getBoundingClientRect !== 'function') return null;
  const hostTop = host.getBoundingClientRect().top;
  const elements = entryElements(host);
  if (elements.length === 0) return null;
  for (let index = 0; index < elements.length; index += 1) {
    const rect = elements[index].getBoundingClientRect();
    if (rect.bottom > hostTop) {
      const key = entryKey(elements[index]);
      if (!key) continue;
      return { key, index, offset: rect.top - hostTop };
    }
  }
  const last = elements[elements.length - 1];
  const key = entryKey(last);
  if (!key) return null;
  return { key, index: elements.length - 1, offset: last.getBoundingClientRect().top - hostTop };
}

/** 锚点仍存在则原样使用；被回收时退到同索引附近的稳定条目。 */
function resolveAnchor(host: FlowScrollHost, anchor: AnchorState): { element: Element; offset: number } | null {
  const elements = entryElements(host);
  if (elements.length === 0) return null;
  const byKey = elements.find(element => entryKey(element) === anchor.key);
  if (byKey) return { element: byKey, offset: anchor.offset };
  const fallback = elements[Math.min(anchor.index, elements.length - 1)];
  return { element: fallback, offset: anchor.offset };
}

/**
 * 每个流实例独立持有滚动状态；实例可以同时服务普通 Chat 与 Map
 * （各自的 streamKey 不同），互不影响。
 */
export class FlowScroll {
  private readonly states = new Map<string, StreamState>();
  /** 正在观察的宿主：WeakMap 不可遍历，reset 需要显式列表。 */
  private readonly observations = new WeakMap<FlowScrollHost, Observation>();
  private observedHosts: FlowScrollHost[] = [];

  private stateFor(streamKey: string): StreamState {
    const existing = this.states.get(streamKey);
    if (existing) return existing;
    const state = stateOf();
    this.states.set(streamKey, state);
    return state;
  }

  /** 重建 DOM 前调用：记录比例、贴底标记与阅读锚点，并断开旧观察器。 */
  capture(host: FlowScrollHost, streamKey: string = DEFAULT_STREAM_KEY): void {
    this.disconnect(host);
    const state = this.stateFor(streamKey);
    state.scrollTop = host.scrollTop;
    const max = maxScroll(host);
    if (max <= 0) {
      state.ratio = 1;
      state.atBottom = true;
      state.anchor = null;
      return;
    }
    state.ratio = host.scrollTop / max;
    state.atBottom = host.scrollTop + host.clientHeight >= host.scrollHeight - BOTTOM_TOLERANCE;
    state.anchor = captureAnchor(host);
  }

  /** 重建 DOM 后调用：贴底跟随、比例恢复或锚点恢复。 */
  restore(host: FlowScrollHost, options: FlowRestoreOptions): void {
    const state = this.states.get(options.streamKey ?? DEFAULT_STREAM_KEY);
    if (!state) return;
    const max = maxScroll(host);
    // 跟随只在原本贴底时成立；用户上翻时“有新内容”不改变阅读位置。
    const follow = Boolean(options.follow && state.atBottom);
    if (follow || options.force) {
      state.ratio = 1;
      state.atBottom = true;
      host.scrollTop = max;
      return;
    }
    if (options.mode === 'ratio') {
      host.scrollTop = state.ratio * max;
      return;
    }
    // 无几何信息（测试替身 / 未布局）时按原值恢复，交给浏览器自身夹取。
    if (!state.anchor || typeof host.getBoundingClientRect !== 'function') {
      host.scrollTop = state.scrollTop;
      return;
    }
    const anchor = resolveAnchor(host, state.anchor);
    if (!anchor) {
      host.scrollTop = state.scrollTop;
      return;
    }
    const hostTop = host.getBoundingClientRect().top;
    host.scrollTop = clamp(host.scrollTop + (anchor.element.getBoundingClientRect().top - hostTop) - anchor.offset, 0, max);
  }

  /**
   * 观察宿主内图片撑开高度；只在贴底时跟随。
   * 宿主本身尺寸固定，内容撑高不会触发自身 resize，因此观察 `<img>`。
   */
  observe(host: FlowScrollHost, streamKey: string = DEFAULT_STREAM_KEY): void {
    this.disconnect(host);
    const state = this.stateFor(streamKey);
    if (!state.atBottom) return;
    if (typeof ResizeObserver === 'undefined' || typeof host.querySelectorAll !== 'function') return;
    const images = Array.from(host.querySelectorAll('img'));
    if (images.length === 0) return;
    const listener = (): void => {
      const max = maxScroll(host);
      state.atBottom = max <= 0 || host.scrollTop + host.clientHeight >= host.scrollHeight - BOTTOM_TOLERANCE;
    };
    host.addEventListener('scroll', listener);
    const observer = new ResizeObserver(() => {
      if (!state.atBottom) return;
      host.scrollTop = maxScroll(host);
    });
    for (const image of images) observer.observe(image);
    this.observations.set(host, { listener, observer });
    this.observedHosts.push(host);
  }

  /** 断开指定宿主的观察器与 scroll 监听。 */
  disconnect(host: FlowScrollHost): void {
    const observation = this.observations.get(host);
    if (observation) {
      host.removeEventListener('scroll', observation.listener);
      observation.observer.disconnect();
      this.observations.delete(host);
    }
    this.observedHosts = this.observedHosts.filter(observed => observed !== host);
  }

  /** 会话重置：断开全部宿主并清空快照。 */
  reset(): void {
    for (const host of [...this.observedHosts]) this.disconnect(host);
    this.observedHosts = [];
    this.states.clear();
  }
}
