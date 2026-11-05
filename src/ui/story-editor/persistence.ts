import { validateStoryAuthoringShape } from '../../data-services/authoring/story-authoring';
import { LocalStorageAdapter, type StorageAdapter } from '../../data-services/persistence/storage-adapter';
import { cloneStory, currentAuthoringDraft, type StoryDraft, type StoryEditorState } from './model';
import { stripLegacyStoryReplies } from '../../data-services/authoring/story-definition-projection';
import type { LocalFlagInputs } from './flag-fields';
import { isStoryFlagValue } from '../../data-services/validation/story-run-flags';
import type { StoryEditorDraftState } from './model';

export const STORY_EDITOR_STORAGE_KEY = 'acprogram_story_editor_drafts';
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const localId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';
function validPresentation(value: unknown): boolean {
  return value === undefined || record(value)
    && (value.side === undefined || value.side === 'left' || value.side === 'right')
    && (value.align === undefined || ['left', 'center', 'right'].includes(String(value.align)))
    && optionalString(value.avatar)
    && (value.avatarMode === undefined || ['auto', 'hide', 'show'].includes(String(value.avatarMode)));
}
function validDocument(value: unknown): boolean {
  if (!record(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string'
    || value.startContext !== undefined && (!record(value.startContext)
      || value.startContext.type === 'area' && typeof value.startContext.areaId !== 'string'
      || value.startContext.type === 'chara' && typeof value.startContext.characterId !== 'string'
      || !['area', 'chara'].includes(String(value.startContext.type)))
    || !record(value.stages) || !Array.isArray(value.nodes)) return false;
  if (!Object.entries(value.stages).every(([key, stage]) => localId(key) && record(stage) && (stage.advance === 'auto' || stage.advance === 'input'))) return false;
  const ids = new Set<string>();
  return value.nodes.every(node => {
    if (!record(node) || !localId(node.id) || ids.has(node.id) || !optionalString(node.requiresFlag)) return false;
    ids.add(node.id);
    if (node.type === 'moveToArea') return optionalString(node.areaId);
    if (node.type === 'moveToCharaspace') return optionalString(node.characterId);
    if (node.type === 'operation') return node.action === undefined || record(node.action);
    if (node.type === 'transfer') return node.transfer === undefined || record(node.transfer);
    if (!localId(node.stageId)) return false;
    // Incomplete payloads are legal drafts; only the shape of what is already entered is constrained here.
    if (node.type === 'talklet') return record(node.content) && ['talk', 'narration'].includes(String(node.content.kind)) && optionalString(node.content.text)
      && optionalString(node.content.speaker) && optionalString(node.content.image) && validPresentation(node.presentation)
      && (node.pacing === undefined || record(node.pacing));
    if (node.type !== 'click' || !record(node.interaction)) return false;
    const interaction = node.interaction;
    if (interaction.kind === 'kizunaCard') return optionalString(interaction.buttonText); // Legacy runtime data remains round-trippable.
    if (interaction.kind === 'areaContinue') return optionalString(interaction.areaId) && optionalString(interaction.buttonText);
    return interaction.kind === 'button' ? optionalString(interaction.text)
      : interaction.kind === 'choice' ? (interaction.options === undefined || Array.isArray(interaction.options) && interaction.options.every(option => record(option) && optionalString(option.text)))
        : interaction.kind === 'entryCard' && (interaction.card === undefined || record(interaction.card) && optionalString(interaction.card.title) && optionalString(interaction.card.buttonText));
  });
}
function validFlagInputs(value: unknown, document: StoryDraft['document']): value is LocalFlagInputs | undefined {
  return value === undefined || record(value) && Object.entries(value).every(([id, input]) => document.nodes.some(node => node.id === id)
    && record(input) && ['string', 'number', 'boolean', 'null', 'structured'].includes(String(input.type)) && typeof input.text === 'string'
    && (input.type !== 'structured' || isStoryFlagValue(input.value)));
}
function validEditorState(value: unknown, document: StoryDraft['document']): value is StoryEditorDraftState | undefined {
  if (value === undefined) return true;
  if (!record(value) || value.version !== 1 || !record(value.branches) || !record(value.optionals) || !record(value.rows) || !record(value.rawInputs)
    || !record(value.optionalPaths) || !record(value.optionalBranches)) return false;
  const nodeIds = new Set(document.nodes.map(node => node.id));
  const validPath = (path: unknown): path is readonly (string | number)[] => Array.isArray(path) && path.every(part => typeof part === 'string' || Number.isInteger(part) && Number(part) >= 0);
  const validBucket = (bucket: Record<string, unknown>): boolean => Object.entries(bucket).every(([key, item]) => {
    const nodeId = key.slice(0, key.indexOf('|'));
    return key.includes('|') && nodeIds.has(nodeId) && (typeof item === 'string' || typeof item === 'boolean' || Array.isArray(item) || record(item));
  });
  if (!validBucket(value.branches) || !validBucket(value.optionals) || !validBucket(value.rows) || !validBucket(value.rawInputs)
    || !validBucket(value.optionalPaths) || !validBucket(value.optionalBranches)) return false;
  if (!Object.values(value.rows).every(rows => Array.isArray(rows) && rows.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256) && new Set(rows).size === rows.length)) return false;
  if (!Object.entries(value.optionals).every(([, enabled]) => typeof enabled === 'boolean' || typeof enabled === 'string')) return false;
  if (!Object.values(value.rawInputs).every(raw => typeof raw === 'string') || !Object.values(value.optionalPaths).every(validPath)) return false;
  if (value.literalKinds !== undefined && (!record(value.literalKinds) || !validBucket(value.literalKinds)
    || !Object.values(value.literalKinds).every(kind => kind === 'string' || kind === 'number' || kind === 'boolean'))) return false;
  if (!Object.values(value.optionalBranches).every(guards => Array.isArray(guards) && guards.every(guard => record(guard) && Array.isArray(guard.path)
    && guard.path.every(part => typeof part === 'string')
    && ['kind', 'command', 'op', 'entryType', 'mode', 'valueKind', 'type'].includes(String(guard.discriminator)) && typeof guard.value === 'string'))) return false;
  for (const name of ['sourceStageIds', 'sourceUnreferencedStageIds', 'inactiveStageIds'] as const) {
    if (value[name] !== undefined && (!Array.isArray(value[name]) || !value[name].every(localId))) return false;
  }
  return true;
}
export class StoryDraftPersistence {
  constructor(private readonly storage: StorageAdapter = new LocalStorageAdapter()) {}

