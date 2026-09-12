// ============================================================
// engine/theme-runtime.ts — 运行时主题管理框架（分层叠加）
//
// 将色彩组（ColorGroup）自身与游戏实际结构解耦：场景（Init/Area/学生）与临时演出
// 不再绑定「必须是某个组的完整主题」，而是可以：
//   - 引用多个 ColorGroupDef（groupId）各取一套 token
//   - 或自定义局部 token 覆盖（tokens）
//   - 或两者混合（用某组打底 + 局部 override）
//
// 叠加（优先级从高到低）：
//   L1 ephemeral 临时演出：Talklet/Trigger 推入的临时层，可覆盖一切，可帧过期
//   L2 scene      场景特色：当前 Init / Area / 当前对话学生，进入设、离开清
//   L3 player     玩家全局 ColorGroup 主题
//   L3 user       玩家独立自定义主题（被选中时才参与）
// player/init/area/student 四层的相对优先级可由玩家自定义（setLayerOrder）；
// 演出层不参与排序，始终最高。前端实际消费的 theme-tree =
// 各层按优先级合并（高层 token 覆盖低层）。
// ============================================================

import type { ColorGroupId } from '../types/character';
import { SYSTEM_DEFAULT_PRIMARY } from './theme-defaults';
import type { BackgroundLayerDef, PresentationDef, PresentationLayerDef, ComponentPlacementDef, PresentationHostDef, PresentationRegion, ThemeNodeName, ThemeOrderScope, ThemeToken } from '../types/theme';

export type { ThemeOrderScope } from '../types/theme';

/** 参与玩家自定义排序的四层（低→高缺省顺序）。 */
export const DEFAULT_LAYER_ORDER: ThemeOrderScope[] = ['player', 'init', 'area', 'student'];

/** 单层主题来源：引用色彩组（整包 token）或自定义 token 覆盖，或混合。 */
export interface ThemeLayer {
  /** 层的唯一标识（用于 pop/清除；缺省自动生成）。 */
  id?: string;
  /** 运行时归属标识；仅用于生命周期诊断，不参与主题解析。 */
  owner?: string;
  /** 运行时目标键；仅用于临时层目标过滤和诊断，不参与 token 解析。 */
  targets?: readonly string[];
  /** 层类型：决定它与其它层叠加的槽位语义。 */
  scope: ThemeOrderScope | 'user' | 'ephemeral';
  /** 引用 ColorGroupDef；存在时先取其整包 token 作为基底。 */
  groupId?: ColorGroupId;
  /** 有序主题色列表；高层有值时作为最终语义节点的色板。 */
  palette?: readonly string[];
  /** 局部 token 覆盖；在 groupId 基底之上逐 key 覆盖。 */
  tokens?: Partial<Record<ThemeToken, string>>;
  /** 语义节点显式覆盖；高层同名节点覆盖低层。 */
  nodeOverrides?: Partial<Record<ThemeNodeName, string>>;
  /** UI 作用域节点覆盖；由最高优先级主题层提供。 */
  scopeNodeOverrides?: Record<string, Partial<Record<ThemeNodeName, string>>>;
  /** 背景视觉层；高优先级层按 id 覆盖，匿名层追加。 */
  background?: readonly BackgroundLayerDef[];
  /** 背景表现层的来源无关堆叠顺序；未列出的层保持合并顺序追加。 */
  backgroundLayerOrder?: readonly string[];
  /** 是否显式关闭主题色系统生成的全局颜色底层。 */
  systemColorLayerIgnored?: boolean;
  /** 区域化 UI 表现；高优先级层按 id 覆盖。 */
  presentation?: PresentationDef;
}

export type TalkletThemeLifetime = 'fulltime' | 'areatime' | 'seconds' | 'step';

/** Talklet Theme Lite 的运行时输入；不代表未来 DSL 的数据结构。 */
export interface TalkletThemeSpec {
  owner: string;
  effectId: string;
  theme: ThemeLayer;
  lifetime: TalkletThemeLifetime;
  areaId?: string;
  seconds?: number;
  steps?: number;
  /** 稳定的 Presentation Host / Region / 组件语义键；空范围会被拒绝。 */
  targets: readonly string[];
}

export interface TalkletThemeRecord extends TalkletThemeSpec {
  revision: number;
  expiresAt?: number;
  remainingSteps?: number;
}

export interface RuntimeThemeManagerOptions {
  now?: () => number;
  onChange?: () => void;
}

