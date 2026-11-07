
/** Shared import/publish boundary. Never infer activation from legacy optional fields. */
export function validateStoryEntryActivation(value: unknown, partition: 'active' | 'passive', draftOnly = false): void {
  const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
  const fail = (path: string): never => { throw new Error(`${object(value) ? value.id : 'StoryEntry'}.${path} 非法`); };
  if (!object(value)) fail('entry');
  const row = value as Record<string, any>, a = row.activation;
  const keys = (v: Record<string, any>, allowed: string[], path: string) => { for (const key of Object.keys(v)) if (!allowed.includes(key)) fail(`${path}.${key}`); };
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && (draftOnly || v >= 0);
  const text = (v: unknown) => typeof v === 'string' && (draftOnly || v.trim().length > 0);
  for (const key of ['type','weight','repeatable','cooldownFrames','affectionRequired','pushAfterStory']) if (key in row) fail(key);
  if (!object(a) || !['active','random','affection'].includes(a.kind) || (a.kind === 'active') !== (partition === 'active')) fail('activation');
  if (a.kind === 'active') {
    keys(a,['kind','fallback'],'activation');
    for (const key of ['block','interruptible','leaveArea','blocksInteraction']) if (key in row) fail(key);
    if (a.fallback !== undefined) {
      if (!object(a.fallback)) fail('activation.fallback');
      if (a.fallback.kind === 'current-area') keys(a.fallback,['kind'],'activation.fallback');
      else if (a.fallback.kind === 'fixed-area' && text(a.fallback.areaId)) keys(a.fallback,['kind','areaId'],'activation.fallback');
      else fail('activation.fallback');
    }
  } else {
    if (a.cooldownFrames !== undefined && !number(a.cooldownFrames)) fail('activation.cooldownFrames');
    if (a.kind === 'random') {
      keys(a,['kind','weight','repeatable','cooldownFrames'],'activation');
      if (!number(a.weight) || typeof a.repeatable !== 'boolean') fail('activation.weight/repeatable');
    } else {
      keys(a,['kind','when','cooldownFrames'],'activation');
      if ((!draftOnly && !text(row.owner)) || !object(a.when)) fail('activation.when/owner');
      if (a.when.kind === 'level' && number(a.when.level)) keys(a.when,['kind','level'],'activation.when');
      else if (a.when.kind === 'after-story' && text(a.when.storyId)) keys(a.when,['kind','storyId'],'activation.when');
      else fail('activation.when');
    }
  }
  if (row.catalog !== undefined) {
    if (!object(row.catalog) || !text(row.catalog.category) || !text(row.catalog.part)) fail('catalog');
    keys(row.catalog,['category','part','chapter','order'],'catalog');
    if (row.catalog.chapter !== undefined && typeof row.catalog.chapter !== 'string' || row.catalog.order !== undefined && !number(row.catalog.order)) fail('catalog');
  }
  if (object(row.extra?.v) && 'storyCatalog' in row.extra.v) fail('extra.storyCatalog');
}
