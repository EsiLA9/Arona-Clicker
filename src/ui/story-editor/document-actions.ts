import { currentAuthoringDraft, type StoryEditorState } from './model';

export type StoryDocumentAction = 'new' | 'save' | 'preview' | 'check' | 'pack' | 'apply' | 'restore' | 'rename' | 'delete';
export type StoryDocumentActions = Record<StoryDocumentAction, { visible: boolean; disabledReason?: string }>;

export function storyDocumentActions(state: StoryEditorState, facts: { entryExists: boolean; hasEditingMod: boolean }): StoryDocumentActions {
  const draft = currentAuthoringDraft(state);
  const entry = state.target?.kind === 'entry';
  const hasDocument = Boolean(state.target);
  const storageReason = state.storageBlocked ? '本地草稿存储不可用。' : undefined;
  const editReason = storageReason ?? state.readOnlyReason ?? (!draft ? '当前没有可保存的草稿。' : undefined);
  const applyReason = editReason ?? (state.canApplySource === false ? '当前来源无法应用到运行内容。' : undefined);
  const previewReason = (entry ? !facts.entryExists : !draft) ? '当前内容不可试播。'
    : draft?.packSource && state.sourceOptions && !state.sourceOptions.some(option => option.value === `pack:${draft.packSource?.packRecordId}`)
      ? '试播来源当前未载入，请在数据包管理中应用所需版本。' : undefined;
  return {
    new: { visible: true, disabledReason: storageReason ?? (!facts.hasEditingMod ? '请先在数据包管理中载入编辑态 Mod。' : undefined) },
    save: { visible: hasDocument, disabledReason: editReason },
    preview: { visible: hasDocument, disabledReason: previewReason },
    check: { visible: hasDocument, disabledReason: editReason },
    pack: { visible: hasDocument && Boolean(state.sourceOptions), disabledReason: editReason },
    apply: { visible: hasDocument, disabledReason: applyReason },
    restore: { visible: hasDocument && !entry, disabledReason: applyReason },
    rename: { visible: Boolean(draft) && !entry, disabledReason: editReason },
    delete: { visible: Boolean(draft) && !entry, disabledReason: editReason
      ?? (draft && !draft.persisted && !draft.dirty ? '当前没有需要删除的草稿。' : undefined) },
  };
}
