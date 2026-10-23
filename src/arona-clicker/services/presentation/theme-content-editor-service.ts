import type { Datapack } from '../../../data-services/contracts/datapack';
import type { ColorGroupDef, ThemeDesignDef } from '../../../data-services/contracts/color';
import type { EntityPresentationDef } from '../../../data-services/contracts/entity-presentation';
import { packEditingMode, storedPackContentDigest, type PackManager, type StoredPack } from '../../../data-services/datapack/pack-manager';
import type { ThemeLayer } from '../../../engine/core/theme-runtime';
import type { ThemeDef } from '../../../engine/types/theme';
import { resolveTheme, themeContributionFromThemeDef, type ColorSystem } from '../progression/color-system';

export type EditableThemeContentKind = 'color-group' | 'theme-design' | 'theme-def';
export type EditableThemeContent = ColorGroupDef | ThemeDesignDef | ThemeDef;
export type ThemeDefOwnerTable = 'inits' | 'areas' | 'spots' | 'enhancements' | 'colorEquipments' | 'themeDesigns' | 'shops' | 'characterVariants';
export type ThemeDefOwnerPath =
  | { readonly kind: 'field' }
  | { readonly kind: 'presentation-default' }
  | { readonly kind: 'presentation-addition'; readonly optionId: string };

export interface ThemeContentTarget {
  readonly packRecordId: string;
  readonly kind: EditableThemeContentKind;
  readonly contentId: string;
  /** `theme-def` 将 ThemeDef 精确定位到 Datapack 内容字段或实体表现项。 */
  readonly owner?: { readonly table: ThemeDefOwnerTable; readonly path: ThemeDefOwnerPath };
  /** 可选运行时来源键；提供后编辑预览在该来源的原优先级替换它。 */
  readonly replacesSourceId?: string;
}

export interface ThemeContentEditSession {
  readonly sessionId: string;
  readonly target: ThemeContentTarget;
  readonly source: {
    readonly kind: EditableThemeContentKind;
    readonly packRecordId: string;
    readonly contentId: string;
    readonly editable: true;
    readonly version: string;
  };
  readonly draft: EditableThemeContent;
}

export type ThemeContentEditorErrorCode = 'source-not-found' | 'target-must-be-editing' | 'theme-content-not-found' | 'content-conflict' | 'invalid-draft' | 'save-failed';

export type ThemeContentEditorResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ThemeContentEditorErrorCode; readonly message: string };

export interface ThemeContentEditorServiceOptions {
  getPackManager(): PackManager;
  colorSystem: ColorSystem;
  persistPackManagerSnapshot(): void;
}

