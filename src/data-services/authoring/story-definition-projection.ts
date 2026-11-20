import { storyEntryType, type StoryEntryDef } from '../contracts/story-entry';
import type { StoryDef } from '../contracts/story';
import { storyPerformanceIssues } from '../validation/story-performance';
import { validateStoryNodeStructure } from '../validation/story-node-structure';
import { isStoryLocalFlagAction, validStoryFlagName } from '../validation/story-run-flags';
import { validateExtraValue } from '../../engine/extra/extra-validate';
import { EXTRA_MAX_DEPTH } from '../../engine/extra/extra-core';
import { parseExtraPath } from '../../engine/extra/extra-path';
import { parseEntityId } from '../../engine/core/entity-id';
import { parsePicId } from '../contracts/pic';
import type { WorldInformationTarget, WorldInformationTargetRef } from '../../engine/contracts/world-information';
import type { WorldInformationDef } from '../contracts/world-reveal';

export interface StoryDefinitionReferences {
  stories?: ReadonlyMap<string, unknown>;
  areas?: ReadonlyMap<string, unknown>;
  areaMaps?: ReadonlyMap<string, unknown>;
  spots?: ReadonlyMap<string, unknown>;
  enhancements?: ReadonlyMap<string, unknown>;
  items?: ReadonlyMap<string, unknown>;
  inits?: ReadonlyMap<string, unknown>;
  characterVariants?: ReadonlyMap<string, unknown>;
  characters?: ReadonlyMap<string, unknown>;
  storyEntries?: ReadonlyMap<string, Pick<StoryEntryDef,'activation'>>;
  colorGroups?: ReadonlyMap<string, unknown>;
  pics?: ReadonlyMap<string, unknown>;
  funclets?: ReadonlyMap<string, unknown>;
  resources?: ReadonlyMap<string, unknown>;
  /** Presentation option ids indexed by their `type:id` entity key. */
  entityPresentationOptions?: ReadonlyMap<string, ReadonlySet<string>>;
}

export type StoryDefinitionProjectionResult =
  | { readonly ok: true; readonly story: StoryDef }
  | { readonly ok: false; readonly issues: readonly { readonly path: string; readonly message: string }[] };

type Obj = Record<string, unknown>;
const hasOwn = (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k);
const setOwn = (o: object, k: string, v: unknown): void => { Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true, writable: true }); };
const plain = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const enums = (v: unknown, values: readonly string[]): v is string => typeof v === 'string' && values.includes(v);

/** Remove retired Click-attached reply content from cloned legacy definitions and drafts. */
export function stripLegacyStoryReplies(value: unknown): boolean {
  if (!plain(value) || !Array.isArray(value.nodes)) return false;
  let changed = false;
  for (const node of value.nodes) {
    if (!plain(node) || node.type !== 'click' || !plain(node.interaction)) continue;
    const interaction = node.interaction;
    if (interaction.kind === 'button' && hasOwn(interaction, 'reply')) {
      delete interaction.reply;
      changed = true;
    } else if (interaction.kind === 'choice' && Array.isArray(interaction.options)) {
      for (const option of interaction.options) {
        if (plain(option) && hasOwn(option, 'reply')) {
          delete option.reply;
          changed = true;
        }
      }
    }
  }
  return changed;
}

