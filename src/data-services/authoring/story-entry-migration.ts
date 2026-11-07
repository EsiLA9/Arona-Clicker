import { validateStoryEntryActivation } from '../validation/story-entry';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const legacyFields = ['type', 'weight', 'repeatable', 'cooldownFrames', 'affectionRequired', 'pushAfterStory'];

/** Only decoded author content is migrated; live Registry records and playback state stay strict. */
export function migrateLegacyStoryEntries(container: unknown): boolean {
  if (!record(container)) return false;
  let changed = false;
  for (const [table, partition] of [['activeStories', 'active'], ['passiveStories', 'passive']] as const) {
    const rows = container[table];
    if (!Array.isArray(rows)) continue;
    for (let index = 0; index < rows.length; index++) {
      const original: unknown = rows[index];
      if (!record(original)) continue;
      const hasLegacy = legacyFields.some(key => key in original);
      const oldCatalog = record(original.extra) && record(original.extra.v) ? original.extra.v.storyCatalog : undefined;
      if (!hasLegacy && oldCatalog === undefined) continue;
      const row = structuredClone(original);
      const fail = (message: string): never => { throw new Error(`${row.id}：${message}`); };
      if (hasLegacy) {
        if ('activation' in row) fail('新旧 Entry 字段混用，无法自动迁移');
        if (row.type !== partition) fail('旧 Entry.type 与所属列表不一致');
        if (row.affectionRequired !== undefined && row.pushAfterStory !== undefined) fail('同时配置好感等级与前置 Story，需人工选择触发方式');
        if (partition === 'active') {
          if (legacyFields.slice(1).some(key => key in row)) fail('主动 Entry 含被动触发字段');
          row.activation = { kind: 'active' };
        } else {
          if (typeof row.weight !== 'number' || !Number.isFinite(row.weight) || typeof row.repeatable !== 'boolean') fail('旧 Entry 权重或重复设置不完整');
          const when = row.pushAfterStory !== undefined ? { kind: 'after-story', storyId: row.pushAfterStory }
            : row.affectionRequired !== undefined ? { kind: 'level', level: row.affectionRequired } : undefined;
          row.activation = when ? { kind: 'affection', when } : { kind: 'random', weight: row.weight, repeatable: row.repeatable };
          if (row.cooldownFrames !== undefined) (row.activation as Record<string, unknown>).cooldownFrames = row.cooldownFrames;
        }
        for (const key of legacyFields) delete row[key];
      }
      if (oldCatalog !== undefined) {
        if ('catalog' in row) fail('新旧归档配置混用，无法自动迁移');
        if (!record(oldCatalog) || oldCatalog.t !== 'dict' || !record(oldCatalog.v)) fail('旧归档配置格式无效');
        const catalog: Record<string, unknown> = {};
        for (const [key, value] of Object.entries((oldCatalog as Record<string, unknown>).v as Record<string, unknown>)) {
          if (!['category', 'part', 'chapter', 'order'].includes(key) || !record(value)
            || (key === 'order' ? !['int', 'float'].includes(String(value.t)) : value.t !== 'str')) fail('旧归档字段无法转换');
          catalog[key] = (value as Record<string, unknown>).v;
        }
        row.catalog = catalog;
        delete ((row.extra as Record<string, unknown>).v as Record<string, unknown>).storyCatalog;
      }
      validateStoryEntryActivation(row, partition, true);
      rows[index] = row;
      changed = true;
    }
  }
  return changed;
}