/** 某一层最终解析出的 token 表。 */
export type ThemeTokens = Record<string, string>;

/** 提供给 RuntimeThemeManager 的「层 → token 表」解析器（由 ColorSystem 实现，封装 registry）。 */
export type ThemeLayerResolver = (layer: ThemeLayer) => ThemeTokens;

export type ThemeRuntimeLayerKind = 'player' | 'user' | 'preview' | 'scene' | 'ephemeral';

export interface ThemeRuntimeLayerDiagnostic {
  id: string;
  scope: ThemeLayer['scope'];
  kind: ThemeRuntimeLayerKind;
  owner?: string;
  targets?: readonly string[];
  selected: boolean;
}

export interface ThemeRuntimeDiagnostics {
  target?: string;
  layerOrder: readonly ThemeOrderScope[];
  layers: readonly ThemeRuntimeLayerDiagnostic[];
}

/** 合并后的最终主题结果。 */
export interface ResolvedTheme {
  /** 参与合并的最底层 groupId（通常来自 player 或 scene），无则 null。 */
  groupId: ColorGroupId | null;
  /** 合并后的最终 token 表（高层覆盖低层）。 */
  tokens: ThemeTokens;
  /** 最终采用的有序主题色列表。 */
  palette: string[];
  /** 最终采用的语义节点显式覆盖。 */
  nodeOverrides: Partial<Record<ThemeNodeName, string>>;
  /** 最终采用的 UI 作用域节点覆盖。 */
  scopeNodeOverrides: Record<string, Partial<Record<ThemeNodeName, string>>>;
  /** 实际参与叠加的层 id（调试/溯源用，从低到高）。 */
  layers: string[];
  /** 按最终绘制顺序排列的背景层。 */
  background: BackgroundLayerDef[];
  systemColorLayerIgnored: boolean;
  /** 区域化 UI 表现结果。 */
  presentation: PresentationDef;
}

const DEFAULT_TOKENS: ThemeTokens = { primary: SYSTEM_DEFAULT_PRIMARY };

function mergeScopeNodeOverrides(
  base: Record<string, Partial<Record<ThemeNodeName, string>>>,
  next: Record<string, Partial<Record<ThemeNodeName, string>>> | undefined,
): Record<string, Partial<Record<ThemeNodeName, string>>> {
  if (!next) return base;
  const merged = { ...base };
  for (const [scope, overrides] of Object.entries(next)) {
    merged[scope] = { ...(merged[scope] ?? {}), ...overrides };
  }
  return merged;
}

export class RuntimeThemeManager {
  private player: ThemeLayer | null = null;
  private user: ThemeLayer | null = null;
  /** 编辑器草稿预览层：高于已应用主题，低于剧情演出层。 */
  private preview: ThemeLayer | null = null;
  /** 场景栈（后进先出）：进入 Init/Area 压入对应层，打开学生对话再压入 student 层，关闭时弹出回退。 */
  private readonly sceneStack: ThemeLayer[] = [];
  private readonly ephemeralStack: { layer: ThemeLayer; id: string; revision: number; owner?: string; targets?: readonly string[] }[] = [];
  private readonly talkletThemes = new Map<string, TalkletThemeRecord>();
  /** 玩家自定义的 player/init/area/student 相对优先级（低→高；缺省见 DEFAULT_LAYER_ORDER）。 */
  private layerOrder: ThemeOrderScope[] = [...DEFAULT_LAYER_ORDER];
  private seq = 0;
  private revision = 0;

  constructor(private readonly resolveLayer: ThemeLayerResolver, private readonly options: RuntimeThemeManagerOptions = {}) {}

  private changed(): void { this.options.onChange?.(); }

  /** 清空全部运行时层（新会话/读档时调用）。 */
  reset(): void {
    this.player = null;
    this.user = null;
    this.preview = null;
    this.sceneStack.length = 0;
    this.ephemeralStack.length = 0;
    this.talkletThemes.clear();
    this.layerOrder = [...DEFAULT_LAYER_ORDER];
    this.changed();
  }