  load(state: StoryEditorState): void {
    try {
      const raw = this.storage.get(STORY_EDITOR_STORAGE_KEY);
      if (raw === null) return;
      const value: unknown = JSON.parse(raw);
      if (!record(value) || value.version !== 1 || !Array.isArray(value.drafts)) throw new Error('草稿版本或结构不受支持');
      const ids = new Set<string>();
      const documentIds = new Set<string>();
      const sources = new Set<string>();
      const drafts: StoryDraft[] = [];
      let removedLegacyReplies = false;
      for (const draft of value.drafts) {
        if (!record(draft) || typeof draft.draftId !== 'string' || !draft.draftId || ids.has(draft.draftId)
          || !(draft.sourceId === null || typeof draft.sourceId === 'string') || !validDocument(draft.document)
          || typeof draft.savedAt !== 'number' || !Number.isFinite(draft.savedAt)) throw new Error('草稿数据不完整');
        if (typeof draft.sourceId === 'string' && (sources.has(draft.sourceId) || (draft.document as Record<string, unknown>).id !== draft.sourceId)) throw new Error('来源身份冲突');
        const documentId = (draft.document as Record<string, unknown>).id as string;
        if (documentIds.has(documentId)) throw new Error('Story 身份重复');
        documentIds.add(documentId);
        ids.add(draft.draftId);
        if (draft.sourceId) sources.add(draft.sourceId);
        // The envelope has been checked here; incomplete payloads remain draft nodes, never StoryDef.
        const document = cloneStory(draft.document) as StoryDraft['document'];
        removedLegacyReplies = stripLegacyStoryReplies(document) || removedLegacyReplies;
        if (!validFlagInputs(draft.localFlagInputs, document) || !validEditorState(draft.editorState, document)) throw new Error('编辑器分支输入草稿无效');
        if (draft.authoring !== undefined) validateStoryAuthoringShape(draft.authoring as never, true);
        if (draft.structuredRows !== undefined && (!record(draft.structuredRows) || !Object.values(draft.structuredRows).every(rows => Array.isArray(rows) && rows.every(id=>typeof id==='string') && new Set(rows).size===rows.length))) throw new Error('结构化行身份无效');
        if (draft.structuredInputs !== undefined && (!record(draft.structuredInputs) || !Object.values(draft.structuredInputs).every(input => record(input) && typeof input.text === 'string' && (input.error === undefined || typeof input.error === 'string')))) throw new Error('结构化输入草稿无效');
        drafts.push({ draftId: draft.draftId, sourceId: draft.sourceId, document, savedAt: draft.savedAt, dirty: false, persisted: true,
          ...(draft.localFlagInputs === undefined ? {} : { localFlagInputs: cloneStory(draft.localFlagInputs) }),
          ...(draft.editorState === undefined ? {} : { editorState: cloneStory(draft.editorState) }),
          ...(draft.authoring === undefined ? {} : { authoring: cloneStory(draft.authoring) as never }),
          ...(draft.structuredInputs === undefined ? {} : { structuredInputs: cloneStory(draft.structuredInputs) as never }),
          ...(draft.structuredRows === undefined ? {} : { structuredRows: cloneStory(draft.structuredRows) as Record<string,string[]> }) });
      }
      state.drafts = drafts;
      const current = drafts.find(draft => draft.draftId === value.currentId);
      state.target = current ? { kind: 'story', id: current.document.id } : null;
      if (removedLegacyReplies) this.save(state, true);
    } catch (error) {
      state.storageBlocked = true;
      state.error = `无法读取本地 Story 草稿，原数据已保留，请先备份并检查存储：${error instanceof Error ? error.message : String(error)}`;
    }
  }

