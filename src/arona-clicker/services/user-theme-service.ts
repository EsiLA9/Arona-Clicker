import type { AffectorEngine } from '../../engine/effect/affector-engine';
import type { StateMutationService } from '../state/state-mutation-service';
import type { PresentationHostDef, ThemeNodeName } from '../../engine/types/theme';
import type { UserThemeDraft, UserThemeState, UserThemeToken } from '../types/user-theme';
import type { PlayerState } from '../types/state';
import type { PicQueryPort } from '../contracts/pic-query';
import { SYSTEM_DEFAULT_PRIMARY } from '../../engine/core/theme-defaults';

export type UserThemeErrorCode = 'capability-unavailable' | 'invalid-draft' | 'revision-conflict' | 'session-not-found';
export interface UserThemeError { ok: false; code: UserThemeErrorCode; message: string; issues?: string[] }
export interface UserThemeOk { ok: true; state: Readonly<UserThemeState> }
export type UserThemeResult = UserThemeOk | UserThemeError;
export interface UserThemeEditSession { id: string; baseRevision: number; draft: UserThemeDraft; readonly: boolean }

const PRESENTATION_REGIONS = ['shell', 'header', 'leftPanel', 'centerPanel', 'rightPanel', 'footer', 'story', 'modal'] as const;

function normalizePresentationDraft(draft: UserThemeDraft): void {
  const presentation = draft.presentation ?? (draft.presentation = { layers: [], components: [] });
  const hosts = [...(presentation.hosts ?? [])];
  const byId = new Map(hosts.map(host => [host.id, host]));
  const globalHost = byId.get('global');
  if (globalHost) {
    draft.background = [...(draft.background ?? []), ...(globalHost.layers ?? []).map(layer => ({ ...layer }))];
    draft.backgroundLayerOrder = [...(draft.backgroundLayerOrder ?? []), ...(globalHost.layerOrder ?? [])];
    const index = hosts.indexOf(globalHost);
    if (index >= 0) hosts.splice(index, 1);
    byId.delete('global');
  }
  const hostFor = (id: string) => {
    const existing = byId.get(id);
    if (existing) return existing;
    const host: PresentationHostDef = { id, layers: [] };
    hosts.push(host);
    byId.set(id, host);
    return host;
  };
  for (const layer of presentation.layers ?? []) {
    if (!PRESENTATION_REGIONS.includes(layer.region)) continue;
    const host = hostFor(layer.region);
    host.layers = [...(host.layers ?? []), { ...layer }];
    host.layerOrder = [...(host.layerOrder ?? []), ...(layer.id ? [layer.id] : [])];
  }
  for (const panel of presentation.panels ?? []) {
    if (!PRESENTATION_REGIONS.includes(panel.region)) continue;
    const host = hostFor(panel.region);
    if (panel.opacity !== undefined) host.opacity = panel.opacity;
    if (panel.layers?.length) {
      host.layers = [...(host.layers ?? []), ...panel.layers.map(layer => ({ ...layer }))];
      host.layerOrder = [...(host.layerOrder ?? []), ...panel.layers.flatMap(layer => layer.id ? [layer.id] : [])];
    }
  }
  presentation.hosts = hosts;
  delete presentation.layers;
  delete presentation.panels;
}

const TOKEN_KEYS = new Set<UserThemeToken>(['primary', 'primaryStrong', 'bg', 'bgAlt', 'panel', 'panelAlt', 'text', 'muted', 'accent', 'danger']);
const NODE_KEYS = new Set<ThemeNodeName>(['primary', 'primaryStrong', 'bg', 'bgAlt', 'panel', 'panelLight', 'text', 'muted', 'line', 'active', 'highlight', 'success', 'warning', 'danger', 'accent', 'playerBubble', 'npcBubble']);
const REGIONS = new Set(['shell', 'header', 'leftPanel', 'centerPanel', 'rightPanel', 'footer', 'story', 'modal']);
const ANCHORS = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']);
const COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^;<>]+\)|var\(--[a-z0-9-]+\))$/i;
const TEXT_COLOR_MODES = new Set(['auto', 'light', 'dark']);

function issue(issues: string[], message: string): void { if (issues.length < 100) issues.push(message); }

