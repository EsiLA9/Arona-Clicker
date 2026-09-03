import type { AffectorEngine } from '../../engine/effect/affector-engine';
import type { StateMutationService } from '../state/state-mutation-service';
import type { UserThemeDraft, UserThemeState, UserThemeToken } from '../types/user-theme';
import type { PlayerState } from '../types/state';
import type { PicQueryPort } from '../contracts/pic-query';

export type UserThemeErrorCode = 'capability-unavailable' | 'invalid-draft' | 'revision-conflict' | 'session-not-found';
export interface UserThemeError { ok: false; code: UserThemeErrorCode; message: string; issues?: string[] }
export interface UserThemeOk { ok: true; state: Readonly<UserThemeState> }
export type UserThemeResult = UserThemeOk | UserThemeError;
export interface UserThemeEditSession { id: string; baseRevision: number; draft: UserThemeDraft; readonly: boolean }

const TOKEN_KEYS = new Set<UserThemeToken>(['primary', 'primaryStrong', 'bg', 'bgAlt', 'panel', 'panelAlt', 'text', 'muted', 'accent', 'danger']);
const REGIONS = new Set(['shell', 'header', 'leftPanel', 'centerPanel', 'rightPanel', 'footer', 'story', 'modal']);
const ANCHORS = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']);
const COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^;<>]+\)|var\(--[a-z0-9-]+\))$/i;

function issue(issues: string[], message: string): void { if (issues.length < 100) issues.push(message); }

function validateDraft(draft: UserThemeDraft, pics?: PicQueryPort): string[] {
  const issues: string[] = [];
  if (!draft || draft.version !== 1) issue(issues, '仅支持 version 1 的用户主题');
  for (const [key, value] of Object.entries(draft?.tokens ?? {})) {
    if (!TOKEN_KEYS.has(key as UserThemeToken)) issue(issues, `不允许的颜色 Token：${key}`);
    else if (typeof value !== 'string' || value.length > 128 || !COLOR.test(value.trim())) issue(issues, `非法颜色值：${key}`);
  }
  const presentation = draft?.presentation;
  const layers = presentation?.layers ?? [];
  const components = presentation?.components ?? [];
  if (layers.length > 24) issue(issues, '区域图层最多 24 个');
  if (components.length > 32) issue(issues, '组件最多 32 个');
  const ids = new Set<string>();
  for (const layer of layers) {
    if (layer.id && (layer.id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(layer.id))) issue(issues, `非法图层 ID：${layer.id}`);
    if (!REGIONS.has(layer.region)) issue(issues, `非法表现区域：${layer.region}`);
    if (layer.kind !== 'solid' && layer.kind !== 'gradient' && layer.kind !== 'image') issue(issues, '非法图层类型');
    if (layer.value.length > 256 || (layer.kind !== 'image' && /[<>;]|url\s*\(|expression\s*\(/i.test(layer.value))) issue(issues, `非法图层值：${layer.id ?? '(anonymous)'}`);
    if (layer.kind === 'image' && !layer.value.includes(':')) issue(issues, `图片必须使用已注册 Pic 引用：${layer.value}`);
    if (layer.kind === 'image' && pics && !pics.defOf(layer.value)) issue(issues, `图片资源不存在：${layer.value}`);
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

  beginEdit(): UserThemeEditSession | UserThemeError {
    const capability = this.capability();
    const current = this.get();
    const draft: UserThemeDraft = current.applied ? structuredClone(current.applied) : { version: 1 };
    const session: UserThemeEditSession = { id: `user-theme-${++this.sequence}`, baseRevision: current.revision, draft, readonly: !capability.active };
    this.sessions.set(session.id, session);
    return session;
  }

  apply(sessionId: string, draft: UserThemeDraft): UserThemeResult {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, code: 'session-not-found', message: '编辑会话不存在' };
    if (!this.capability().active || session.readonly) return { ok: false, code: 'capability-unavailable', message: '没有 Active Affector 提供用户主题编辑能力' };
    if (this.get().revision !== session.baseRevision) return { ok: false, code: 'revision-conflict', message: '主题已被其他编辑会话更新，请重新载入' };
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