/** Strictly rebuild the current StoryDef contract. No source object is modified or spread into output. */
export function projectStoryDefinition(value: unknown, refs?: StoryDefinitionReferences): StoryDefinitionProjectionResult {
  const issues: { path: string; message: string }[] = [];
  const fail = (path: string, message: string): void => { issues.push({ path, message }); };
  const object = (v: unknown, path: string, keys: readonly string[]): Obj | undefined => {
    if (!plain(v)) { fail(path, '必须是普通对象'); return undefined; }
    const own = Reflect.ownKeys(v);
    if (own.some(k => typeof k !== 'string' || !Object.prototype.propertyIsEnumerable.call(v, k))) fail(path, '不支持符号键或不可枚举属性');
    for (const k of own) if (typeof k === 'string' && !keys.includes(k)) fail(`${path}.${k}`, '未知字段');
    return v;
  };
  const dictionary = (v: unknown, path: string): Obj | undefined => {
    if (!plain(v)) { fail(path, '必须是普通字典'); return undefined; }
    const own = Reflect.ownKeys(v);
    if (own.some(k => typeof k !== 'string' || !Object.prototype.propertyIsEnumerable.call(v, k))) fail(path, '字典不支持符号键或不可枚举属性');
    return v;
  };
  const string = (v: unknown, path: string, nonEmpty = false): string => {
    if (typeof v !== 'string' || nonEmpty && !v.trim()) { fail(path, nonEmpty ? '必须是非空字符串' : '必须是字符串'); return ''; }
    return v;
  };
  const number = (v: unknown, path: string): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) { fail(path, '必须是有限数值'); return 0; }
    return v;
  };
  const bool = (v: unknown, path: string): boolean => {
    if (typeof v !== 'boolean') { fail(path, '必须是布尔值'); return false; }
    return v;
  };
  const arr = (v: unknown, path: string): unknown[] => {
    if (!Array.isArray(v)) { fail(path, '必须是数组'); return []; }
    const keys = Reflect.ownKeys(v);
    if (keys.some(k => k !== 'length' && (typeof k !== 'string' || !/^(0|[1-9]\d*)$/.test(k) || Number(k) >= v.length || !Object.prototype.propertyIsEnumerable.call(v, k)))) fail(path, '数组包含非元素自有属性');
    for (let i = 0; i < v.length; i += 1) if (!hasOwn(v, i)) fail(`${path}[${i}]`, '数组元素不能缺失');
    return v;
  };
  const ref = (table: keyof StoryDefinitionReferences, id: string, path: string, selfStory = false): void => {
    if (!refs) return;
    const map = refs[table];
    if (!map) return;
    if (!map.has(id) && !(selfStory && id === (value as Obj)?.id)) fail(path, `引用不存在：${id}`);
  };
  const copyJson = (v: unknown, path: string, active = new WeakSet<object>()): unknown => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return number(v, path);
    if (typeof v !== 'object') { fail(path, '必须是 JSON 值'); return null; }
    if (active.has(v)) { fail(path, 'JSON 值不能循环引用'); return null; }
    active.add(v);
    if (Array.isArray(v)) {
      const copied = arr(v, path).map((item, i) => copyJson(item, `${path}[${i}]`, active));
      active.delete(v);
      return copied;
    }
    if (!plain(v)) { fail(path, '必须是 JSON 值'); return null; }
    const out: Obj = {};
    for (const key of Reflect.ownKeys(v)) {
      if (typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(v, key)) { fail(path, '不支持符号键或不可枚举属性'); continue; }
      setOwn(out, key, copyJson(v[key], `${path}.${key}`, active));
    }
    active.delete(v);
    return out;
  };
  const extraValue = (v: unknown, path: string, depth = 0, active = new WeakSet<object>()): unknown => {
    if (depth > EXTRA_MAX_DEPTH) { fail(path, `Extra 嵌套超过上限 ${EXTRA_MAX_DEPTH}`); return null; }
    if (!plain(v)) { fail(path, 'Extra 值必须是标记对象'); return null; }
    if (active.has(v)) { fail(path, 'Extra 值不能循环引用'); return null; }
    active.add(v);
    const tag = v.t;
    const keys: Record<string, string[]> = { int: ['t', 'v'], float: ['t', 'v'], str: ['t', 'v'], bool: ['t', 'v'], list: ['t', 'v'], dict: ['t', 'v'] };
    if (typeof tag !== 'string' || !keys[tag]) { fail(`${path}.t`, '未知 Extra 类型'); return null; }
    object(v, path, keys[tag]);
    let out: Obj;
    if (tag === 'int' || tag === 'float') out = { t: tag, v: number(v.v, `${path}.v`) };
    else if (tag === 'str') out = { t: tag, v: string(v.v, `${path}.v`) };
    else if (tag === 'bool') out = { t: tag, v: bool(v.v, `${path}.v`) };
    else if (tag === 'list') out = { t: tag, v: arr(v.v, `${path}.v`).map((x, i) => extraValue(x, `${path}.v[${i}]`, depth + 1, active)) };
    else {
      if (!dictionary(v.v, `${path}.v`)) out = { t: tag, v: {} };
      else {
        const dict: Obj = {};
        for (const [key, child] of Object.entries(v.v as Obj)) setOwn(dict, key, extraValue(child, `${path}.v.${key}`, depth + 1, active));
        out = { t: tag, v: dict };
      }
    }
    try { for (const e of validateExtraValue(out as never)) fail(path, e); }
    catch { fail(path, 'Extra 值结构无效'); }
    active.delete(v);
    return out;
  };
  const expressionActive = new WeakSet<object>();
  const expression = (v: unknown, path: string, depth = 0): unknown => {
    if (!plain(v)) { fail(path, '表达式必须是对象'); return null; }
    if (expressionActive.has(v)) { fail(path, '表达式不能循环引用'); return null; }
    expressionActive.add(v);
    const done = (result: unknown): unknown => { expressionActive.delete(v); return result; };
    const type = v.type;
    if (type === 'const') { object(v, path, ['type', 'value']); return done({ type, value: number(v.value, `${path}.value`) }); }
    if (type === 'value') {
      object(v, path, ['type', 'value']);
      const x = object(v.value, `${path}.value`, ['type', 'source', 'params']);
      if (!x) return done({ type, value: { type: 'value', source: '', params: {} } });
      if (x.type !== 'value' || !enums(x.source, ['const', 'res', 'spotLevel', 'areaSpotCount', 'managerCount', 'funclet', 'data'])) fail(`${path}.value.source`, '未知数值来源');
      const rawParams = dictionary(x.params, `${path}.value.params`);
      if (!rawParams) return done({ type, value: { type: 'value', source: x.source, params: {} } });
      const params: Record<string, string | number> = {};
      for (const [k, p] of Object.entries(rawParams)) {
        if (typeof p !== 'string' && (typeof p !== 'number' || !Number.isFinite(p))) fail(`${path}.value.params.${k}`, '参数必须是字符串或有限数值');
        else setOwn(params, k, p);
      }
      const paramString = (name: string, table?: keyof StoryDefinitionReferences): string | undefined => {
        const p = params[name];
        if (typeof p !== 'string' || !p) { fail(`${path}.value.params.${name}`, '来源参数必须是非空字符串'); return undefined; }
        if (table) ref(table, p, `${path}.value.params.${name}`);
        return p;
      };
      switch (x.source) {
        case 'res': paramString('resource', 'resources'); break;
        case 'spotLevel': paramString('spot', 'spots'); break;
        case 'areaSpotCount': paramString('area', 'areas'); break;
        case 'managerCount': paramString('init', 'inits'); break;
        case 'funclet': paramString('funclet', 'funclets'); break;
        case 'data': {
          const p = paramString('path');
          if (p) try { parseExtraPath(p); } catch (e) { fail(`${path}.value.params.path`, (e as Error).message); }
          break;
        }
      }
      return done({ type, value: { type: 'value', source: x.source, params } });
    }
    if (['add', 'sub', 'mul', 'div', 'min', 'max', 'pow'].includes(String(type))) {
      object(v, path, ['type', 'left', 'right']);
      return done({ type, left: expression(v.left, `${path}.left`, depth + 1), right: expression(v.right, `${path}.right`, depth + 1) });
    }
    if (['floor', 'ceil', 'round'].includes(String(type))) {
      object(v, path, ['type', 'expr']); return done({ type, expr: expression(v.expr, `${path}.expr`, depth + 1) });
    }
    if (type === 'clamp') {
      object(v, path, ['type', 'expr', 'min', 'max']);
      return done({ type, expr: expression(v.expr, `${path}.expr`, depth + 1), min: expression(v.min, `${path}.min`, depth + 1), max: expression(v.max, `${path}.max`, depth + 1) });
    }
    fail(`${path}.type`, '未知表达式类型'); return done(null);
  };
  const numeric = (v: unknown, path: string): unknown => typeof v === 'number' ? number(v, path) : expression(v, path);
  const conditionActive = new WeakSet<object>();
  const condition = (v: unknown, path: string, depth = 0): unknown => {
    if (!plain(v)) { fail(path, '条件必须是对象'); return null; }
    if (conditionActive.has(v)) { fail(path, '条件不能循环引用'); return null; }
    conditionActive.add(v);
    const done = (result: unknown): unknown => { conditionActive.delete(v); return result; };
    if (v.type === 'AND' || v.type === 'OR') {
      object(v, path, ['type', 'conditions']);
      return done({ type: v.type, conditions: arr(v.conditions, `${path}.conditions`).map((c, i) => condition(c, `${path}.conditions[${i}]`, depth + 1)) });
    }
    object(v, path, ['target', 'key', 'comparator', 'value']);
    if (!enums(v.target, ['alwaysTrue', 'resource', 'spotLevel', 'manager', 'flag', 'hasEnh', 'hasTag', 'countTags', 'tagCount', 'stat', 'hasReadStory', 'hasReadStoryInRun', 'visitedStoryInChain', 'extra', 'protoStat', 'affectionLevel', 'area'])) fail(`${path}.target`, '未知条件目标');
    if (!enums(v.comparator, ['==', '!=', '>=', '<=', '>', '<'])) fail(`${path}.comparator`, '未知比较符');
    const key = string(v.key, `${path}.key`);
    if (typeof v.target === 'string') {
      const targets: Partial<Record<string, keyof StoryDefinitionReferences>> = {
        resource: 'resources', spotLevel: 'spots', manager: 'spots', hasEnh: 'enhancements',
        hasReadStory: 'stories', hasReadStoryInRun: 'stories', visitedStoryInChain: 'stories',
        protoStat: 'characters', affectionLevel: 'characterVariants', area: 'areas',
      };
      const table = targets[v.target];
      if (table) ref(table, key, `${path}.key`, ['hasReadStory', 'hasReadStoryInRun', 'visitedStoryInChain'].includes(v.target));
      if (v.target === 'extra') try { parseExtraPath(key); } catch (e) { fail(`${path}.key`, (e as Error).message); }
    }
    return done({ target: v.target, key, comparator: v.comparator, value: number(v.value, `${path}.value`) });
  };
  const conditionGroup = (v: unknown, path: string): unknown => {
    if (!plain(v) || v.type !== 'AND' && v.type !== 'OR') { fail(path, 'Choice 出现条件 showWhen 必须是 ConditionGroup'); return null; }
    return condition(v, path);
  };
  const style = (v: unknown, path: string): Obj => {
    const x = object(v, path, ['font', 'fontSize', 'color', 'background', 'backgroundColor']) ?? {};
    const out: Obj = {};
    if (hasOwn(x, 'font')) { if (!enums(x.font, ['default', 'serif', 'sans', 'mono', 'handwritten'])) fail(`${path}.font`, '字体无效'); else out.font = x.font; }
    for (const k of ['fontSize', 'color', 'backgroundColor']) if (hasOwn(x, k)) out[k] = string(x[k], `${path}.${k}`);
    if (hasOwn(x, 'background')) out.background = bool(x.background, `${path}.background`);
    return out;
  };
  const presentation = (v: unknown, path: string): Obj => {
    const x = object(v, path, ['side', 'align', 'avatar', 'avatarMode']) ?? {};
    const out: Obj = {};
    if (hasOwn(x, 'side')) { if (!enums(x.side, ['left', 'right'])) fail(`${path}.side`, 'side 无效'); else out.side = x.side; }
    if (hasOwn(x, 'align')) { if (!enums(x.align, ['left', 'right', 'center'])) fail(`${path}.align`, 'align 无效'); else out.align = x.align; }
    if (hasOwn(x, 'avatar')) {
      const avatar=string(x.avatar,`${path}.avatar`);
      if(parsePicId(avatar)&&refs?.pics&&!refs.pics.has(avatar)) fail(`${path}.avatar`,`图片引用不存在：${avatar}`);
      out.avatar=avatar;
    }
    if (hasOwn(x, 'avatarMode')) { if (!enums(x.avatarMode, ['auto', 'hide', 'show'])) fail(`${path}.avatarMode`, 'avatarMode 无效'); else out.avatarMode = x.avatarMode; }
    return out;
  };
  const pacing = (v: unknown, path: string): Obj => {
    const x = object(v, path, ['typing', 'thinking']) ?? {};
    const out: Obj = {};
    for (const key of ['typing', 'thinking']) if (hasOwn(x, key)) {
      const value = number(x[key], `${path}.${key}`);
      if (value < 0) fail(`${path}.${key}`, '节奏值不能为负数');
      out[key] = value;
    }
    return out;
  };
  const appearance = (v: unknown, path: string, click: boolean): Obj => {
    const x = object(v, path, click ? ['style'] : ['template', 'style', 'presentation']) ?? {};
    const { presentation: dialogue, ...visual } = x;
    return { ...performance(visual, path, click),
      ...(hasOwn(x, 'presentation') ? { presentation: presentation(dialogue, `${path}.presentation`) } : {}) };
  };
  const performance = (v: unknown, path: string, click: boolean): Obj => {
    const x=object(v,path,click?['style','layout']:['template','style','layout','pacing'])??{};
    const { pacing: timing, ...visual } = x;
    const out:Obj={...visual};
    if (hasOwn(x,'style')) out.style=style(x.style,`${path}.style`);
    if (plain(x.layout)) {
      out.layout={...x.layout};
      if (x.layout.mode==='positioned') for (const k of ['x','y']) (out.layout as Obj)[k]=number(x.layout[k],`${path}.layout.${k}`);
    }
    for (const issue of storyPerformanceIssues(out,click)) fail(`${path}${issue.path}`,issue.message);
    if (hasOwn(x, "pacing")) out.pacing = pacing(timing, `${path}.pacing`);
    return out;
  };
  const content = (v: unknown, path: string): Obj => {
    const x = object(v, path, ['kind', 'text', 'characterId', 'speaker', 'displayName', 'image']) ?? {};
    if (!enums(x.kind, ['talk', 'narration'])) fail(`${path}.kind`, '正文类型无效');
    const out: Obj = { kind: x.kind, text: string(x.text, `${path}.text`) };
    if (x.kind === 'talk') {
      if (hasOwn(x, 'characterId')) {
        const id = string(x.characterId, `${path}.characterId`, true);
        ref('characters', id, `${path}.characterId`); out.characterId = id;
      }
      if (hasOwn(x, 'speaker')) out.speaker = string(x.speaker, `${path}.speaker`);
      if (hasOwn(x, 'displayName')) out.displayName = string(x.displayName, `${path}.displayName`);
      if (hasOwn(x, 'image')) {
        const image = string(x.image, `${path}.image`);
        if (parsePicId(image) && refs?.pics && !refs.pics.has(image)) fail(`${path}.image`, `图片引用不存在：${image}`);
        out.image = image;
      }
    } else if (hasOwn(x, 'characterId') || hasOwn(x, 'speaker') || hasOwn(x, 'displayName') || hasOwn(x, 'image')) fail(path, '旁白不允许 characterId、speaker、displayName 或 image');
    return out;
  };
  const request = (v: unknown, path: string, card = false): Obj => {
    const x = object(v, path, ['entryId', 'entryType', 'owner', 'intent']) ?? {};
    const id = string(x.entryId, `${path}.entryId`, true);
    if (!enums(x.entryType, ['active', 'passive'])) fail(`${path}.entryType`, 'Entry 类型无效');
    if (x.owner !== null && typeof x.owner !== 'string') fail(`${path}.owner`, 'owner 必须为字符串或全局 null');
    if (!enums(x.intent, ['ordinary', 'system', 'card'])) fail(`${path}.intent`, '请求意图无效');
    if (card && (x.entryType !== 'active' || x.intent !== 'card')) fail(path, '入口卡必须请求 active/card');
    if (x.entryType === 'passive' && x.intent === 'card') fail(path, 'passive Entry 不支持 card 意图');
    if (refs?.storyEntries) {
      const actual = refs.storyEntries.get(id);
      if (!actual || storyEntryType(actual) !== x.entryType) fail(`${path}.entryId`, '目标剧情入口不存在或类型不匹配');
    }
    return { entryId: id, entryType: x.entryType, owner: x.owner, intent: x.intent };
  };
  const card = (v: unknown, path: string): Obj => {
    const x = object(v, path, ['request', 'continuation', 'title', 'buttonText', 'align']) ?? {};
    const out: Obj = { request: request(x.request, `${path}.request`, true) };
    if (hasOwn(x, 'continuation')) {
      const c = object(x.continuation, `${path}.continuation`, ['areaId', 'returnFlags']) ?? {};
      if (hasOwn(c, 'areaId')) { c.areaId = string(c.areaId, `${path}.continuation.areaId`, true); ref('areas', c.areaId as string, `${path}.continuation.areaId`); }
      if (hasOwn(c, 'returnFlags')) {
        if (!Array.isArray(c.returnFlags) || c.returnFlags.some(flag => typeof flag !== 'string' || !flag.trim()) || new Set(c.returnFlags).size !== c.returnFlags.length) fail(`${path}.continuation.returnFlags`, '回传标记必须是唯一的非空字符串');
      }
      out.continuation = c;
    }
    for (const k of ['title', 'buttonText']) if (hasOwn(x, k)) out[k] = string(x[k], `${path}.${k}`);
    if (hasOwn(x, 'align')) { if (!enums(x.align, ['left', 'right'])) fail(`${path}.align`, '对齐方式无效'); else out.align = x.align; }
    return out;
  };
  const transfer = (v: unknown, path: string): Obj | undefined => {
    if (plain(v) && Reflect.ownKeys(v).length === 0) return undefined;
    const x = object(v, path, ['mode', 'storyId']) ?? {};
    if (!enums(x.mode, ['goto', 'insert'])) fail(`${path}.mode`, 'Transfer 模式无效');
    const id = string(x.storyId, `${path}.storyId`, true); ref('stories', id, `${path}.storyId`, true);
    return { mode: x.mode, storyId: id };
  };
  const background = (v: unknown, path: string): Obj => {
    const keys = ['id', 'kind', 'value', 'opacity', 'position', 'size', 'repeat', 'blendMode', 'attachment', 'scale', 'rotation', 'enabled'];
    const x = object(v, path, keys) ?? {};
    if (!enums(x.kind, ['empty', 'solid', 'gradient', 'image'])) fail(`${path}.kind`, '背景类型无效');
    const out: Obj = { kind: x.kind, value: string(x.value, `${path}.value`) };
    if (hasOwn(x, 'id')) out.id = string(x.id, `${path}.id`);
    for (const k of ['opacity', 'scale', 'rotation']) if (hasOwn(x, k)) out[k] = number(x[k], `${path}.${k}`);
    for (const k of ['position', 'size', 'repeat', 'blendMode']) if (hasOwn(x, k)) out[k] = string(x[k], `${path}.${k}`);
    if (hasOwn(x, 'attachment')) { if (!enums(x.attachment, ['scroll', 'fixed', 'local'])) fail(`${path}.attachment`, 'attachment 无效'); else out.attachment = x.attachment; }
    if (hasOwn(x, 'enabled')) out.enabled = bool(x.enabled, `${path}.enabled`);
    if (x.kind === 'image' && typeof x.value === 'string' && parsePicId(x.value) && refs?.pics && !refs.pics.has(x.value)) fail(`${path}.value`, `图片引用不存在：${x.value}`);
    return out;
  };
  const theme = (v: unknown, path: string): Obj => {
    const x = object(v, path, ['colorGroupId', 'palette', 'tokens', 'nodes', 'background', 'scope', 'entityKey']) ?? {};
    const out: Obj = {};
    if (hasOwn(x, 'colorGroupId')) { const id = string(x.colorGroupId, `${path}.colorGroupId`, true); ref('colorGroups', id, `${path}.colorGroupId`); out.colorGroupId = id; }
    if (hasOwn(x, 'palette')) {
      const p = arr(x.palette, `${path}.palette`); if (p.length > 6) fail(`${path}.palette`, 'palette 最多六项');
      out.palette = p.map((a, i) => string(a, `${path}.palette[${i}]`));
    }
    for (const dictKey of ['tokens', 'nodes'] as const) if (hasOwn(x, dictKey)) {
      if (!dictionary(x[dictKey], `${path}.${dictKey}`)) out[dictKey] = {};
      else {
        const d: Obj = {};
        const themeNodes = ['primary', 'primaryStrong', 'bg', 'bgAlt', 'panel', 'panelLight', 'text', 'muted', 'line', 'active', 'highlight', 'success', 'warning', 'danger', 'accent', 'playerBubble', 'npcBubble'];
        for (const [k, a] of Object.entries(x[dictKey] as Obj)) {
          if (dictKey === 'nodes' && !themeNodes.includes(k)) fail(`${path}.nodes.${k}`, '未知主题语义节点');
          setOwn(d, k, string(a, `${path}.${dictKey}.${k}`));
        }
        out[dictKey] = d;
      }
    }
    if (hasOwn(x, 'background')) out.background = arr(x.background, `${path}.background`).map((a, i) => background(a, `${path}.background[${i}]`));
    if (hasOwn(x, 'scope')) { if (!enums(x.scope, ['ephemeral', 'area', 'student'])) fail(`${path}.scope`, '主题范围无效'); else out.scope = x.scope; }
    if (hasOwn(x, 'entityKey')) out.entityKey = string(x.entityKey, `${path}.entityKey`, true);
    const scope = x.scope ?? 'ephemeral';
    if (scope === 'ephemeral' && hasOwn(x, 'entityKey')) fail(`${path}.entityKey`, 'ephemeral 主题不能包含 entityKey');
    if (scope === 'area' || scope === 'student') {
      const expected = scope === 'area' ? /^area:(.+)$/ : /^variant:(.+)$/;
      const match = typeof x.entityKey === 'string' ? expected.exec(x.entityKey) : null;
      if (!match) fail(`${path}.entityKey`, `${scope} 主题必须引用匹配的实体`);
      else ref(scope === 'area' ? 'areas' : 'characterVariants', match[1], `${path}.entityKey`);
    }
    return out;
  };
  const action = (v: unknown, path: string): Obj | undefined => {
    if (!plain(v)) { fail(path, 'StoryAction 必须是对象'); return {}; }
    if (Reflect.ownKeys(v).length === 0) return undefined;
    if (v.kind === 'clearNode') {
      const x=object(v,path,['kind','storyId','nodeId'])??{};
      const storyId=string(x.storyId,`${path}.storyId`,true), nodeId=string(x.nodeId,`${path}.nodeId`,true);
      ref('stories',storyId,`${path}.storyId`,true);
      const target=storyId===(value as Obj)?.id ? (value as Obj) : refs?.stories?.get(storyId);
      if (plain(target) && (!Array.isArray(target.nodes)||!target.nodes.some(node=>plain(node)&&node.id===nodeId&&['talklet','click'].includes(String(node.type))))) fail(`${path}.nodeId`,'目标必须是现有 Talklet / Click 节点');
      return {kind:'clearNode',storyId,nodeId};
    }
    if (v.kind === 'localFlag') {
      if (!isStoryLocalFlagAction(v)) fail(path, '本次播放局部标记配置无效');
      object(v, path, v.op === 'remove' ? ['kind', 'op', 'name'] : ['kind', 'op', 'name', 'value']);
      const out: Obj = { kind: 'localFlag', op: v.op, name: string(v.name, `${path}.name`, true) };
      if (v.op === 'set') out.value = copyJson(v.value, `${path}.value`);
      return out;
    }
    if (v.kind === 'state') {
      const x = object(v, path, ['kind', 'effects']) ?? {};
      const effects = x.effects === undefined ? [] : arr(x.effects, `${path}.effects`).flatMap((item, i) => {
        const projected = stateAction(item, `${path}.effects[${i}]`);
        return projected === undefined ? [] : [projected];
      });
      if (effects.length === 0) return undefined;
      return { kind: 'state', effects };
    }
    if (v.kind === 'travel') {
      const x = object(v, path, ['kind', 'areaId', 'notice']) ?? {};
      const areaId = string(x.areaId, `${path}.areaId`, true); ref('areas', areaId, `${path}.areaId`);
      const out: Obj = { kind: 'travel', areaId };
      if (hasOwn(x, 'notice')) out.notice = bool(x.notice, `${path}.notice`);
      return out;
    }
    if (v.kind === 'entryRequest') {
      const x = object(v, path, ['kind', 'request']) ?? {};
      return { kind: 'entryRequest', request: request(x.request, `${path}.request`) };
    }
    if (v.kind === 'overlay') {
      const x = object(v, path, ['kind', 'command']) ?? {};
      return { kind: 'overlay', command: overlay(x.command, `${path}.command`) };
    }
    if (v.kind === 'presentation') {
      const x = object(v, path, ['kind', 'command']) ?? {};
      return { kind: 'presentation', command: presentationCommand(x.command, `${path}.command`) };
    }
    fail(`${path}.kind`, '未知 StoryAction 类型'); return {};
  };
  const stateAction = (v: unknown, path: string): Obj | undefined => {
    if (!plain(v)) { fail(path, '状态动作必须是对象'); return {}; }
    if (Reflect.ownKeys(v).length === 0) return undefined;
    const op = v.op;
    const fields: Record<string, string[]> = {
      setResource: ['op', 'resourceId', 'amount'], addResource: ['op', 'resourceId', 'amount'],
      setSpotLevel: ['op', 'spotId', 'amount'], addSpotLevel: ['op', 'spotId', 'amount'],
      setManager: ['op', 'spotId', 'managerId'], addEnhancement: ['op', 'enhancementId'], addItem: ['op', 'itemId', 'amount'],
      unlockInit: ['op', 'initId'], acquireAreaMap: ['op', 'mapId'], revealInformation: ['op', 'target'],
      setFlag: ['op', 'flagId', 'value'], setExtra: ['op', 'path', 'value'],
      addExtra: ['op', 'path', 'amount'], removeExtra: ['op', 'path'], grantCharacter: ['op', 'variantId'], addAffectionExp: ['op', 'variantId', 'amount'],
    };
    if (typeof op !== 'string' || !op.trim()) { fail(`${path}.op`, '请选择状态动作'); return {}; }
    if (!fields[op]) { fail(`${path}.op`, `未知 Story 状态动作：${op}`); return {}; }
    const x = object(v, path, fields[op]) ?? {};
    const out: Obj = { op };
    const stringField = (key: string, table?: keyof StoryDefinitionReferences) => {
      const id = string(x[key], `${path}.${key}`, true); if (table) ref(table, id, `${path}.${key}`); out[key] = id;
    };
    switch (op) {
      case 'setResource': case 'addResource': stringField('resourceId', 'resources'); out.amount = numeric(x.amount, `${path}.amount`); break;
      case 'setSpotLevel': case 'addSpotLevel': stringField('spotId', 'spots'); out.amount = numeric(x.amount, `${path}.amount`); break;
      case 'setManager': stringField('spotId', 'spots'); stringField('managerId', 'characters'); break;
      case 'addEnhancement': stringField('enhancementId', 'enhancements'); break;
      case 'addItem': stringField('itemId', 'items'); out.amount = numeric(x.amount, `${path}.amount`); break;
      case 'unlockInit': stringField('initId', 'inits'); break;
      case 'acquireAreaMap': stringField('mapId', 'areaMaps'); break;
      case 'revealInformation': out.target = worldInformationTarget(x.target, `${path}.target`); break;
      case 'setFlag': stringField('flagId'); out.value = flagValue(x.value, `${path}.value`); break;
      case 'setExtra': case 'addExtra': case 'removeExtra': {
        const p = string(x.path, `${path}.path`, true); out.path = p;
        try { parseExtraPath(p); } catch (e) { fail(`${path}.path`, (e as Error).message); }
        if (op === 'setExtra') out.value = extraOrLiteral(x.value, `${path}.value`);
        if (op === 'addExtra') out.amount = numeric(x.amount, `${path}.amount`);
        break;
      }
      case 'grantCharacter': case 'addAffectionExp': stringField('variantId', 'characterVariants'); if (op === 'addAffectionExp') out.amount = numeric(x.amount, `${path}.amount`); break;
    }
    return out;
  };
  const worldInformationTarget = (v: unknown, path: string): WorldInformationTargetRef => {
    if (!plain(v)) { fail(path, '世界信息目标必须是对象'); return { entityKind: 'area', entityId: '', target: 'existence' }; }
    const allowed = v.entityKind === 'area' ? ['entityKind', 'entityId', 'target']
      : v.entityKind === 'areaMap' ? ['entityKind', 'entityId', 'target']
        : v.entityKind === 'areaMapNode' ? ['entityKind', 'mapId', 'nodeId', 'target'] : ['entityKind'];
    const x = object(v, path, allowed) ?? {};
    if (!enums(x.target, ['existence', 'name', 'utility', 'condition'])) fail(`${path}.target`, '信息面无效');
    const target = (enums(x.target, ['existence', 'name', 'utility', 'condition']) ? x.target : 'existence') as WorldInformationTarget;
    if (x.entityKind === 'area') {
      const entityId = string(x.entityId, `${path}.entityId`, true);
      ref('areas', entityId, `${path}.entityId`);
      const definition = refs?.areas?.get(entityId) as { reveal?: WorldInformationDef } | undefined;
      if (definition && definition.reveal?.[target]?.mode !== 'explicit') fail(`${path}.target`, '剧情只能授予声明为 explicit 的信息面');
      return { entityKind: 'area', entityId, target };
    }
    if (x.entityKind === 'areaMap') {
      const entityId = string(x.entityId, `${path}.entityId`, true);
      ref('areaMaps', entityId, `${path}.entityId`);
      const definition = refs?.areaMaps?.get(entityId) as { reveal?: WorldInformationDef } | undefined;
      if (definition && definition.reveal?.[target]?.mode !== 'explicit') fail(`${path}.target`, '剧情只能授予声明为 explicit 的信息面');
      return { entityKind: 'areaMap', entityId, target };
    }
    if (x.entityKind === 'areaMapNode') {
      const mapId = string(x.mapId, `${path}.mapId`, true);
      const nodeId = string(x.nodeId, `${path}.nodeId`, true);
      ref('areaMaps', mapId, `${path}.mapId`);
      const map = refs?.areaMaps?.get(mapId) as { nodes?: readonly { id: string; reveal?: WorldInformationDef }[] } | undefined;
      const node = map?.nodes?.find(item => item.id === nodeId);
      if (map && !node) fail(`${path}.nodeId`, `地图节点不存在：${nodeId}`);
      if (node && node.reveal?.[target]?.mode !== 'explicit') fail(`${path}.target`, '剧情只能授予声明为 explicit 的信息面');
      return { entityKind: 'areaMapNode', mapId, nodeId, target };
    }
    fail(`${path}.entityKind`, '世界信息目标类型无效');
    return { entityKind: 'area', entityId: '', target };
  };
  const flagValue = (v: unknown, path: string): unknown => {
    if (plain(v) && typeof v.type === 'string') return expression(v, path);
    if (typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return number(v, path);
    fail(path, 'flag 值必须是字符串、数字、布尔值或数值表达式'); return null;
  };
  const extraOrLiteral = (v: unknown, path: string): unknown => {
    if (plain(v) && typeof v.t === 'string') return extraValue(v, path);
    if (plain(v) && typeof v.type === 'string') return expression(v, path);
    if (typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return number(v, path);
    fail(path, 'setExtra 值必须是 ExtraValue、字面量或数值表达式'); return null;
  };
  const overlay = (v: unknown, path: string): Obj => {
    if (!plain(v)) { fail(path, 'Overlay 命令必须是对象'); return {}; }
    if (v.command === 'clearAllTexts' || v.command === 'clearFlow') {
      object(v, path, ['command']); return { command: v.command };
    }
    if (v.command === 'clearId') {
      const x = object(v, path, ['command', 'id']) ?? {}; return { command: 'clearId', id: string(x.id, `${path}.id`, true) };
    }
    if (v.command !== 'show') { fail(`${path}.command`, '未知 Overlay 命令'); return {}; }
    const x = object(v, path, ['command', 'id', 'x', 'y', 'align', 'content']) ?? {};
    const out: Obj = { command: 'show', id: string(x.id, `${path}.id`, true), content: overlayContent(x.content, `${path}.content`) };
    for (const k of ['x', 'y']) if (hasOwn(x, k)) { const n = number(x[k], `${path}.${k}`); if (n < 0 || n > 1) fail(`${path}.${k}`, '坐标必须在 0 到 1 之间'); out[k] = n; }
    if (hasOwn(x, 'align')) { if (!enums(x.align, ['left', 'center', 'right'])) fail(`${path}.align`, '对齐方式无效'); else out.align = x.align; }
    return out;
  };
  const overlayContent = (v: unknown, path: string): Obj => {
    if (!plain(v)) { fail(path, 'Overlay 内容必须是对象'); return {}; }
    if (v.kind === 'text') {
      const x = object(v, path, ['kind', 'text', 'template', 'style']) ?? {};
      const out: Obj = { kind: 'text', text: string(x.text, `${path}.text`) };
      if (hasOwn(x, 'template')) { if (!enums(x.template, ['default', 'title', 'badge', 'note'])) fail(`${path}.template`, '文本模板无效'); else out.template = x.template; }
      if (hasOwn(x, 'style')) out.style = style(x.style, `${path}.style`);
      return out;
    }
    if (v.kind === 'message') {
      const x = object(v, path, ['kind', 'content', 'presentation', 'style']) ?? {};
      const out: Obj = { kind: 'message', content: content(x.content, `${path}.content`) };
      if (hasOwn(x, 'presentation')) out.presentation = presentation(x.presentation, `${path}.presentation`);
      if (hasOwn(x, 'style')) out.style = style(x.style, `${path}.style`);
      return out;
    }
    if (v.kind === 'entryCard') {
      const x = object(v, path, ['kind', 'card']) ?? {}; return { kind: 'entryCard', card: card(x.card, `${path}.card`) };
    }
    fail(`${path}.kind`, '未知 Overlay 内容类型'); return {};
  };
  const presentationCommand = (v: unknown, path: string): Obj => {
    if (!plain(v)) { fail(path, 'Presentation 命令必须是对象'); return {}; }
    if (v.command === 'openingTitle') {
      const x = object(v, path, ['command', 'title']) ?? {}; return { command: 'openingTitle', ...(hasOwn(x, 'title') ? { title: string(x.title, `${path}.title`) } : {}) };
    }
    if (v.command === 'theme') {
      const x = object(v, path, ['command', 'value']) ?? {}; return { command: 'theme', value: theme(x.value, `${path}.value`) };
    }
    if (v.command === 'setEntityPresentation' || v.command === 'clearEntityPresentation') {
      const set = v.command === 'setEntityPresentation';
      const x = object(v, path, set ? ['command', 'target', 'optionId', 'owner', 'lifetime'] : ['command', 'target', 'owner']) ?? {};
      const target = string(x.target, `${path}.target`, true); const match = /^(init|area|spot|enhancement|variant):(.+)$/.exec(target);
      if (!match) fail(`${path}.target`, '实体目标必须是已知的 type:id');
      else {
        const [, type, id] = match;
        ref(type === 'variant' ? 'characterVariants' : type === 'area' ? 'areas' : type === 'spot' ? 'spots' : type === 'enhancement' ? 'enhancements' : 'inits', id, `${path}.target`);
      }
    const out: Obj = { command: v.command, target, owner: string(x.owner, `${path}.owner`) };
      if (set) {
        const optionId = string(x.optionId, `${path}.optionId`, true); out.optionId = optionId;
        if (refs?.entityPresentationOptions) {
          const options = refs.entityPresentationOptions.get(target);
          if (!options || !options.has(optionId)) fail(`${path}.optionId`, `目标实体未定义表现选项：${optionId}`);
        }
        if (hasOwn(x, 'lifetime')) { if (!enums(x.lifetime, ['story', 'area', 'init', 'manual'])) fail(`${path}.lifetime`, '覆盖期限无效'); else out.lifetime = x.lifetime; }
      }
      return out;
    }
    fail(`${path}.command`, '未知 Presentation 命令'); return {};
  };
  const root = object(value, '$', ['id', 'name', 'initId', 'directoryId', 'startContext', 'nodes', 'stages', 'extra']) ?? {};
  const id = string(root.id, 'id', true);
  if (parseEntityId(id)?.type !== 'story') fail('id', '需要有效的 Story ID');
  const name = string(root.name, 'name', true);
  const initId = hasOwn(root, 'initId') ? string(root.initId, 'initId', true) : undefined;
  if (initId !== undefined) {
    if (parseEntityId(initId)?.type !== 'init') fail('initId', '需要有效的 Init ID');
    else ref('inits', initId, 'initId');
  }
  let startContext: Obj = {};
  if (plain(root.startContext) && root.startContext.type === 'area') {
    const context = object(root.startContext, 'startContext', ['type', 'areaId']) ?? {};
    const areaId = string(context.areaId, 'startContext.areaId', true);
    ref('areas', areaId, 'startContext.areaId');
    startContext = { type: 'area', areaId };
  } else if (plain(root.startContext) && root.startContext.type === 'chara') {
    const context = object(root.startContext, 'startContext', ['type', 'characterId']) ?? {};
    const characterId = string(context.characterId, 'startContext.characterId', true);
    ref('characterVariants', characterId, 'startContext.characterId');
    startContext = { type: 'chara', characterId };
  } else fail('startContext', '需要明确的 Area 或 Chara 起始场景');
  const stagesInput = dictionary(root.stages, 'stages') ?? {};
  const stages: Record<string, { advance: 'auto' | 'input' }> = {};
  for (const [stageId, stageValue] of Object.entries(stagesInput)) {
    const stage = object(stageValue, `stages.${stageId}`, ['advance']) ?? {};
    if (!enums(stage.advance, ['auto', 'input'])) fail(`stages.${stageId}.advance`, '阶段推进方式无效');
    setOwn(stages, stageId, { advance: stage.advance === 'input' ? 'input' : 'auto' });
  }
  const emptyPayloadNode = (node: Obj, type: 'operation' | 'transfer', payloadKey: 'action' | 'transfer'): boolean => {
    if (node.type !== type || typeof node.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(node.id) || hasOwn(node, 'requiresFlag')) return false;
    const keys = Reflect.ownKeys(node);
    if (keys.some(key => typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(node, key)
      || !['id', 'type', payloadKey].includes(key))) return false;
    if (!hasOwn(node, payloadKey) || node[payloadKey] === undefined) return true;
    const payload = node[payloadKey];
    return plain(payload) && Reflect.ownKeys(payload).length === 0;
  };
  const emptyStateOperation = (node: Obj): boolean => {
    if (node.type !== 'operation' || typeof node.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(node.id) || hasOwn(node, 'requiresFlag')) return false;
    const nodeKeys = Reflect.ownKeys(node);
    if (nodeKeys.some(key => typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(node, key)
      || !['id', 'type', 'action'].includes(key))) return false;
    const value = node.action;
    if (!plain(value) || value.kind !== 'state') return false;
    const actionKeys = Reflect.ownKeys(value);
    return !actionKeys.some(key => typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(value, key)
      || !['kind', 'effects'].includes(key));
  };
  const nodes = arr(root.nodes, 'nodes').flatMap((nodeValue, index) => {
    const p = `nodes[${index}]`;
    if (!plain(nodeValue)) { fail(p, 'StoryNode 必须是对象'); return [{} as Obj]; }
    const type = nodeValue.type;
    const common = ['id', 'type', 'requiresFlag'];
    const base = { id: string(nodeValue.id, `${p}.id`, true), type } as Obj;
    if (hasOwn(nodeValue, 'requiresFlag')) {
      const flag = string(nodeValue.requiresFlag, `${p}.requiresFlag`, true);
      if (!validStoryFlagName(flag)) fail(`${p}.requiresFlag`, 'requiresFlag 必须是非空局部标记名');
      base.requiresFlag = flag;
    }
    if (type === 'moveToArea' || type === 'moveToCharaspace') {
      const key = type === 'moveToArea' ? 'areaId' : 'characterId';
      const x = object(nodeValue, p, [...common, key]) ?? {};
      base[key] = string(x[key], `${p}.${key}`, true);
      ref(type === 'moveToArea' ? 'areas' : 'characterVariants', base[key] as string, `${p}.${key}`);
      return [base];
    }
    if (type === 'talklet') {
      const x = object(nodeValue, p, [...common, 'stageId', 'content', 'presentation', 'pacing', 'appearance', 'performance']) ?? {};
      base.stageId = string(x.stageId, `${p}.stageId`, true); base.content = content(x.content, `${p}.content`);
      if (hasOwn(x,'performance')) base.performance=performance(x.performance,`${p}.performance`,false);
      if (hasOwn(x,'appearance')) base.appearance=appearance(x.appearance,`${p}.appearance`,false);
      if (hasOwn(x, 'presentation')) base.presentation = presentation(x.presentation, `${p}.presentation`);
      if (hasOwn(x, 'pacing')) base.pacing = pacing(x.pacing, `${p}.pacing`);
      return base;
    }
    if (type === 'click') {
      const x = object(nodeValue, p, [...common, 'stageId', 'interaction', 'appearance', 'performance']) ?? {};
      if (hasOwn(x,'performance')) base.performance=performance(x.performance,`${p}.performance`,true);
      if (hasOwn(x,'appearance')) base.appearance=appearance(x.appearance,`${p}.appearance`,true);
      base.stageId = string(x.stageId, `${p}.stageId`, true); base.interaction = interaction(x.interaction, `${p}.interaction`); return base;
    }
    if (type === 'operation') {
      if (emptyPayloadNode(nodeValue, 'operation', 'action')) return [];
      const x = object(nodeValue, p, [...common, 'action']) ?? {};
      const projected = action(x.action, `${p}.action`);
      if (projected === undefined) {
        if (emptyStateOperation(nodeValue)) return [];
        fail(`${p}.action`, 'Operation 必须配置非空动作'); return [base];
      }
      base.action = projected; return [base];
    }
    if (type === 'transfer') {
      if (emptyPayloadNode(nodeValue, 'transfer', 'transfer')) return [];
      const x = object(nodeValue, p, [...common, 'transfer']) ?? {};
      const projected = transfer(x.transfer, `${p}.transfer`);
      if (projected === undefined) { fail(`${p}.transfer`, 'Transfer 必须配置目标'); return [base]; }
      base.transfer = projected; return [base];
    }
    fail(`${p}.type`, '未知 StoryNode 类型'); return [base];
  });
  function interaction(v: unknown, path: string): Obj {
    if (!plain(v)) { fail(path, 'Click interaction 必须是对象'); return {}; }
    if (v.kind === 'button') {
      // `reply` is a retired author field. Accept old documents at the boundary, but never project it.
      const x = object(v, path, ['kind', 'text', 'press', 'reply', 'result']) ?? {};
      const out: Obj = { kind: 'button', text: string(x.text, `${path}.text`, true) };
      if (hasOwn(x, 'press') && !(plain(x.press) && Reflect.ownKeys(x.press).length === 0)) {
        const press = object(x.press, `${path}.press`, ['base', 'rand']) ?? {};
        const base = number(press.base, `${path}.press.base`); if (!Number.isSafeInteger(base) || base < 1) fail(`${path}.press.base`, '必须是正安全整数');
        const pressOut: Obj = { base };
        if (hasOwn(press, 'rand')) { const rand = number(press.rand, `${path}.press.rand`); if (!Number.isSafeInteger(rand) || rand < 0) fail(`${path}.press.rand`, '必须是非负安全整数'); else if (Number.isSafeInteger(base) && !Number.isSafeInteger(base + Math.max(rand - 1, 0))) fail(`${path}.press`, '总按击数超出安全整数范围'); pressOut.rand = rand; }
        out.press = pressOut;
      }
      if (hasOwn(x, 'result')) fail(`${path}.result`, '按钮不再支持 result；请改用后续 Operation、Transfer 或移动节点');
      return out;
    }
    if (v.kind === 'choice') {
      const x = object(v, path, ['kind', 'options', 'sharedActions']) ?? {};
      if (hasOwn(x, 'sharedActions')) fail(`${path}.sharedActions`, 'Choice 不再支持 sharedActions');
      const out: Obj = { kind: 'choice', options: arr(x.options, `${path}.options`).map((optionValue, i) => {
        const p = `${path}.options[${i}]`;
        const option = object(optionValue, p, ['id', 'text', 'showWhen', 'requiresFlag', 'marks', 'reply', 'condition', 'result']) ?? {};
        if (hasOwn(option, 'condition')) fail(`${p}.condition`, 'Choice option 不再支持 condition，请使用 showWhen');
        if (hasOwn(option, 'result')) fail(`${p}.result`, 'Choice option 不再支持 result；请使用 marks 与独立后续节点');
        const o: Obj = { id: string(option.id, `${p}.id`, true), text: string(option.text, `${p}.text`) };
        if (hasOwn(option, 'showWhen')) o.showWhen = conditionGroup(option.showWhen, `${p}.showWhen`);
        if (hasOwn(option, 'requiresFlag')) {
          const flag = string(option.requiresFlag, `${p}.requiresFlag`, true);
          if (!validStoryFlagName(flag)) fail(`${p}.requiresFlag`, 'requiresFlag 必须是非空局部标记名');
          o.requiresFlag = flag;
        }
        if (hasOwn(option, 'marks')) o.marks = arr(option.marks, `${p}.marks`).map((mark, j) => {
          const flag = string(mark, `${p}.marks[${j}]`, true);
          if (!validStoryFlagName(flag)) fail(`${p}.marks[${j}]`, '选择标记必须是非空局部标记名');
          return flag;
        });
        return o;
      }) };
      return out;
    }
    if (v.kind === 'entryCard') {
      const x = object(v, path, ['kind', 'card']) ?? {}; return { kind: 'entryCard', card: card(x.card, `${path}.card`) };
    }
    if (v.kind === 'kizunaCard') {
      const x = object(v, path, ['kind', 'buttonText']) ?? {};
      return { kind: 'kizunaCard', ...(hasOwn(x, 'buttonText') ? { buttonText: string(x.buttonText, `${path}.buttonText`, true) } : {}) };
    }
    if (v.kind === 'areaContinue') {
      const x = object(v, path, ['kind', 'areaId', 'buttonText']) ?? {};
      const areaId = string(x.areaId, `${path}.areaId`, true);
      ref('areas', areaId, `${path}.areaId`);
      return { kind: 'areaContinue', areaId, ...(hasOwn(x, 'buttonText') ? { buttonText: string(x.buttonText, `${path}.buttonText`, true) } : {}) };
    }
    fail(`${path}.kind`, '未知 Click interaction 类型'); return {};
  }
  const out: Obj = { id, name, startContext, nodes, stages };
  if (initId !== undefined) out.initId = initId;
  if (hasOwn(root, 'directoryId')) out.directoryId = string(root.directoryId, 'directoryId', true);
  if (hasOwn(root, 'extra')) {
    const e = extraValue(root.extra, 'extra');
    if (plain(e) && e.t !== 'dict') fail('extra', 'Story extra 必须是 dict');
    out.extra = e;
  }
  // Compatibility stage references, node identity and click-specific rules are checked against the reconstructed document.
  if (issues.length === 0) {
    const structure = validateStoryNodeStructure(out as unknown as StoryDef);
    for (const issue of structure.issues) fail(issue.path, issue.message);
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, story: out as unknown as StoryDef };
}