interface InternalSession {
  readonly target: ThemeContentTarget;
  readonly baseDigest: string;
  readonly draft: EditableThemeContent;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

interface ThemeOwnerRecord {
  readonly id: string;
  readonly theme?: ThemeDef;
  readonly presentation?: EntityPresentationDef;
}

function ownerEntries(datapack: Datapack, table: ThemeDefOwnerTable): readonly ThemeOwnerRecord[] {
  switch (table) {
    case 'inits': return datapack.inits;
    case 'areas': return datapack.areas;
    case 'spots': return datapack.spots;
    case 'enhancements': return datapack.enhancements;
    case 'colorEquipments': return datapack.colorEquipments ?? [];
    case 'themeDesigns': return datapack.themeDesigns ?? [];
    case 'shops': return datapack.shops ?? [];
    case 'characterVariants': return datapack.characterVariants ?? [];
  }
}

function themeAt(owner: ThemeOwnerRecord, path: ThemeDefOwnerPath): ThemeDef | undefined {
  if (path.kind === 'field') return owner.theme;
  if (path.kind === 'presentation-default') return owner.presentation?.default.theme;
  return owner.presentation?.additions?.find(option => option.id === path.optionId)?.override.theme;
}

function findContent(pack: StoredPack, target: ThemeContentTarget): EditableThemeContent | undefined {
  const { kind, contentId } = target;
  if (kind === 'color-group') return pack.datapack.colorGroups?.find(item => item.id === contentId);
  if (kind === 'theme-design') return pack.datapack.themeDesigns?.find(item => item.id === contentId);
  if (!target.owner) return undefined;
  const owner = ownerEntries(pack.datapack, target.owner.table).find(item => item.id === contentId);
  return owner ? themeAt(owner, target.owner.path) : undefined;
}

function replaceOwnerEntries(datapack: Datapack, table: ThemeDefOwnerTable, entries: readonly ThemeOwnerRecord[]): Datapack {
  switch (table) {
    case 'inits': return { ...datapack, inits: entries as Datapack['inits'] };
    case 'areas': return { ...datapack, areas: entries as Datapack['areas'] };
    case 'spots': return { ...datapack, spots: entries as Datapack['spots'] };
    case 'enhancements': return { ...datapack, enhancements: entries as Datapack['enhancements'] };
    case 'colorEquipments': return { ...datapack, colorEquipments: entries as NonNullable<Datapack['colorEquipments']> };
    case 'themeDesigns': return { ...datapack, themeDesigns: entries as NonNullable<Datapack['themeDesigns']> };
    case 'shops': return { ...datapack, shops: entries as NonNullable<Datapack['shops']> };
    case 'characterVariants': return { ...datapack, characterVariants: entries as NonNullable<Datapack['characterVariants']> };
  }
}

function updateOwnerTheme(owner: ThemeOwnerRecord, path: ThemeDefOwnerPath, theme: ThemeDef): ThemeOwnerRecord {
  if (path.kind === 'field') return { ...owner, theme: clone(theme) };
  const presentation = owner.presentation;
  if (!presentation) throw new Error('目标实体没有表现内容。');
  if (path.kind === 'presentation-default') {
    if (!presentation.default.theme) throw new Error('目标默认表现没有主题。');
    return { ...owner, presentation: { ...presentation, default: { ...presentation.default, theme: clone(theme) } } };
  }
  const additions = presentation.additions ?? [];
  if (!additions.some(option => option.id === path.optionId && option.override.theme)) throw new Error('目标附加表现主题已不存在。');
  return {
    ...owner,
    presentation: {
      ...presentation,
      additions: additions.map(option => option.id === path.optionId
        ? { ...option, override: { ...option.override, theme: clone(theme) } }
        : option),
    },
  };
}

function replaceContent(datapack: Datapack, target: ThemeContentTarget, draft: EditableThemeContent): Datapack {
  const { kind, contentId } = target;
  if (kind === 'color-group') {
    const entries = datapack.colorGroups ?? [];
    if (!entries.some(item => item.id === contentId)) throw new Error('目标 ColorGroup 已不存在。');
    return { ...datapack, colorGroups: entries.map(item => item.id === contentId ? clone(draft as ColorGroupDef) : item) };
  }
  if (kind === 'theme-def') {
    if (!target.owner) throw new Error('ThemeDef 编辑目标缺少 owner 定位信息。');
    const entries = ownerEntries(datapack, target.owner.table);
    const owner = entries.find(item => item.id === contentId);
    if (!owner || !themeAt(owner, target.owner.path)) throw new Error('目标 ThemeDef 已不存在。');
    const updated = entries.map(item => item.id === contentId ? updateOwnerTheme(item, target.owner!.path, draft as ThemeDef) : item);
    return replaceOwnerEntries(datapack, target.owner.table, updated);
  }
  const entries = datapack.themeDesigns ?? [];
  if (!entries.some(item => item.id === contentId)) throw new Error('目标 ThemeDesign 已不存在。');
  return { ...datapack, themeDesigns: entries.map(item => item.id === contentId ? clone(draft as ThemeDesignDef) : item) };
}

/**
 * 面向一般 Datapack 编辑态主题定义的 source-aware 编辑服务。
 * 草稿与预览不写运行状态；保存只回写指定 editing Pack，并由 PackManager snapshot owner 持久化。
 */
export class ThemeContentEditorService {
  private readonly sessions = new Map<string, InternalSession>();
  private activePreviewSessionId: string | null = null;
  private sequence = 0;

  constructor(private readonly options: ThemeContentEditorServiceOptions) {}

  beginEdit(target: ThemeContentTarget): ThemeContentEditorResult<ThemeContentEditSession> {
    const pack = this.options.getPackManager().getPack(target.packRecordId);
    if (!pack) return { ok: false, code: 'source-not-found', message: `编辑目标数据包不存在：${target.packRecordId}` };
    if (packEditingMode(pack) !== 'editing') return { ok: false, code: 'target-must-be-editing', message: '一般主题定义只能从编辑态数据包打开。' };
    if (target.kind === 'theme-def' && !target.owner) return { ok: false, code: 'invalid-draft', message: 'ThemeDef 编辑目标必须提供 owner 表与字段路径。' };
    const content = findContent(pack, target);
    if (!content) return { ok: false, code: 'theme-content-not-found', message: `编辑态数据包中不存在目标主题：${target.contentId}` };
    const sessionId = `theme-content-edit:${++this.sequence}`;
    const baseDigest = storedPackContentDigest(pack);
    const normalizedTarget = { ...target };
    const draft = clone(content);
    this.sessions.set(sessionId, { target: normalizedTarget, baseDigest, draft });
    return {
      ok: true,
      value: {
        sessionId,
        target: normalizedTarget,
        source: { kind: target.kind, packRecordId: target.packRecordId, contentId: target.contentId, editable: true, version: baseDigest },
        draft: clone(draft),
      },
    };
  }

  preview(sessionId: string, draft?: EditableThemeContent): ThemeContentEditorResult<void> {
    const checked = this.currentSession(sessionId, draft);
    if (!checked.ok) return checked;
    const { session, pack, value } = checked.value;
    const layer = this.previewLayer(session.target, value, pack);
    this.options.colorSystem.setExclusiveThemePreview(layer);
    this.activePreviewSessionId = sessionId;
    return { ok: true, value: undefined };
  }