  /**
   * 设置 player/init/area/student 四层的相对优先级（低→高；演出层不受影响，始终最高）。
   * 非完整排列（缺失/重复/非法 scope）时保持现有顺序。
   */
  setLayerOrder(order: ThemeOrderScope[] | null | undefined): void {
    const cleaned: ThemeOrderScope[] = [];
    for (const scope of order ?? []) {
      if (DEFAULT_LAYER_ORDER.includes(scope) && !cleaned.includes(scope)) cleaned.push(scope);
    }
    if (cleaned.length === DEFAULT_LAYER_ORDER.length) {
      this.layerOrder = cleaned;
      return;
    }
    const legacyScopes: ThemeOrderScope[] = ['player', 'area', 'student'];
    if (cleaned.length === legacyScopes.length && legacyScopes.every(scope => cleaned.includes(scope))) {
      const expanded = [...cleaned];
      expanded.splice(Math.max(0, expanded.indexOf('area')), 0, 'init');
      this.layerOrder = expanded;
    }
  }

  // --- 各层写入 ---

  /** 玩家全局主题层（常驻基色）。 */
  setPlayer(layer: ThemeLayer | null): void {
    this.player = layer;
  }

  /** 用户主题层：仅在 activeTheme 选择 custom 时存在，高于场景、低于临时演出，不参与 player/init/area/student 排序。 */
  setUser(layer: ThemeLayer | null): void {
    this.user = layer;
  }

  /** 设置当前编辑会话的临时预览层，不写入玩家状态。 */
  setPreview(layer: ThemeLayer | null): void {
    this.preview = layer;
  }

  /**
   * 压入场景层（当前 Init / Area / 当前对话学生）。同 scope 已存在时先移除再压入（避免重复）。
   * 进入场景调用；离开时用 popScene 弹出。
   */
  pushScene(layer: ThemeLayer): void {
    const idx = this.sceneStack.findIndex(s => s.scope === layer.scope);
    if (idx >= 0) this.sceneStack.splice(idx, 1);
    this.sceneStack.push(layer);
  }

  /** 弹出最近压入的场景层（按 scope 或引用弹出；不存在则静默忽略）。 */
  popScene(scope?: ThemeLayer['scope']): void {
    if (scope) {
      const idx = this.sceneStack.findIndex(s => s.scope === scope);
      if (idx >= 0) this.sceneStack.splice(idx, 1);
      return;
    }
    this.sceneStack.pop();
  }

  /**
   * 推入临时演出层（L1，最高优先级）。返回其 id 供 pop 移除。
   * 可覆盖同 scope 旧层之外的任意层；同 id 重复 push 会覆盖旧值。
   */
  pushEphemeral(layer: ThemeLayer): string {
    const id = layer.id ?? `ephemeral-${++this.seq}`;
    const existing = this.ephemeralStack.findIndex(e => e.id === id);
    const entry = { layer: { ...layer, id }, id, revision: ++this.revision, owner: layer.owner, targets: layer.targets ? [...layer.targets] : undefined };
    if (existing >= 0) this.ephemeralStack[existing] = entry;
    else this.ephemeralStack.push(entry);
    this.changed();
    return id;
  }

  /** 移除临时演出层（不存在则静默忽略）。 */
  popEphemeral(id: string): void {
    const idx = this.ephemeralStack.findIndex(e => e.id === id);
    if (idx >= 0) this.ephemeralStack.splice(idx, 1);
    if (idx >= 0) this.changed();
  }

  private talkletKey(owner: string, effectId: string): string { return `${owner}\u0000${effectId}`; }

  /** 设定/完整重写一个 Owner 下的 Lite 配置。 */
  setTalkletTheme(spec: TalkletThemeSpec): TalkletThemeRecord | null {
    if (!spec.owner || !spec.effectId || spec.targets.length === 0) return null;
    if (spec.lifetime === 'areatime' && !spec.areaId) return null;
    if (spec.lifetime === 'seconds' && (!Number.isFinite(spec.seconds) || spec.seconds! <= 0)) return null;
    if (spec.lifetime === 'step' && (!Number.isInteger(spec.steps) || spec.steps! <= 0)) return null;
    const key = this.talkletKey(spec.owner, spec.effectId);
    const revision = ++this.revision;
    const record: TalkletThemeRecord = {
      ...spec,
      theme: { ...spec.theme, id: `talklet:${spec.owner}:${spec.effectId}`, scope: 'ephemeral' },
      revision,
      expiresAt: spec.lifetime === 'seconds' ? this.clock() + spec.seconds! * 1000 : undefined,
      remainingSteps: spec.lifetime === 'step' ? spec.steps : undefined,
    };
    const old = this.talkletThemes.get(key);
    if (old) this.removeTalkletLayer(old);
    this.talkletThemes.set(key, record);
    this.ephemeralStack.push({ layer: record.theme, id: record.theme.id!, revision, owner: spec.owner, targets: [...spec.targets] });
    this.changed();
    return { ...record, theme: { ...record.theme } };
  }

