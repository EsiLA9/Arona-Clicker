import { renderLocalFlagNaviButton } from './local-flag-navi';
import { STORY_AUTHORING_MAX_DEPTH } from '../../data-services/authoring/story-authoring';
import { storyReferenceOptions, type StoryReferenceKind } from './property-options';
import type { UIContext } from '../runtime/context';

export type ValuePath = readonly (string | number)[];
export interface StructuredInput { text: string; error?: string }
export type StructuredInputs = Record<string, StructuredInput>;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const safe = (key: string) => key.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(key);
export const valueAt = (root: unknown, path: ValuePath): unknown => path.reduce<unknown>((v, p) => Array.isArray(v) || object(v) ? (v as Record<string | number, unknown>)[p] : undefined, root);
/** Draft-only mutation. Never traverses a prototype or silently overwrites a sibling key. */
export function setValueAt(root: unknown, path: ValuePath, value: unknown, remove = false): boolean {
  if (!path.length || path.some(p => typeof p === 'string' && !safe(p))) return false;
  const parent = valueAt(root, path.slice(0, -1)); const last = path[path.length - 1];
  if (Array.isArray(parent) && typeof last === 'number' && Number.isInteger(last) && last >= 0 && last <= parent.length) {
    if (remove) parent.splice(last, 1); else parent[last] = value;
  } else if (object(parent) && typeof last === 'string') {
    if (remove) delete parent[last]; else Object.defineProperty(parent, last, { value, enumerable: true, writable: true, configurable: true });
  } else return false;
  return true;
}

export const VALUE_PRESETS = {
  string: { label: '文字', value: '' }, number: { label: '数字', value: 0 }, boolean: { label: '布尔', value: false },
  null: { label: '空值', value: null }, object: { label: '对象', value: {} }, array: { label: '列表', value: [] },
  'condition-group': { label: '条件组', value: {type:'AND',conditions:[]} },
  condition: { label: '条件', value: {target:'alwaysTrue',key:'',comparator:'==',value:1} },
  effect: { label: '效果', value: {op:'addResource',target:'',value:0} },
  reaction: { label: '完结反应', value: {id:'reaction',activation:'after-completion',lifetime:'current-init',on:{kind:'area',areaId:''},effects:[],once:true} },
  followup: { label: '独立后续', value: {id:'followup',waitFor:{kind:'next-enter-area',areaId:''},outcome:{kind:'start-story-entry',storyEntryId:''}} },
  'pool-child': { label: '被动池子项', value: {id:'',weight:1} },
  const: { label: '表达式：常量', value: { type: 'const', value: 0 } },
  value: { label: '表达式：读取数值', value: { type: 'value', value: { type: 'value', source: 'res', params: { resource: '' } } } },
  ...Object.fromEntries([['res','资源','resource'],['spotLevel','设施等级','spot'],['areaSpotCount','区域设施数','area'],['managerCount','经理数量','init'],['funclet','函数','funclet'],['data','Extra 数值','path']].map(([source,label,key]) => [`read-${source}`, { label: `表达式：读取${label}`, value: {type:'value',value:{type:'value',source,params:{[key]:''}}} }])),
  ...Object.fromEntries(['add', 'sub', 'mul', 'div', 'min', 'max', 'pow'].map((type, i) => [type, { label: `表达式：${['加', '减', '乘', '除', '较小值', '较大值', '乘方'][i]}`, value: { type, left: { type: 'const', value: 0 }, right: { type: 'const', value: 0 } } }])),
  ...Object.fromEntries(['floor', 'ceil', 'round'].map((type, i) => [type, { label: `表达式：${['向下取整', '向上取整', '四舍五入'][i]}`, value: { type, expr: { type: 'const', value: 0 } } }])),
  clamp: { label: '表达式：范围限制', value: { type: 'clamp', expr: { type: 'const', value: 0 }, min: { type: 'const', value: 0 }, max: { type: 'const', value: 1 } } },
  ...Object.fromEntries(['int', 'float', 'str', 'bool', 'list', 'dict'].map((t, i) => [`extra-${t}`, { label: `Extra：${['整数', '小数', '文字', '布尔', '列表', '字典'][i]}`, value: { t, v: [0, 0, '', false, [], {}][i] } }])),
} satisfies Record<string, { label: string; value: unknown }>;
export function presetValue(kind: string): unknown {
  const preset = (VALUE_PRESETS as Record<string, { value: unknown }>)[kind];
  if (!preset) throw new Error('未知的值类型');
  const value = structuredClone(preset.value);
  if (object(value) && typeof value.id === 'string' && value.id) value.id = `${value.id}_${crypto.randomUUID().replace(/-/g,'')}`;
  return value;
}
const TITLES: Record<string, string> = {
  type: '类型', value: '值', left: '左值', right: '右值', expr: '表达式', source: '数值来源', params: '参数', t: 'Extra 类型', v: 'Extra 内容',
  id: '身份', storyId: 'Story', entryId: 'Entry', areaId: 'Area', owner: '归属角色', triggerCondition: '触发条件', availableInits: '允许的 Init',
  kizuna: '羁绊子故事', returnFlags: '回传局部标记', repeatable: '可重复', replayable: '可重读', weight: '抽取权重', affectionRequired: '好感等级',
  cooldownFrames: '冷却帧数', completionReward: '完成奖励', first: '首次奖励', repeat: '重复奖励', conditionalRewards: '条件奖励',
  children: '子项', condition: '条件', conditions: '条件列表', target: '目标', key: '条件键', comparator: '比较方式',
  openingTitle: '开幕标题', travelToStartContext: '前往起始场景', block: '阻塞条件', interruptible: '可打断', leaveArea: '允许离开区域', blocksInteraction: '阻塞交互',
  reactions: '完结反应', followUps: '独立后续', pushAfterStory: '前置 Story', branchGuards: '分支门控', revealTriggers: '揭示条件', tags: '标签', extra: '扩展数据',
  palette: '主题色板', tokens: '主题变量', nodes: '语义颜色', background: '背景层', name: '名称', effects: '效果', op: '操作', amount: '数量',
};
export const valueTitle = (key: string | number): string => typeof key === 'number' ? `第 ${key + 1} 项` : TITLES[key] ?? key;