function validateDraft(draft: UserThemeDraft, pics?: PicQueryPort): string[] {
  const issues: string[] = [];
  if (!draft || draft.version !== 1) issue(issues, '仅支持 version 1 的用户主题');
  if (draft?.palette && draft.palette.length > 6) issue(issues, '主题色最多 6 个');
  if (draft?.paletteUiEnabled && draft.paletteUiEnabled.length > 6) issue(issues, '主题色 UI 开关最多 6 个');
  if (draft?.paletteUiEnabled && draft.palette && draft.paletteUiEnabled.length > draft.palette.length) issue(issues, '主题色 UI 开关不能超过主题色数量');
  for (const color of draft?.palette ?? []) {
    if (typeof color !== 'string' || color.length > 128 || !COLOR.test(color.trim())) issue(issues, `非法主题色：${color}`);
  }
  for (const [key, value] of Object.entries(draft?.tokens ?? {})) {
    if (!TOKEN_KEYS.has(key as UserThemeToken)) issue(issues, `不允许的颜色 Token：${key}`);
    else if (typeof value !== 'string' || value.length > 128 || !COLOR.test(value.trim())) issue(issues, `非法颜色值：${key}`);
  }
  for (const [key, value] of Object.entries(draft?.nodes ?? {})) {
    if (!NODE_KEYS.has(key as ThemeNodeName)) issue(issues, `不允许的语义颜色节点：${key}`);
    else if (typeof value !== 'string' || value.length > 128 || !COLOR.test(value.trim())) issue(issues, `非法节点颜色：${key}`);
  }
  for (const [scope, value] of Object.entries(draft?.scopes ?? {})) {
    if (!/^(?:header|left(?:\.(?:area|contacts|story))?|center(?:\.(?:chat|log|conversation))?|right(?:\.(?:spot|character|enh|other))?|footer)$/.test(scope)) {
      issue(issues, `不允许的主题作用域：${scope}`);
      continue;
    }
    for (const [key, color] of Object.entries(value ?? {})) {
      if (!NODE_KEYS.has(key as ThemeNodeName)) issue(issues, `不允许的作用域颜色节点：${scope}.${key}`);
      else if (typeof color !== 'string' || color.length > 128 || !COLOR.test(color.trim())) issue(issues, `非法作用域节点颜色：${scope}.${key}`);
    }
  }
  const presentation = draft?.presentation;
  const background = draft?.background ?? [];
  const layers = presentation?.layers ?? [];
  const components = presentation?.components ?? [];
  const panels = presentation?.panels ?? [];
  const hosts = presentation?.hosts ?? [];
  if (layers.length > 24) issue(issues, '区域图层最多 24 个');
  if (background.length > 24) issue(issues, '全局背景图层最多 24 个');
  if ((draft?.backgroundLayerOrder?.length ?? 0) > 32) issue(issues, '全局表现层排序最多 32 项');
  if (components.length > 32) issue(issues, '组件最多 32 个');
  if (panels.length > 8) issue(issues, '面板表现最多 8 个');
  if (hosts.length > 64) issue(issues, '控件宿主表现最多 64 个');
  const hostIds = new Set<string>();
  for (const host of hosts) {
    if (!host.id || host.id.length > 96 || !/^[a-zA-Z0-9_.:-]+$/.test(host.id)) issue(issues, `非法控件宿主 ID：${host.id}`);
    if (hostIds.has(host.id)) issue(issues, `控件宿主 ID 重复：${host.id}`);
    hostIds.add(host.id);
    if (host.parent && host.parent.length > 96) issue(issues, `控件宿主父级 ID 过长：${host.id}`);
    if (host.opacity !== undefined && (!Number.isFinite(host.opacity) || host.opacity < 0 || host.opacity > 1)) issue(issues, `非法控件宿主透明度：${host.id}`);
    if (host.textColorMode !== undefined && !TEXT_COLOR_MODES.has(host.textColorMode)) issue(issues, `非法宿主文字颜色模式：${host.id}`);
    if ((host.layers?.length ?? 0) > 24) issue(issues, `控件宿主图层最多 24 个：${host.id}`);
    if ((host.layerOrder?.length ?? 0) > 32) issue(issues, `控件宿主排序最多 32 项：${host.id}`);
    for (const layer of host.layers ?? []) {
      if (layer.id && (layer.id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(layer.id))) issue(issues, `非法控件图层 ID：${host.id}.${layer.id}`);
      if (layer.kind !== 'empty' && layer.kind !== 'solid' && layer.kind !== 'gradient' && layer.kind !== 'image') issue(issues, `非法控件图层类型：${host.id}`);
      if (layer.value.length > 256 || (layer.kind !== 'image' && /[<>;]|url\s*\(|expression\s*\(/i.test(layer.value))) issue(issues, `非法控件图层值：${host.id}`);
      if (layer.kind === 'image' && pics && !pics.defOf(layer.value)) issue(issues, `控件图片资源不存在：${host.id}.${layer.value}`);
      if (layer.opacity !== undefined && (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1)) issue(issues, `非法控件图层透明度：${host.id}`);
    }
    for (const [state, stateDef] of Object.entries(host.states ?? {})) {
      if (state !== 'default' && state !== 'active' && state !== 'inactive' && state !== 'disabled') issue(issues, `非法控件状态：${host.id}.${state}`);
      if ((stateDef?.layers?.length ?? 0) > 24) issue(issues, `控件状态图层最多 24 个：${host.id}.${state}`);
      if ((stateDef?.layerOrder?.length ?? 0) > 32) issue(issues, `控件状态排序最多 32 项：${host.id}.${state}`);
      if (stateDef?.textColorMode !== undefined && !TEXT_COLOR_MODES.has(stateDef.textColorMode)) issue(issues, `非法状态文字颜色模式：${host.id}.${state}`);
      for (const layer of stateDef?.layers ?? []) {
        if (layer.id && (layer.id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(layer.id))) issue(issues, `非法控件状态图层 ID：${host.id}.${state}.${layer.id}`);
        if (layer.kind !== 'empty' && layer.kind !== 'solid' && layer.kind !== 'gradient' && layer.kind !== 'image') issue(issues, `非法控件状态图层类型：${host.id}.${state}`);
        if (layer.value.length > 256 || (layer.kind !== 'image' && /[<>;]|url\s*\(|expression\s*\(/i.test(layer.value))) issue(issues, `非法控件状态图层值：${host.id}.${state}`);
        if (layer.kind === 'image' && pics && !pics.defOf(layer.value)) issue(issues, `控件状态图片资源不存在：${host.id}.${state}.${layer.value}`);
        if (layer.opacity !== undefined && (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1)) issue(issues, `非法控件状态图层透明度：${host.id}.${state}`);
      }
    }
  }
  for (const panel of panels) {
    if (!REGIONS.has(panel.region)) issue(issues, `非法面板区域：${panel.region}`);
    if (panel.opacity !== undefined && (!Number.isFinite(panel.opacity) || panel.opacity < 0 || panel.opacity > 1)) issue(issues, `非法面板透明度：${panel.region}`);
  }
  const ids = new Set<string>();
  for (const layer of layers) {
    if (layer.id && (layer.id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(layer.id))) issue(issues, `非法图层 ID：${layer.id}`);
    if (!REGIONS.has(layer.region)) issue(issues, `非法表现区域：${layer.region}`);
    if (layer.kind !== 'empty' && layer.kind !== 'solid' && layer.kind !== 'gradient' && layer.kind !== 'image') issue(issues, '非法图层类型');
    if (layer.value.length > 256 || (layer.kind !== 'image' && /[<>;]|url\s*\(|expression\s*\(/i.test(layer.value))) issue(issues, `非法图层值：${layer.id ?? '(anonymous)'}`);
    if (layer.kind === 'image' && !layer.value.includes(':')) issue(issues, `图片必须使用已注册 Pic 引用：${layer.value}`);
    if (layer.kind === 'image' && pics && !pics.defOf(layer.value)) issue(issues, `图片资源不存在：${layer.value}`);
    if (layer.opacity !== undefined && (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1)) issue(issues, `非法图层透明度：${layer.id ?? '(anonymous)'}`);
  }
  for (const layer of background) {
    if (layer.id && (layer.id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(layer.id))) issue(issues, `非法背景图层 ID：${layer.id}`);
    if (layer.id === 'system-color-background') issue(issues, '不允许覆盖系统颜色层');
    if (layer.kind !== 'empty' && layer.kind !== 'solid' && layer.kind !== 'gradient' && layer.kind !== 'image') issue(issues, '非法背景图层类型');
    if (layer.value.length > 256 || (layer.kind !== 'image' && /[<>;]|url\s*\(|expression\s*\(/i.test(layer.value))) issue(issues, `非法背景图层值：${layer.id ?? '(anonymous)'}`);
    if (layer.kind === 'image' && !layer.value.includes(':')) issue(issues, `图片必须使用已注册 Pic 引用：${layer.value}`);
    if (layer.kind === 'image' && pics && !pics.defOf(layer.value)) issue(issues, `图片资源不存在：${layer.value}`);
    if (layer.opacity !== undefined && (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1)) issue(issues, `非法背景图层透明度：${layer.id ?? '(anonymous)'}`);
  }
  for (const component of components) {
    if (!component.id || component.id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(component.id)) issue(issues, `非法组件 ID：${component.id}`);
    if (ids.has(component.id)) issue(issues, `组件 ID 重复：${component.id}`);
    ids.add(component.id);
    if (!REGIONS.has(component.parent) && !components.some(parent => parent.id === component.parent)) issue(issues, `父级不存在：${component.parent}`);
    if (!ANCHORS.has(component.anchor)) issue(issues, `非法组件锚点：${component.id}`);
    if (component.visibleWhen) issue(issues, `用户主题不允许 visibleWhen：${component.id}`);
    if (component.asset && pics && !pics.defOf(component.asset)) issue(issues, `图片资源不存在：${component.asset}`);
    for (const value of [component.offset?.x, component.offset?.y, component.size?.width, component.size?.height]) {
      if (value !== undefined && (!Number.isFinite(value) || value < -10000 || value > 10000)) issue(issues, `组件数值超出范围：${component.id}`);
    }
  }
  for (const component of components) {
    const seen = new Set<string>(); let parent = component.parent; let depth = 0;
    while (!REGIONS.has(parent)) {
      if (seen.has(parent)) { issue(issues, `组件父级循环：${component.id}`); break; }
      seen.add(parent); depth += 1;
      parent = components.find(candidate => candidate.id === parent)?.parent ?? '';
      if (!parent || depth > 4) { issue(issues, `组件树深度超限：${component.id}`); break; }
    }
  }
  return issues;
}

export class UserThemeService {
  private sequence = 0;
  private readonly sessions = new Map<string, UserThemeEditSession>();
  constructor(
    private readonly mutations: StateMutationService,
    private readonly affectors: AffectorEngine,
    private readonly pics: PicQueryPort,
    private readonly getState: () => PlayerState,
  ) {}

  capability(): { active: boolean; sources: readonly string[] } {
    const sources = this.affectors.getActiveServiceCapabilities().get('user-theme.editor') ?? [];
    return { active: sources.length > 0, sources };
  }

  get(): Readonly<UserThemeState> { return this.getState().userTheme ?? { enabled: false, revision: 0 }; }

  beginEdit(initialPalette?: readonly string[]): UserThemeEditSession | UserThemeError {
    const capability = this.capability();
    const current = this.get();
    const draft: UserThemeDraft = current.applied
      ? structuredClone(current.applied)
      : { version: 1, palette: [initialPalette?.[0] ?? SYSTEM_DEFAULT_PRIMARY], paletteUiEnabled: [true] };
    normalizePresentationDraft(draft);
    const session: UserThemeEditSession = { id: `user-theme-${++this.sequence}`, baseRevision: current.revision, draft, readonly: !capability.active };
    this.sessions.set(session.id, session);
    return session;
  }

  apply(sessionId: string, draft: UserThemeDraft): UserThemeResult {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, code: 'session-not-found', message: '编辑会话不存在' };
    if (!this.capability().active || session.readonly) return { ok: false, code: 'capability-unavailable', message: '没有 Active Affector 提供用户主题编辑能力' };
    if (this.get().revision !== session.baseRevision) return { ok: false, code: 'revision-conflict', message: '主题已被其他编辑会话更新，请重新载入' };
    normalizePresentationDraft(draft);
    const issues = validateDraft(draft, this.pics);
    if (issues.length) return { ok: false, code: 'invalid-draft', message: '用户主题校验失败', issues };
    this.mutations.setUserTheme(draft, this.getState().userTheme ? this.get().enabled : true);
    this.sessions.delete(sessionId);
    return { ok: true, state: this.get() };
  }

  discard(sessionId: string): boolean { return this.sessions.delete(sessionId); }

  setEnabled(enabled: boolean): UserThemeResult {
    if (!this.capability().active) return { ok: false, code: 'capability-unavailable', message: '没有 Active Affector 提供用户主题编辑能力' };
    if (!this.mutations.setUserThemeEnabled(enabled)) return { ok: false, code: 'invalid-draft', message: '尚未保存用户主题' };
    return { ok: true, state: this.get() };
  }
}

export { validateDraft as validateUserThemeDraft };