  save(sessionId: string, draft?: EditableThemeContent): ThemeContentEditorResult<{ readonly content: EditableThemeContent; readonly version: string }> {
    const checked = this.currentSession(sessionId, draft);
    if (!checked.ok) return checked;
    const { session, pack, value } = checked.value;
    let datapack: Datapack;
    try {
      datapack = replaceContent(pack.datapack, session.target, value);
    } catch (error) {
      return { ok: false, code: 'theme-content-not-found', message: error instanceof Error ? error.message : String(error) };
    }
    const saved: StoredPack = { ...pack, datapack, contentDigest: undefined };
    try {
      this.options.getPackManager().savePack(saved);
      this.options.persistPackManagerSnapshot();
    } catch (error) {
      return { ok: false, code: 'save-failed', message: error instanceof Error ? error.message : String(error) };
    }
    const version = storedPackContentDigest(saved);
    this.sessions.delete(sessionId);
    if (this.activePreviewSessionId === sessionId) {
      this.options.colorSystem.setExclusiveThemePreview(null);
      this.activePreviewSessionId = null;
    }
    return { ok: true, value: { content: clone(value), version } };
  }

  cancel(sessionId: string): void {
    this.sessions.delete(sessionId);
    if (this.activePreviewSessionId === sessionId) {
      this.options.colorSystem.setExclusiveThemePreview(null);
      this.activePreviewSessionId = null;
    }
  }

  private currentSession(sessionId: string, draft?: EditableThemeContent): ThemeContentEditorResult<{ session: InternalSession; pack: StoredPack; value: EditableThemeContent }> {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, code: 'source-not-found', message: '主题编辑会话不存在或已结束。' };
    const pack = this.options.getPackManager().getPack(session.target.packRecordId);
    if (!pack) return { ok: false, code: 'source-not-found', message: `编辑目标数据包不存在：${session.target.packRecordId}` };
    if (packEditingMode(pack) !== 'editing') return { ok: false, code: 'target-must-be-editing', message: '目标数据包已不再是编辑态，拒绝预览或保存。' };
    if (storedPackContentDigest(pack) !== session.baseDigest) {
      return { ok: false, code: 'content-conflict', message: '编辑态数据包在会话开始后已变化；请重新打开主题以避免覆盖其他内容。' };
    }
    const current = findContent(pack, session.target);
    if (!current) return { ok: false, code: 'theme-content-not-found', message: `编辑态数据包中不存在目标主题：${session.target.contentId}` };
    const value = clone(draft ?? session.draft);
    const isObject = !!value && typeof value === 'object';
    const isMatchingKind = isObject && (session.target.kind === 'color-group'
      ? 'slots' in value && Array.isArray(value.slots) && 'compositionType' in value
      : session.target.kind === 'theme-design'
        ? 'theme' in value && !!value.theme && typeof value.theme === 'object'
        : !('id' in value));
    const stableIdMatches = session.target.kind === 'theme-def'
      || (value as ColorGroupDef | ThemeDesignDef).id === session.target.contentId;
    if (!value || typeof value !== 'object' || !stableIdMatches || !isMatchingKind) {
      return { ok: false, code: 'invalid-draft', message: '主题草稿必须保留目标内容的稳定 ID。' };
    }
    return { ok: true, value: { session, pack, value } };
  }

  private previewLayer(target: ThemeContentTarget, draft: EditableThemeContent, pack: StoredPack): ThemeLayer {
    const getGroup = (id: string) => pack.datapack.colorGroups?.find(group => group.id === id) ?? this.options.colorSystem.getGroup(id);
    if (target.kind === 'color-group') {
      const group = draft as ColorGroupDef;
      return {
        id: `theme-content-preview:${target.kind}:${target.contentId}`,
        sourceId: `theme-content-preview:${target.kind}:${target.contentId}`,
        replacesSourceId: target.replacesSourceId,
        scope: 'ephemeral',
        tokens: resolveTheme(group),
        palette: group.slots.map(slot => slot.color),
        systemColorLayerIgnored: group.systemColorLayerIgnored,
      };
    }
    const theme = target.kind === 'theme-design' ? (draft as ThemeDesignDef).theme : draft as ThemeDef;
    const group = theme.colorGroupId ? getGroup(theme.colorGroupId) : undefined;
    return {
      id: `theme-content-preview:${target.kind}:${target.contentId}`,
      sourceId: `theme-content-preview:${target.kind}:${target.contentId}`,
      replacesSourceId: target.replacesSourceId,
      scope: 'ephemeral',
      tokens: themeContributionFromThemeDef(theme, getGroup),
      palette: theme.palette?.length ? theme.palette : group?.slots.map(slot => slot.color),
      nodeOverrides: theme.nodes,
      background: theme.background,
      backgroundLayerOrder: theme.presentation?.hosts?.find(host => host.id === 'global')?.layerOrder,
      systemColorLayerIgnored: theme.systemColorLayerIgnored ?? group?.systemColorLayerIgnored,
      presentation: theme.presentation,
    };
  }
}