/** Flat rows retain a path heading; object structure does not introduce nested cards or scrolling hosts. */
export function renderStructuredValue(ctx: UIContext, scope: string, path: ValuePath, value: unknown, title: string, inputs: StructuredInputs = {}, disabled = false, depth = 0, identity?: (scope: string, path: ValuePath) => string, references?: Record<string, readonly {value:string;label:string}[]>): string {
  const e = ctx.escapeHtml; const key = identity?.(scope, path) ?? JSON.stringify([scope, ...path]);
  const attrs = `data-value-scope="${e(scope)}" data-value-path="${e(JSON.stringify(path))}"`;
  const locked = disabled ? ' disabled' : '';
  const mode = value === undefined ? 'unset' : value === null ? 'null' : Array.isArray(value) ? 'array' : object(value) ? 'object' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
  const options = Object.entries(VALUE_PRESETS).map(([id, preset]) => `<option value="${id}"${mode === id ? ' selected' : ''}>${e(preset.label)}</option>`).join('');
  const requiredField = scope === '$authoring' && path.length === 3 && ['id','type','storyId','triggerCondition','availableInits','repeatable','weight','children'].includes(String(path[2]));
  const fixedString = scope === '$authoring' && path.length === 3 && ['id','type','storyId','owner','openingTitle','pushAfterStory'].includes(String(path[2]));
  const heading = `<div class="story-editor-list-heading"><strong>${e(title)}</strong><button type="button" class="mini-action mini-action--danger" data-value-action="remove" ${attrs}${requiredField ? ' disabled' : locked}>移除</button></div>`;
  const fixedRecord = scope === '$authoring' && path.length === 2 && ['activeStories','passiveStories','passivePools'].includes(String(path[0]));
  const selector = fixedRecord || fixedString ? '' : `<label class="story-editor-property">值类型<select data-editor-key="value-type:${e(key)}" data-value-type ${attrs}${locked}>${value === undefined ? '<option value="" selected>未设置</option>' : ''}${options}</select></label>`;
  let content: string;
  if (depth > STORY_AUTHORING_MAX_DEPTH) content = '<p class="story-editor-error">结构过深，请先简化上层值。</p>';
  else if (Array.isArray(value) || object(value)) {
    const children = Object.entries(value).map(([name, child]) => {
      if (fixedRecord && name === 'kizuna') return '';
      const segment = Array.isArray(value) ? Number(name) : name;
      const move = Array.isArray(value) ? `<div class="story-editor-actions"><button type="button" class="mini-action" data-value-action="up" data-value-scope="${e(scope)}" data-value-path="${e(JSON.stringify([...path,segment]))}"${Number(segment)===0 || disabled ? ' disabled' : ''}>上移</button><button type="button" class="mini-action" data-value-action="down" data-value-scope="${e(scope)}" data-value-path="${e(JSON.stringify([...path,segment]))}"${Number(segment)===value.length-1 || disabled ? ' disabled' : ''}>下移</button></div>` : '';
      const flagNames = object(value) && (value.target === 'flag' && name === 'key' || value.op === 'setFlag' && name === 'target') ? references?.$globalFlags
        : object(value) && value.kind === 'localFlag' && name === 'name' || path.at(-1) === 'returnFlags' ? references?.$localFlags : undefined;
      return renderStructuredValue(ctx, scope, [...path, segment], child, `${title} / ${valueTitle(segment)}`, inputs, disabled, depth + 1, identity, flagNames ? { ...references, [segment]: flagNames } : references) + move;
    }).join('');
    content = `${Array.isArray(value) ? '' : `<label class="story-editor-property">新字段名称<input data-editor-key="new-key:${e(key)}" data-value-key ${attrs} value="${e(inputs[key + ':new-key']?.text ?? '')}"${locked}></label>`}<button type="button" class="mini-action" data-value-action="add" ${attrs}${locked}>${Array.isArray(value) ? '添加列表项' : '添加字段'}</button>${children}`;
  } else if (mode === 'null' || value === undefined) content = `<p class="story-editor-hint">${value === null ? '空值仍表示键存在。' : '选择值类型后开始编辑；未设置的字段不写入内容。'}</p>`;
  else if (mode === 'boolean') content = `<label class="story-editor-property">值<select data-editor-key="value:${e(key)}" data-value-input="boolean" ${attrs}${locked}><option value="false"${value === false ? ' selected' : ''}>false</option><option value="true"${value === true ? ' selected' : ''}>true</option></select></label>`;
  else {
    const field = String(path[path.length-1]);
    const kinds: Record<string,StoryReferenceKind> = {storyId:'story',entryId:'entry',storyEntryId:'entry',areaId:'area',owner:'variant',variantId:'variant',characterId:'variant',resource:'resource',resourceId:'resource',spot:'spot',spotId:'spot',area:'area',init:'init',initId:'init',itemId:'item',colorGroupId:'colorGroup',funclet:'funclet',managerId:'character',enhancementId:'enhancement',pushAfterStory:'story',avatar:'image',image:'image'};
    const kind = path.at(-2) === 'availableInits' ? 'init' : kinds[field];
    const candidates = references?.[field] ?? (kind ? storyReferenceOptions(ctx,kind) : []);
    const localFlagField = references?.$localFlags !== undefined && references[field] === references.$localFlags;
    const reference = mode === 'string' && (kind !== undefined || references?.[field] !== undefined);
    const listId = `value-ref-${Array.from(key).map(c=>c.codePointAt(0)!.toString(16)).join('-')}`;
    content = `<label class="story-editor-property">值<input${reference && !localFlagField ? ` data-story-reference="${kind ?? 'globalFlag'}" data-reference-label="${e(title)}"` : ''} data-editor-key="value:${e(key)}" data-value-input="${mode}" ${attrs} value="${e(inputs[key]?.text ?? String(value))}"${mode === 'number' ? ' inputmode="decimal"' : ''}${reference ? ` list="${e(listId)}"` : ''}${locked}>${localFlagField ? renderLocalFlagNaviButton(disabled,path.at(-2)==='returnFlags') : ''}</label>${reference ? `<datalist id="${e(listId)}">${candidates.map(x=>`<option value="${e(x.value)}" label="${e(x.label)}"></option>`).join('')}</datalist>` : ''}`;
  }
  return `<section class="story-editor-value" data-editor-key="structured:${e(key)}">${heading}${selector}${selector ? '<small class="story-editor-hint">切换值类型或构造会替换本项内容。</small>' : ''}${inputs[key]?.error ? `<p class="story-editor-error">${e(inputs[key].error!)}</p>` : ''}${content}</section>`;
}

export function readStructuredInput(kind: string, text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  if (kind === 'number') {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(Number(text))) return { ok: false, message: '请输入有限数字；当前输入已保留。' };
    return { ok: true, value: Number(text) };
  }
  return { ok: true, value: kind === 'boolean' ? text === 'true' : text };
}