  getTalkletThemes(owner?: string): readonly TalkletThemeRecord[] {
    return [...this.talkletThemes.values()].filter(record => owner === undefined || record.owner === owner).map(record => ({ ...record, theme: { ...record.theme } }));
  }

  removeTalkletTheme(owner: string, effectId: string): void {
    const key = this.talkletKey(owner, effectId);
    const record = this.talkletThemes.get(key);
    if (!record) return;
    this.removeTalkletLayer(record);
    this.talkletThemes.delete(key);
    this.changed();
  }

  clearTalkletThemes(owner: string): void {
    for (const record of [...this.talkletThemes.values()]) if (record.owner === owner) this.removeTalkletTheme(owner, record.effectId);
  }

  disposeStoryExecution(owner: string): void { this.clearTalkletThemes(owner); }

  /** 在一个 Talklet 实际完成后调用；设置主题的 Talklet 不应调用此方法。 */
  completeTalklet(owner?: string): void {
    const records = [...this.talkletThemes.values()].filter(record => record.lifetime === 'step' && (owner === undefined || record.owner === owner));
    for (const record of records) {
      record.remainingSteps = (record.remainingSteps ?? 1) - 1;
      if (record.remainingSteps <= 0) this.removeTalkletTheme(record.owner, record.effectId);
    }
  }

  /** 统一运行时时钟；不依赖 setTimeout 作为真相。 */
  tick(now = this.clock()): void {
    for (const record of [...this.talkletThemes.values()]) {
      if (record.lifetime === 'seconds' && record.expiresAt! <= now) this.removeTalkletTheme(record.owner, record.effectId);
    }
  }

  /** Area 切换后清理已不适用的 areatime 层。 */
  areaChanged(areaId: string): void {
    for (const record of [...this.talkletThemes.values()]) {
      if (record.lifetime === 'areatime' && record.areaId !== areaId) this.removeTalkletTheme(record.owner, record.effectId);
    }
  }

  private clock(): number { return this.options.now?.() ?? Date.now(); }

  private removeTalkletLayer(record: TalkletThemeRecord): void {
    const index = this.ephemeralStack.findIndex(entry => entry.owner === record.owner && entry.id === record.theme.id);
    if (index >= 0) this.ephemeralStack.splice(index, 1);
  }

  // --- 查询 ---

  /**
   * 返回当前运行时主题层的只读来源快照。
   *
   * 该快照供编辑器、调试面板和生命周期回归使用，不参与主题解析，也不写入存档。
   * target 存在时，ephemeral 层会标记是否命中该目标，便于识别“当前层存在但不作用于此目标”的情况。
   */
  diagnostics(target?: string): ThemeRuntimeDiagnostics {
    const layers: ThemeRuntimeLayerDiagnostic[] = [];
    const selected = (targets: readonly string[] | undefined): boolean => target === undefined || !targets || targets.includes(target);
    const add = (layer: ThemeLayer, kind: ThemeRuntimeLayerKind, fallbackId: string, targets?: readonly string[], owner?: string): void => {
      layers.push({
        id: layer.id ?? fallbackId,
        scope: layer.scope,
        kind,
        owner: owner ?? layer.owner,
        targets: targets ? [...targets] : undefined,
        selected: selected(targets),
      });
    };

    const sceneByScope = new Map<ThemeOrderScope, ThemeLayer>();
    for (const layer of this.sceneStack) sceneByScope.set(layer.scope as ThemeOrderScope, layer);
    for (const scope of this.layerOrder) {
      if (scope === 'player') {
        if (this.player) add(this.player, 'player', 'player');
        continue;
      }
      const layer = sceneByScope.get(scope);
      if (layer) add(layer, 'scene', scope);
    }
    if (this.user) add(this.user, 'user', 'user');
    if (this.preview) add(this.preview, 'preview', 'preview');
    for (const entry of [...this.ephemeralStack].sort((a, b) => a.revision - b.revision)) {
      add(entry.layer, 'ephemeral', entry.id, entry.targets, entry.owner);
    }
    return { target, layerOrder: [...this.layerOrder], layers };
  }