  save(state: StoryEditorState, force = false): boolean {
    for (const draft of state.drafts) if (stripLegacyStoryReplies(draft.document)) draft.dirty = true;
    if (!force && !state.drafts.some(draft => draft.dirty)) return true;
    if (state.storageBlocked) return false;
    const savedAt = Date.now();
    const drafts = state.drafts.filter(draft => draft.persisted || draft.dirty);
    try {
      if (!drafts.every(draft => validDocument(draft.document) && validFlagInputs(draft.localFlagInputs, draft.document) && validEditorState(draft.editorState, draft.document))) throw new Error('草稿基本结构或节点身份无效');
      this.storage.set(STORY_EDITOR_STORAGE_KEY, JSON.stringify({ version: 1, currentId: currentAuthoringDraft(state)?.draftId ?? null,
        drafts: drafts.map(draft => ({ draftId: draft.draftId, sourceId: draft.sourceId, document: draft.document, savedAt: draft.dirty ? savedAt : draft.savedAt,
          ...(draft.localFlagInputs === undefined ? {} : { localFlagInputs: draft.localFlagInputs }),
          ...(draft.editorState === undefined ? {} : { editorState: draft.editorState }),
          ...(draft.authoring === undefined ? {} : { authoring: draft.authoring }),
          ...(draft.structuredInputs === undefined ? {} : { structuredInputs: draft.structuredInputs }),
          ...(draft.structuredRows === undefined ? {} : { structuredRows: draft.structuredRows }) })) }));
      for (const draft of drafts) {
        if (draft.dirty) draft.savedAt = savedAt;
        draft.dirty = false;
        draft.persisted = true;
      }
      state.error = null;
      return true;
    } catch (error) {
      state.error = `草稿保存失败，内容仍保留在当前编辑中：${error instanceof Error ? error.message : String(error)}`;
      return false;
    }
  }
}
