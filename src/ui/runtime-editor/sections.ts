// ============================================================
// ui/runtime-editor/sections.ts — 编辑页派生
//
// 编辑器页不在这里另写一份清单：页顺序取策略表的 `sections`，
// 字段与扩展按各自的 `section` 归属。策略表未声明页时退化为单页。
// ============================================================

import type { AuthoringExtension, ContentAuthoringPolicy, WritableFieldDef } from '../../data-services/authoring/content-policy';

export interface EditorSection {
  readonly id: string;
  readonly label: string;
  readonly fields: readonly WritableFieldDef[];
  readonly extensions: readonly AuthoringExtension[];
}

/** 从策略表派生编辑页；未声明 section 的字段 / 扩展归入首节。 */
export function editorSections(policy: ContentAuthoringPolicy): EditorSection[] {
  const defs = policy.sections?.length ? policy.sections : [{ id: 'default', label: '内容' }];
  const firstId = defs[0].id;
  return defs.map(section => ({
    id: section.id,
    label: section.label,
    fields: policy.fields.filter(field => (field.section ?? firstId) === section.id),
    extensions: (policy.extensions ?? []).filter(extension => (extension.section ?? firstId) === section.id),
  }));
}

export function firstSectionId(policy: ContentAuthoringPolicy): string {
  return editorSections(policy)[0]?.id ?? 'default';
}