  /** 当前场景层（栈顶，即最内层场景；无场景返回 null）。 */
  currentScene(): ThemeLayer | null {
    return this.sceneStack.length > 0 ? this.sceneStack[this.sceneStack.length - 1] : null;
  }

  /** 当前激活的临时层（栈顶，即最高优先级临时层）。 */
  topEphemeral(): ThemeLayer | null {
    return this.ephemeralStack.length > 0 ? this.ephemeralStack[this.ephemeralStack.length - 1].layer : null;
  }

  /**
   * 解析某 scope 当前生效层（player 或场景栈内该 scope 最顶层）的 token 表；
   * 无该层返回空表。忽略临时演出层（其不参与排序，恒为最高）。
   */
  resolveScope(scope: ThemeLayer['scope']): ThemeTokens {
    if (scope === 'player') {
      return this.player ? this.resolveLayer(this.player) : {};
    }
    if (scope === 'user') {
      return this.user ? this.resolveLayer(this.user) : {};
    }
    for (let i = this.sceneStack.length - 1; i >= 0; i--) {
      if (this.sceneStack[i].scope === scope) return this.resolveLayer(this.sceneStack[i]);
    }
    return {};
  }

  /**
   * 解析最终主题：按玩家配置的 player/init/area/student 相对优先级合并，演出层叠加在最上。
   * 以最底层（优先级最低）的非空层为基底求整包 token，其上各层逐 token 覆盖。
   */
  resolve(target?: string): ResolvedTheme {
    // 各槽位层（player 单层 + 场景栈按 scope 去重），再按配置顺序从低到高收集；
    // 演出层不参与排序，恒在顶层叠加
    const byScope: Partial<Record<ThemeOrderScope | 'user' | 'ephemeral', ThemeLayer>> = {};
    if (this.player) byScope.player = this.player;
    for (const scene of this.sceneStack) byScope[scene.scope] = scene;
    const ordered: ThemeLayer[] = [];
    for (const scope of this.layerOrder) {
      const layer = byScope[scope];
      if (layer) ordered.push(layer);
    }
    if (this.user) ordered.push(this.user);
    if (this.preview) ordered.push(this.preview);
    for (const e of [...this.ephemeralStack].sort((a, b) => a.revision - b.revision)) {
      if (e.targets && target !== undefined && !e.targets.includes(target)) continue;
      ordered.push(e.layer);
    }
    if (ordered.length === 0) return { groupId: null, tokens: { ...DEFAULT_TOKENS }, palette: [], nodeOverrides: {}, scopeNodeOverrides: {}, layers: [], background: [], systemColorLayerIgnored: false, presentation: {} };

    let merged: ThemeTokens = {};
    let palette: string[] = [];
    let nodeOverrides: Partial<Record<ThemeNodeName, string>> = {};
    let scopeNodeOverrides: Record<string, Partial<Record<ThemeNodeName, string>>> = {};
    let groupId: ColorGroupId | null = null;
    const background: BackgroundLayerDef[] = [];
    const presentation: PresentationDef = { layers: [], components: [], panels: [], hosts: [] };
    const presentationLayerIds = new Map<string, number>();
    const presentationComponentIds = new Map<string, number>();
    const presentationPanelIds = new Map<PresentationRegion, number>();
    const presentationHostIds = new Map<string, number>();
    const backgroundIds = new Map<string, number>();
    let backgroundLayerOrder: string[] = [];
    let systemColorLayerIgnored = false;
    const mergeBackground = (layers: readonly BackgroundLayerDef[] | undefined): void => {
      for (const layer of layers ?? []) {
        if (layer.id) {
          const index = backgroundIds.get(layer.id);
          if (index !== undefined) background[index] = { ...layer };
          else {
            backgroundIds.set(layer.id, background.length);
            background.push({ ...layer });
          }
        } else background.push({ ...layer });
      }
    };
    const mergePresentation = (value: PresentationDef | undefined): void => {
      const mergeHost = (baseHost: PresentationHostDef | undefined, incoming: PresentationHostDef): PresentationHostDef => {
        const mergedHost: PresentationHostDef = {
          ...(baseHost ?? {}),
          ...incoming,
          ...(incoming.layers ? { layers: incoming.layers.map(layer => ({ ...layer })) } : {}),
          ...(incoming.layerOrder ? { layerOrder: [...incoming.layerOrder] } : {}),
        };
        if (baseHost?.states || incoming.states) {
          mergedHost.states = { ...(baseHost?.states ?? {}) };
          for (const [state, stateDef] of Object.entries(incoming.states ?? {})) {
            const previous = mergedHost.states[state as keyof NonNullable<PresentationHostDef['states']>];
            mergedHost.states[state as keyof NonNullable<PresentationHostDef['states']>] = {
              ...(previous ?? {}),
              ...stateDef,
              ...(stateDef?.layers ? { layers: stateDef.layers.map(layer => ({ ...layer })) } : {}),
              ...(stateDef?.layerOrder ? { layerOrder: [...stateDef.layerOrder] } : {}),
            };
          }
        }
        return mergedHost;
      };
      for (const layer of value?.layers ?? []) {
        if (layer.id) {
          const index = presentationLayerIds.get(layer.id);
          if (index !== undefined) presentation.layers![index] = { ...layer };
          else {
            presentationLayerIds.set(layer.id, presentation.layers!.length);
            presentation.layers!.push({ ...layer });
          }
        } else presentation.layers!.push({ ...layer });
      }
      for (const component of value?.components ?? []) {
        const index = presentationComponentIds.get(component.id);
        if (index !== undefined) presentation.components![index] = { ...component };
        else {
          presentationComponentIds.set(component.id, presentation.components!.length);
          presentation.components!.push({ ...component });
        }
      }
      for (const panel of value?.panels ?? []) {
        const index = presentationPanelIds.get(panel.region);
        if (index !== undefined) presentation.panels![index] = { ...panel };
        else {
          presentationPanelIds.set(panel.region, presentation.panels!.length);
          presentation.panels!.push({ ...panel });
        }
      }
      for (const host of value?.hosts ?? []) {
        const index = presentationHostIds.get(host.id);
        if (index !== undefined) presentation.hosts![index] = mergeHost(presentation.hosts![index], host);
        else {
          presentationHostIds.set(host.id, presentation.hosts!.length);
          presentation.hosts!.push(mergeHost(undefined, host));
        }
      }
    };
    // 先求基底（最底层）整包 token，再逐层覆盖
    const base = this.resolveLayer(ordered[0]);
    merged = { ...base };
    if (ordered[0].palette?.length) palette = [...ordered[0].palette];
    nodeOverrides = { ...(ordered[0].nodeOverrides ?? {}) };
    scopeNodeOverrides = mergeScopeNodeOverrides({}, ordered[0].scopeNodeOverrides);
    mergeBackground(ordered[0].background);
    if (ordered[0].backgroundLayerOrder?.length) backgroundLayerOrder = [...ordered[0].backgroundLayerOrder];
    if (ordered[0].systemColorLayerIgnored !== undefined) systemColorLayerIgnored = ordered[0].systemColorLayerIgnored;
    mergePresentation(ordered[0].presentation);
    if (ordered[0].groupId) groupId = ordered[0].groupId;
    for (const layer of ordered.slice(1)) {
      if (layer.palette?.length) palette = [...layer.palette];
      nodeOverrides = { ...nodeOverrides, ...(layer.nodeOverrides ?? {}) };
      scopeNodeOverrides = mergeScopeNodeOverrides(scopeNodeOverrides, layer.scopeNodeOverrides);
      if (layer.groupId) {
        merged = { ...merged, ...this.resolveLayer(layer) };
        if (!groupId) groupId = layer.groupId;
      }
      mergeBackground(layer.background);
      if (layer.backgroundLayerOrder?.length) backgroundLayerOrder = [...layer.backgroundLayerOrder];
      if (layer.systemColorLayerIgnored !== undefined) systemColorLayerIgnored = layer.systemColorLayerIgnored;
      mergePresentation(layer.presentation);
      if (layer.tokens) {
        for (const [key, value] of Object.entries(layer.tokens)) {
          if (value != null) merged[key] = value;
        }
      }
    }
    if (background.length > 0 && backgroundLayerOrder.length > 0) {
      const rank = new Map(backgroundLayerOrder.map((id, index) => [id, index]));
      background.sort((a, b) => (rank.get(a.id ?? '') ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id ?? '') ?? Number.MAX_SAFE_INTEGER));
    }
    return {
      groupId,
      tokens: merged,
      palette,
      nodeOverrides,
      scopeNodeOverrides,
      layers: ordered.map(l => l.id ?? l.scope),
      background,
      systemColorLayerIgnored,
      presentation,
    };
  }
}
