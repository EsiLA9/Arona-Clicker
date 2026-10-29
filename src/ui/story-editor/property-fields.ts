import type { UIContext } from '../runtime/context';
import type { StoryDraft, StoryDraftNode, StoryEditorState } from './model';
import { isOptionalEnabled, literalKindAt, rowIdAt } from './property-model';
import { storyReferenceOptions, type StoryReferenceKind } from './property-options';

type Path = readonly (string | number)[];
type Obj = Record<string, unknown>;
const record = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const pathText = (path: Path): string => JSON.stringify(path);
const key = (path: Path, suffix = ''): string => `property:${pathText(path)}${suffix}`;
const esc = (ctx: UIContext, value: unknown): string => ctx.escapeHtml(value == null ? '' : String(value));
const val = (object: Obj | null, name: string): unknown => object?.[name];
const hasOwn = (object: object, name: string): boolean => Object.prototype.hasOwnProperty.call(object, name);
const disabled = (state: StoryEditorState): string => state.storageBlocked ? ' disabled' : '';
const readOnly = (state: StoryEditorState): string => state.storageBlocked ? ' readonly' : '';
const choices = (ctx: UIContext, values: readonly [string, string][], current: unknown, path: Path, state: StoryEditorState, allowDefault = false): string => {
  const selected = current === undefined ? '' : String(current);
  const missing = selected && !values.some(([value]) => value === selected)
    ? `<option value="${esc(ctx, selected)}" selected>${esc(ctx, selected)}（原值，目录中不存在）</option>` : '';
  return `<select data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, pathText(path))}"${disabled(state)}>${selected ? '' : `<option value="" selected>${allowDefault?'沿用默认':'选择…'}</option>`}${missing}${values.map(([value, label]) => `<option value="${esc(ctx, value)}"${value === selected ? ' selected' : ''}>${esc(ctx, label)}</option>`).join('')}</select>`;
};
function scalar(ctx: UIContext, label: string, path: Path, value: unknown, state: StoryEditorState, kind: 'text' | 'textarea' | 'number' | 'boolean' | 'ref' | 'image' = 'text', ref?: StoryReferenceKind, hint?: string): string {
  const p = pathText(path); const current = value == null ? '' : String(value);
  let control: string;
  if (kind === 'boolean') control = `<select data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}"${disabled(state)}><option value="false"${value === false ? ' selected' : ''}>false</option><option value="true"${value === true ? ' selected' : ''}>true</option></select>`;
  else if (kind === 'ref' && ref) {
    const options = storyReferenceOptions(ctx, ref); const found = options.some(option => option.value === current);
    const old = current && !found ? `<option value="${esc(ctx, current)}" selected>${esc(ctx, current)}（引用不存在）</option>` : '';
    control = `<select data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}"${disabled(state)}><option value=""${current ? '' : ' selected'}>选择${ref === 'entry' ? '入口' : '内容'}…</option>${old}${options.map(option => `<option value="${esc(ctx, option.value)}"${option.value === current ? ' selected' : ''}>${esc(ctx, option.label)}</option>`).join('')}</select>`;
  } else if (kind === 'image') control = `<input list="story-image-options" data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}" value="${esc(ctx,current)}"${readOnly(state)}><datalist id="story-image-options">${storyReferenceOptions(ctx,'image').map(option=>`<option value="${esc(ctx,option.value)}" label="${esc(ctx,option.label)}"></option>`).join('')}</datalist>`;
  else if (kind === 'textarea') control = `<textarea rows="3" data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}"${readOnly(state)}>${esc(ctx, current)}</textarea>`;
  else control = `<input data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}" value="${esc(ctx, current)}"${kind === 'number' ? ' inputmode="decimal"' : ''}${readOnly(state)}>`;
  const pathId = JSON.stringify(path); const legacy = pathId === '[\"requiresFlag\"]' ? 'requires-flag' : pathId === '[\"content\",\"text\"]' || pathId === '[\"interaction\",\"text\"]' ? 'text' : '';
  if (legacy) control = control.replace('<input ', `<input data-editor-field=\"${legacy}\" `).replace('<textarea ', `<textarea data-editor-field=\"${legacy}\" `).replace('<select ', `<select data-editor-field=\"${legacy}\" `);
  return `<label class="story-editor-property">${esc(ctx, label)}${control}${hint ? `<small class="story-editor-hint">${esc(ctx, hint)}</small>` : ''}</label>`;
}
function branch(ctx: UIContext, label: string, path: Path, current: unknown, values: readonly [string, string][], state: StoryEditorState): string {
  const discriminator = path[path.length - 1]; const objectPath = path.slice(0, -1);
  const p = pathText(objectPath); const selected = typeof current === 'string' ? current : '';
  const missing = selected && !values.some(([value]) => value === selected) ? `<option value="${esc(ctx, selected)}" selected>${esc(ctx, selected)}（原值，暂不支持编辑）</option>` : '';
  return `<label class="story-editor-property">${esc(ctx, label)}<select data-editor-key="${esc(ctx, key(path, ':branch'))}" data-story-branch-path="${esc(ctx, p)}" data-story-branch-field="${esc(ctx,String(discriminator))}"${disabled(state)}>${selected ? '' : '<option value="" selected>选择…</option>'}${missing}${values.map(([value, text]) => `<option value="${esc(ctx, value)}"${selected === value ? ' selected' : ''}>${esc(ctx, text)}</option>`).join('')}</select></label>`;
}
function optional(ctx: UIContext, label: string, path: Path, enabled: boolean, state: StoryEditorState, content: string, hint?: string, draft?: StoryDraft, nodeId?: string, create?: string): string {
  enabled = draft && nodeId ? isOptionalEnabled(draft, nodeId, path) || enabled : enabled;
  return `<section class="story-editor-optional" data-editor-key="${esc(ctx, key(path, ':optional'))}"><label class="story-editor-toggle"><input type="checkbox" data-story-optional-path="${esc(ctx, pathText(path))}"${enabled ? ' checked' : ''}${disabled(state)}>${esc(ctx, label)}</label>${hint ? `<small class="story-editor-hint">${esc(ctx, hint)}</small>` : ''}${enabled ? `<div class="story-editor-optional-content">${content}</div>` : create ?? ''}</section>`;
}
function scalarOptional(ctx: UIContext, label: string, parent: Obj | null, name: string, path: Path, state: StoryEditorState, kind: Parameters<typeof scalar>[5] = 'text', ref?: StoryReferenceKind, draft?: StoryDraft, nodeId?:string): string {
  const enabled = Boolean(parent && Object.prototype.hasOwnProperty.call(parent, name)) || Boolean(draft&&nodeId&&isOptionalEnabled(draft,nodeId,path));
  return optional(ctx, label, path, enabled, state, scalar(ctx, label, [...path], parent?.[name], state, kind, ref), '启用后才写入 Story。',draft,nodeId);
}
function rowButtons(ctx: UIContext, path: Path, rowId: string, index: number, total: number, state: StoryEditorState): string {
  const attr = `data-story-row-path="${esc(ctx, pathText(path))}" data-story-row-id="${esc(ctx, rowId)}"`;
  return `<div class="story-editor-actions"><button type="button" class="mini-action" data-story-row-action="up" ${attr}${index === 0 || state.storageBlocked ? ' disabled' : ''}>上移</button><button type="button" class="mini-action" data-story-row-action="down" ${attr}${index === total - 1 || state.storageBlocked ? ' disabled' : ''}>下移</button><button type="button" class="mini-action mini-action--danger" data-story-row-action="remove" ${attr}${state.storageBlocked ? ' disabled' : ''}>删除</button></div>`;
}
function listHeader(ctx: UIContext, title: string, path: Path, state: StoryEditorState): string {
  return `<div class="story-editor-list-heading"><strong>${esc(ctx, title)}</strong><button type="button" class="mini-action" data-story-row-action="add" data-story-row-path="${esc(ctx, pathText(path))}"${disabled(state)}>添加</button></div>`;
}

function contentEditor(ctx: UIContext, state: StoryEditorState, path: Path, content: Obj | null, presentation = false): string {
  const kind = val(content, 'kind'); const out = [branch(ctx, '内容形式', [...path, 'kind'], kind, [['talk', '对话'], ['narration', '旁白']], state)];
  out.push(scalar(ctx, '正文', [...path, 'text'], val(content, 'text'), state, 'textarea'));
  if (kind === 'talk') {
    out.push(scalar(ctx, '发出方（显示名）', [...path, 'speaker'], val(content, 'speaker'), state));
    out.push(scalar(ctx, '图片引用', [...path, 'image'], val(content, 'image'), state, 'text', undefined, '填入图片资源标识；此工作区当前没有可枚举的图片目录。'));
  }
  if (presentation) out.push(presentationEditor(ctx, state, [...path.slice(0, 1), 'presentation'], null));
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function presentationEditor(ctx: UIContext, state: StoryEditorState, path: Path, presentation: Obj | null): string {
  return `<div class="story-editor-property-group">${choices(ctx, [['left','左侧'],['right','右侧']], val(presentation,'side'), [...path,'side'], state, true)}${choices(ctx, [['left','左对齐'],['center','居中'],['right','右对齐']], val(presentation,'align'), [...path,'align'], state, true)}${choices(ctx, [['auto','自动'],['hide','隐藏'],['show','显示']], val(presentation,'avatarMode'), [...path,'avatarMode'], state, true)}${scalar(ctx,'头像引用',[...path,'avatar'],val(presentation,'avatar'),state)}${val(presentation,'avatarMode')==='hide'?'<small class="story-editor-hint">隐藏模式仍保留头像引用；组合合法。</small>':''}</div>`;
}
function transferEditor(ctx: UIContext, state: StoryEditorState, path: Path, value: Obj | null, draft?: StoryDraft): string {
  return `<div class="story-editor-property-group">${branch(ctx,'转移方式',[...path,'mode'],val(value,'mode'),[['goto','跳转'],['insert','插入并返回']],state)}${draft ? storyReference(ctx,state,[...path,'storyId'],val(value,'storyId'),draft) : scalar(ctx,'Story',[...path,'storyId'],val(value,'storyId'),state,'ref','story')}</div>`;
}
function storyReference(ctx: UIContext,state:StoryEditorState,path:Path,value:unknown,draft:StoryDraft):string {
  const current=value==null?'':String(value); const options=storyReferenceOptions(ctx,'story'); const self=draft.document.id;
  const missing=current&&!options.some(item=>item.value===current)&&current!==self?`<option value="${esc(ctx,current)}" selected>${esc(ctx,current)}（目标不存在）</option>`:'';
  const entries=[...options,...(options.some(item=>item.value===self)?[]:[{value:self,label:`${draft.document.name||self}（当前 Story）`}])];
  return `<label class="story-editor-property">Story<select data-editor-key="${esc(ctx,key(path))}" data-story-property-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value=""${current?'':' selected'}>选择 Story…</option>${missing}${entries.map(item=>`<option value="${esc(ctx,item.value)}"${item.value===current?' selected':''}>${esc(ctx,item.label)}</option>`).join('')}</select></label>`;
}
function resultEditor(ctx: UIContext, state: StoryEditorState, path: Path, value: Obj | null, draft: StoryDraft, nodeId: string): string {
  const actionsPath = [...path,'actions']; const actions = array(val(value,'actions'));
  const hasActions = Boolean(value && hasOwn(value,'actions'));
  const hasTransfer = Boolean(value && hasOwn(value,'transfer'));
  // Enabled optionals always render their editor so a freshly enabled switch is never blank.
  return `<div class="story-editor-property-group">${optional(ctx,'执行动作',path.concat('actions'),hasActions,state,actionList(ctx,state,actionsPath,actions,draft,nodeId),undefined,draft,nodeId)}${optional(ctx,'然后转移',path.concat('transfer'),hasTransfer,state,transferEditor(ctx,state,[...path,'transfer'],record(val(value,'transfer')),draft),undefined,draft,nodeId)}</div>`;
}
function cursorOwnerSelect(ctx: UIContext, state: StoryEditorState, path: Path, owner: unknown): string {
  const characters = [...ctx.game.registry.characters.values()];
  const unknown = typeof owner === 'string' && !ctx.game.registry.characters.has(owner);
  const missing = unknown ? `<option value="${esc(ctx,owner)}" selected>${esc(ctx,owner)}（原值，角色目录中不存在）</option>` : '';
  return `<label class="story-editor-property">游标归属<select data-editor-key="${esc(ctx,key(path))}" data-story-property-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value="__global__"${owner == null ? ' selected' : ''}>全局（null）</option>${characters.map(character => `<option value="${esc(ctx,character.id)}"${owner === character.id ? ' selected' : ''}>${esc(ctx,character.displayName)}</option>`).join('')}${missing}</select><small class="story-editor-hint">全局 null 与角色字符串是两种显式取值。</small></label>`;
}
function entryCardEditor(ctx: UIContext, state: StoryEditorState, path: Path, card: Obj | null, requestPath: Path): string {
  const request = record(val(card,'request')) ?? record(card);
  const out = [scalar(ctx,'Active Entry', [...requestPath,'entryId'], val(request,'entryId'), state, 'ref','activeEntry'), cursorOwnerSelect(ctx,state,[...requestPath,'owner'],val(request,'owner'))];
  if (card) out.push(scalar(ctx,'标题',[...path,'title'],val(card,'title'),state),scalar(ctx,'按钮文案',[...path,'buttonText'],val(card,'buttonText'),state),choices(ctx,[['left','左'],['right','右']],val(card,'align'),[...path,'align'],state,true));
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}

const actionKinds: readonly [string,string][] = [['state','状态动作'],['travel','移动'],['entryRequest','请求剧情入口'],['overlay','覆盖层演出'],['presentation','表现演出'],['localFlag','局部标记']];
function actionEditor(ctx: UIContext, state: StoryEditorState, path: Path, action: Obj | null, draft: StoryDraft, nodeId: string): string {
  const kind = val(action,'kind'); const out = [branch(ctx,'行为类型',[...path,'kind'],kind,actionKinds,state)];
  if (kind === 'localFlag') return out.join('') + '<p class="story-editor-hint">局部标记字段沿用已接通的专用表单。</p>';
  if (kind === 'travel') out.push(scalar(ctx,'区域',[...path,'areaId'],val(action,'areaId'),state,'ref','area'),scalarOptional(ctx,'显示移动通知',action,'notice',[...path,'notice'],state,'boolean',undefined,draft,nodeId));
  if (kind === 'entryRequest') {
    const request = record(val(action,'request')) ?? action;
    out.push(branch(ctx,'Entry 类型',[...path,'request','entryType'],val(request,'entryType'),[['active','主动 Entry'],['passive','被动 Entry']],state));
    const entryType = val(request,'entryType');
    out.push(scalar(ctx,entryType === 'passive' ? 'Passive Entry' : 'Active Entry',[...path,'request','entryId'],val(request,'entryId'),state,'ref',entryType==='passive'?'passiveEntry':'activeEntry'));
    const intentValues: [string,string][] = entryType === 'active' ? [['ordinary','普通'],['system','系统'],['card','入口卡']] : [['ordinary','普通'],['system','系统']];
    out.push(branch(ctx,'请求意图',[...path,'request','intent'],val(request,'intent'),intentValues,state));
    out.push(cursorOwnerSelect(ctx,state,[...path,'request','owner'],val(request,'owner')));
  }
  if (kind === 'state') {
    const p = [...path,'effects']; const rows = array(val(action,'effects'));
    out.push(listHeader(ctx,'状态变更（按顺序）',p,state),...rows.map((row,index) => stateActionRow(ctx,state,p,index,rows,record(row),draft,nodeId)));
  }
  if (kind === 'overlay') out.push(overlayEditor(ctx,state,[...path,'command'],record(val(action,'command')),draft,nodeId));
  if (kind === 'presentation') out.push(presentationActionEditor(ctx,state,[...path,'command'],record(val(action,'command'))));
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function actionList(ctx: UIContext, state: StoryEditorState, path: Path, rows: unknown[], draft: StoryDraft, nodeId: string): string {
  return `<div class="story-editor-list-block">${listHeader(ctx,'动作（按顺序）',path,state)}${rows.map((row,index) => { const id=rowIdAt(draft,nodeId,path,index) ?? String(index); return `<section class="story-editor-property-row" data-editor-key="row:${esc(ctx,id)}">${actionEditor(ctx,state,[...path,index],record(row),draft,nodeId)}${rowButtons(ctx,path,id,index,rows.length,state)}</section>`; }).join('')}</div>`;
}
function stateActionRow(ctx: UIContext, state: StoryEditorState, path: Path, index: number, rows: unknown[], row: Obj | null, draft: StoryDraft, nodeId: string): string {
  const opValues: [string,string][] = [['setResource','设置资源'],['addResource','增加资源'],['setSpotLevel','设置设施等级'],['addSpotLevel','增加设施等级'],['setManager','设置经理'],['addEnhancement','获得强化'],['addItem','获得物品'],['unlockInit','解锁世界线'],['setFlag','写局部标记'],['setExtra','设置 Extra'],['addExtra','增加 Extra'],['removeExtra','移除 Extra'],['grantCharacter','获得角色'],['addAffectionExp','增加好感经验']];
  const op=val(row,'op'); const p=[...path,index]; const fields: string[]=[];
  fields.push(branch(ctx,'状态动作',[...p,'op'],op,opValues,state));
  if (op==='setResource'||op==='addResource') fields.push(scalar(ctx,'资源',[...p,'resourceId'],val(row,'resourceId'),state,'ref','resource'),numericValueEditor(ctx,'数值',[...p,'amount'],val(row,'amount'),state));
  if (op==='setSpotLevel'||op==='addSpotLevel') fields.push(scalar(ctx,'设施',[...p,'spotId'],val(row,'spotId'),state,'ref','spot'),numericValueEditor(ctx,'数值',[...p,'amount'],val(row,'amount'),state));
  if (op==='setManager') fields.push(scalar(ctx,'设施',[...p,'spotId'],val(row,'spotId'),state,'ref','spot'),scalar(ctx,'经理角色',[...p,'managerId'],val(row,'managerId'),state,'ref','character'));
  if (op==='addEnhancement') fields.push(scalar(ctx,'强化',[...p,'enhancementId'],val(row,'enhancementId'),state,'ref','enhancement'));
  if (op==='addItem') fields.push(scalar(ctx,'物品',[...p,'itemId'],val(row,'itemId'),state,'ref','item'),numericValueEditor(ctx,'数量',[...p,'amount'],val(row,'amount'),state));
  if (op==='unlockInit') fields.push(scalar(ctx,'世界线',[...p,'initId'],val(row,'initId'),state,'ref','init'));
  if (op==='setFlag') { fields.push(scalar(ctx,'全局标记名称',[...p,'flagId'],val(row,'flagId'),state)); fields.push(literalValueEditor(ctx,'值',[...p,'value'],val(row,'value'),state,draft,nodeId)); }
  if (op==='setExtra'||op==='addExtra'||op==='removeExtra') { fields.push(scalar(ctx,'Extra 路径',[...p,'path'],val(row,'path'),state,'text',undefined,'按现有 ExtraPath 规则填写。')); if(op==='setExtra') fields.push(literalValueEditor(ctx,'值',[...p,'value'],val(row,'value'),state,draft,nodeId)); if(op==='addExtra') fields.push(numericValueEditor(ctx,'增量',[...p,'amount'],val(row,'amount'),state)); }
  if (op==='grantCharacter'||op==='addAffectionExp') { fields.push(scalar(ctx,'角色差分',[...p,'variantId'],val(row,'variantId'),state,'ref','variant')); if(op==='addAffectionExp') fields.push(numericValueEditor(ctx,'经验',[...p,'amount'],val(row,'amount'),state)); }
  const rowId=rowIdAt(draft,nodeId,path,index)??String(index);
  return `<div class="story-editor-property-row" data-editor-key="effect:${esc(ctx,rowId)}">${fields.join('')}${rowButtons(ctx,path,rowId,index,rows.length,state)}</div>`;
}
function numericValueEditor(ctx: UIContext,label: string,path: Path,value: unknown,state: StoryEditorState): string {
  if (typeof value === 'number' || value === undefined || typeof value === 'string') return scalar(ctx,label,path,value,state,'number');
  return `<div class="story-editor-readonly" data-editor-key="${esc(ctx,key(path))}"><strong>${esc(ctx,label)}</strong><span>表达式（保持原值）</span><small>${esc(ctx,JSON.stringify(value))}</small></div>`;
}
function literalValueEditor(ctx: UIContext,label: string,path: Path,value: unknown,state: StoryEditorState,draft: StoryDraft,nodeId: string): string {
  if (value !== null && value !== undefined && typeof value === 'object') return readonlyComplex(ctx,`${label}（复杂值 / 表达式，保留原值）`,path,value);
  const recorded=literalKindAt(draft,nodeId,path);
  const kind=recorded ?? (typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : typeof value === 'string' ? 'string' : undefined);
  const kindSelect=`<label class="story-editor-property">${esc(ctx,label)}类型<select data-story-literal-kind-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value=""${kind?'':' selected'}>选择类型…</option>${[['string','文字'],['number','数字'],['boolean','布尔']].map(([value,text])=>`<option value="${value}"${value===kind?' selected':''}>${esc(ctx,text)}</option>`).join('')}</select><small class="story-editor-hint">数值表达式与嵌套 ExtraValue 暂不提供可视化新建；已有复杂值只读保留。</small></label>`;
  const control=kind==='boolean' ? scalar(ctx,label,path,value===true,state,'boolean')
    : kind==='number' ? scalar(ctx,label,path,value,state,'number')
    : scalar(ctx,label,path,value,state,'text');
  return `<div class="story-editor-literal" data-editor-key="${esc(ctx,key(path,':literal'))}">${kindSelect}${control}</div>`;
}
function overlayEditor(ctx: UIContext,state: StoryEditorState,path: Path,value: Obj|null,draft: StoryDraft,nodeId: string): string {
  const command=val(value,'command'); const out=[branch(ctx,'覆盖层命令',[...path,'command'],command,[['show','显示'],['clearId','按 ID 清除'],['clearAllTexts','清除全部覆盖文本'],['clearFlow','清除当前聊天流']],state)];
  if(command==='show') {
    out.push(scalar(ctx,'覆盖层 ID',[...path,'id'],val(value,'id'),state),scalarOptional(ctx,'X（0–1，左下原点）',value,'x',[...path,'x'],state,'number',undefined,draft,nodeId),scalarOptional(ctx,'Y（0–1，左下原点）',value,'y',[...path,'y'],state,'number',undefined,draft,nodeId),choices(ctx,[['left','左'],['center','中'],['right','右']],val(value,'align'),[...path,'align'],state,true));
    const cp=[...path,'content']; const content=record(val(value,'content')); const kind=val(content,'kind'); out.push(branch(ctx,'内容类型',[...cp,'kind'],kind,[['text','文本'],['message','消息'],['entryCard','入口卡']],state));
    if(kind==='text') out.push(scalar(ctx,'文本',[...cp,'text'],val(content,'text'),state,'textarea'),choices(ctx,[['default','默认'],['title','标题'],['badge','徽标'],['note','注记']],val(content,'template'),[...cp,'template'],state,true),styleEditor(ctx,state,[...cp,'style'],record(val(content,'style'))));
    if(kind==='message') out.push(contentEditor(ctx,state,[...cp,'content'],record(val(content,'content'))),presentationEditor(ctx,state,[...cp,'presentation'],record(val(content,'presentation'))),styleEditor(ctx,state,[...cp,'style'],record(val(content,'style'))));
    if(kind==='entryCard') out.push(entryCardEditor(ctx,state,[...cp,'card'],record(val(content,'card')),[...cp,'card','request']));
  }
  if(command==='clearId') out.push(scalar(ctx,'覆盖层 ID',[...path,'id'],val(value,'id'),state));
  if(command==='clearAllTexts') out.push('<small class="story-editor-hint">清除全部演出覆盖文本，保留聊天历史。</small>');
  if(command==='clearFlow') out.push('<small class="story-editor-hint">清空当前聊天流。</small>');
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function styleEditor(ctx: UIContext,state: StoryEditorState,path: Path,value: Obj|null): string {
  return `<section class="story-editor-property-group" data-editor-key="${esc(ctx,key(path,':style'))}"><strong>基础样式</strong>${choices(ctx,[['default','默认字型'],['serif','衬线'],['sans','无衬线'],['mono','等宽'],['handwritten','手写']],val(value,'font'),[...path,'font'],state,true)}${scalar(ctx,'字号',[...path,'fontSize'],val(value,'fontSize'),state)}${scalar(ctx,'文字颜色',[...path,'color'],val(value,'color'),state)}${choices(ctx,[['true','显示背景'],['false','透明背景']],val(value,'background') === undefined ? undefined : String(val(value,'background')),[...path,'background'],state,true)}${scalar(ctx,'背景颜色',[...path,'backgroundColor'],val(value,'backgroundColor'),state)}</section>`;
}
function presentationActionEditor(ctx: UIContext,state: StoryEditorState,path: Path,value: Obj|null): string {
  const command=val(value,'command'); const commands: [string,string][]=[['theme','临时主题'],['setEntityPresentation','设置实体表现'],['clearEntityPresentation','清除实体表现'],['openingTitle','开幕标题']];
  const out=[branch(ctx,'表现命令',[...path,'command'],command,commands,state)];
  if(command==='openingTitle') out.push(scalar(ctx,'标题（留空使用来源标题）',[...path,'title'],val(value,'title'),state));
  if(command==='theme') {
    const theme=record(val(value,'value')); const scopeValue=val(theme,'scope');
    const scope=scopeValue==='area'||scopeValue==='student'?scopeValue:'ephemeral';
    out.push(`<label class="story-editor-property">主题作用域<select data-editor-key="${esc(ctx,key([...path,'value','scope'],':scope'))}" data-story-theme-scope-path="${esc(ctx,pathText([...path,'value']))}"${disabled(state)}>${[['ephemeral','临时'],['area','区域'],['student','学生']].map(([v,l])=>`<option value="${v}"${v===scope?' selected':''}>${esc(ctx,l)}</option>`).join('')}</select><small class="story-editor-hint">切换作用域只休眠/恢复实体键；颜色组与其他覆盖保持原值。</small></label>`);
    if(scope!=='ephemeral') out.push(entityKeySelect(ctx,state,[...path,'value','entityKey'],val(theme,'entityKey'),scope));
    out.push(scalar(ctx,'颜色组',[...path,'value','colorGroupId'],val(theme,'colorGroupId'),state,'ref','colorGroup'));
    for(const field of ['palette','tokens','nodes','background']) if(hasOwn(theme??{},field)) out.push(readonlyComplex(ctx,`${field}（保留原值）`,[...path,'value',field],val(theme,field)));
  }
  if(command==='setEntityPresentation'||command==='clearEntityPresentation') {
    const target=val(value,'target'); const targetOptions=entityPresentationTargets(ctx); const selected=typeof target==='string'?target:'';
    const missing=selected&&!targetOptions.some(item=>item.value===selected)?`<option value="${esc(ctx,selected)}" selected>${esc(ctx,selected)}（目标不存在）</option>`:'';
    out.push(`<label class="story-editor-property">表现目标<select data-editor-key="${esc(ctx,key([...path,'target']))}" data-story-property-path="${esc(ctx,pathText([...path,'target']))}"${disabled(state)}><option value=""${selected?'':' selected'}>选择实体…</option>${missing}${targetOptions.map(item=>`<option value="${esc(ctx,item.value)}"${item.value===selected?' selected':''}>${esc(ctx,item.label)}</option>`).join('')}</select></label>`,scalar(ctx,'持有者',[...path,'owner'],val(value,'owner'),state));
    if(command==='setEntityPresentation') {
      const options=targetOptionValues(ctx,target);
      out.push(typeof target==='string'
        ? choices(ctx,options,val(value,'optionId'),[...path,'optionId'],state,true)
        : `<label class="story-editor-property">表现选项<select disabled><option value="">先选择表现目标</option></select><small class="story-editor-hint">选项来自目标实体自身的 presentation.additions。</small></label>`);
      out.push(choices(ctx,[['story','Story'],['area','区域'],['init','世界线'],['manual','手动']],val(value,'lifetime'),[...path,'lifetime'],state,true));
    }
  }
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function entityKeySelect(ctx: UIContext,state: StoryEditorState,path: Path,value: unknown,scope: 'area'|'student'): string {
  const current=typeof value==='string'?value:''; const prefix=scope==='area'?'area:':'variant:';
  const options=storyReferenceOptions(ctx,scope==='area'?'area':'variant').map(item=>({value:`${prefix}${item.value}`,label:item.label}));
  const missing=current&&!options.some(item=>item.value===current)?`<option value="${esc(ctx,current)}" selected>${esc(ctx,current)}（实体不存在）</option>`:'';
  return `<label class="story-editor-property">${scope==='area'?'区域':'角色差分'}<select data-editor-key="${esc(ctx,key(path))}" data-story-property-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value=""${current?'':' selected'}>选择…</option>${missing}${options.map(item=>`<option value="${esc(ctx,item.value)}"${item.value===current?' selected':''}>${esc(ctx,item.label)}</option>`).join('')}</select></label>`;
}
function readonlyComplex(ctx: UIContext,label: string,path: Path,value: unknown): string {
  const pretty=JSON.stringify(value);
  return `<div class="story-editor-readonly" data-editor-key="${esc(ctx,key(path,':readonly'))}"><strong>${esc(ctx,label)}</strong><code>${esc(ctx,pretty)}</code><button type="button" class="mini-action mini-action--danger" data-story-optional-path="${esc(ctx,pathText(path))}" data-story-remove-readonly="true">从草稿中移除</button></div>`;
}
function conditionEditor(ctx: UIContext,state: StoryEditorState,path: Path,value: unknown): string {
  if (!record(value)) return '<p class="story-editor-hint">条件尚未配置。</p>';
  const group=Array.isArray(record(value)?.conditions); const obj=record(value)!;
  if(group) {
    const rows=array(obj.conditions); return `<section class="story-editor-condition" data-editor-key="condition:${pathText(path)}">${choices(ctx,[['AND','全部满足'],['OR','任一满足']],val(obj,'type'),[...path,'type'],state)}<div class="story-editor-actions"><button type="button" class="mini-action" data-story-condition-add="leaf" data-story-condition-path="${esc(ctx,pathText([...path,'conditions']))}"${disabled(state)}>添加条件</button><button type="button" class="mini-action" data-story-condition-add="group" data-story-condition-path="${esc(ctx,pathText([...path,'conditions']))}"${disabled(state)}>添加条件组</button></div>${rows.map((child,index)=>`<div class="story-editor-condition-child" data-editor-key="condition-row:${pathText(path)}:${index}">${conditionEditor(ctx,state,[...path,'conditions',index],child)}<button type="button" class="mini-action mini-action--danger" data-story-row-action="remove-index" data-story-row-path="${esc(ctx,pathText([...path,'conditions']))}" data-story-row-index="${index}"${disabled(state)}>删除</button></div>`).join('')}</section>`;
  }
  const targets: [string,string][]=[['alwaysTrue','恒真'],['resource','资源'],['spotLevel','设施等级'],['manager','经理'],['flag','标记'],['hasEnh','拥有强化'],['hasTag','拥有标签'],['countTags','标签数量'],['tagCount','分类统计'],['stat','统计函数'],['hasReadStory','完成 Story'],['hasReadStoryInRun','本次 Run 完成 Story'],['visitedStoryInChain','链路经过 Story'],['extra','Extra'],['protoStat','原型统计'],['affectionLevel','好感等级'],['area','当前区域']];
  return `<section class="story-editor-condition-leaf" data-editor-key="condition-leaf:${pathText(path)}">${choices(ctx,targets,val(obj,'target'),[...path,'target'],state)}${scalar(ctx,'条件键',[...path,'key'],val(obj,'key'),state)}${choices(ctx,[['==','等于'],['!=','不等于'],['>=','大于等于'],['<=','小于等于'],['>','大于'],['<','小于']],val(obj,'comparator'),[...path,'comparator'],state)}${scalar(ctx,'比较值',[...path,'value'],val(obj,'value'),state,'number')}</section>`;
}
function clickEditor(ctx: UIContext,state: StoryEditorState,path: Path,interaction: Obj|null,draft: StoryDraft,nodeId: string): string {
  const kind=val(interaction,'kind'); const out=[branch(ctx,'交互形式',[...path,'kind'],kind,[['button','按钮'],['choice','选项组'],['entryCard','剧情入口卡']],state)];
  if(kind==='button') {
    out.push(scalar(ctx,'按钮文案',[...path,'text'],val(interaction,'text'),state,'textarea'));
    const press=record(val(interaction,'press')); const pressPath=[...path,'press'];
    const pressCreate=`<button type="button" class="mini-action" data-story-init-value="press" data-story-path="${esc(ctx,pathText(pressPath))}"${disabled(state)}>配置按击次数</button>`;
    out.push(optional(ctx,'按击次数',pressPath,press!==null,state,press?`${scalar(ctx,'基础次数',[...pressPath,'base'],val(press,'base'),state,'number')}${scalarOptional(ctx,'随机增量上限',press,'rand',[...pressPath,'rand'],state,'number',undefined,draft,nodeId)}`:pressCreate,undefined,draft,nodeId,pressCreate));
    const reply=record(val(interaction,'reply')); const rp=[...path,'reply'];
    const replyCreate=`<button type="button" class="mini-action" data-story-init-branch="talk" data-story-path="${esc(ctx,pathText(rp))}"${disabled(state)}>添加回复</button>`;
    out.push(optional(ctx,'回复',rp,Boolean(reply),state,reply?contentEditor(ctx,state,rp,reply):replyCreate,undefined,draft,nodeId,replyCreate));
    const result=record(val(interaction,'result')); const resPath=[...path,'result'];
    const resultCreate=`<button type="button" class="mini-action" data-story-init-object="true" data-story-path="${esc(ctx,pathText(resPath))}"${disabled(state)}>配置结果</button>`;
    out.push(optional(ctx,'结果',resPath,Boolean(result),state,result?resultEditor(ctx,state,resPath,result,draft,nodeId):resultCreate,undefined,draft,nodeId,resultCreate));
  }
  if(kind==='choice') {
    const shared=Boolean(interaction&&hasOwn(interaction,'sharedActions')); const sp=[...path,'sharedActions']; out.push(optional(ctx,'共同动作',sp,shared,state,actionList(ctx,state,sp,array(val(interaction,'sharedActions')),draft,nodeId),undefined,draft,nodeId));
    const optionsPath=[...path,'options']; const options=array(val(interaction,'options'));
    out.push(listHeader(ctx,'选项（按顺序）',optionsPath,state),...options.map((item,index)=>choiceOption(ctx,state,[...optionsPath,index],record(item),optionsPath,index,options.length,draft,nodeId)));
  }
  if(kind==='entryCard') out.push(entryCardEditor(ctx,state,[...path,'card'],record(val(interaction,'card')),[...path,'card','request']));
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function choiceOption(ctx:UIContext,state:StoryEditorState,path:Path,opt:Obj|null,listPath:Path,index:number,total:number,draft:StoryDraft,nodeId:string):string {
  const id=val(opt,'id'); const out=[`<label class="story-editor-property">选项 ID<code>${esc(ctx,id)}</code></label>`,scalar(ctx,'选项文案',[...path,'text'],val(opt,'text'),state,'textarea')];
  const cp=[...path,'condition']; const cond=val(opt,'condition');
  const conditionCreate=`<button type="button" class="mini-action" data-story-init-condition="true" data-story-path="${esc(ctx,pathText(cp))}"${disabled(state)}>配置条件</button>`;
  out.push(optional(ctx,'条件',cp,cond!==undefined,state,cond!==undefined?conditionEditor(ctx,state,cp,cond):conditionCreate,undefined,draft,nodeId,conditionCreate));
  const rp=[...path,'reply']; const reply=record(val(opt,'reply'));
  const replyCreate=`<button type="button" class="mini-action" data-story-init-branch="talk" data-story-path="${esc(ctx,pathText(rp))}"${disabled(state)}>添加回复</button>`;
  out.push(optional(ctx,'回复',rp,Boolean(reply),state,reply?contentEditor(ctx,state,rp,reply):replyCreate,undefined,draft,nodeId,replyCreate));
  const resPath=[...path,'result']; const result=record(val(opt,'result'));
  const resultCreate=`<button type="button" class="mini-action" data-story-init-object="true" data-story-path="${esc(ctx,pathText(resPath))}"${disabled(state)}>配置结果</button>`;
  out.push(optional(ctx,'结果',resPath,Boolean(result),state,result?resultEditor(ctx,state,resPath,result,draft,nodeId):resultCreate,undefined,draft,nodeId,resultCreate));
  const rowId=rowIdAt(draft,nodeId,listPath,index)??String(id);
  return `<section class="story-editor-property-row" data-editor-key="choice:${esc(ctx,rowId)}">${out.join('')}${rowButtons(ctx,listPath,rowId,index,total,state)}</section>`;
}
function talkletEditor(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,node:Obj):string {
  const content=record(val(node,'content')); const kind=val(content,'kind'); const out:string[]=[];
  out.push(branch(ctx,'正文形式',['content','kind'],kind,[['talk','对话'],['narration','旁白']],state));
  out.push(scalar(ctx,'正文',['content','text'],val(content,'text'),state,'textarea'));
  if(kind==='talk') {
    const speaker=val(content,'speaker'); const known=[...ctx.game.registry.characters.values()].map(character=>`<option value="character:${esc(ctx,character.id)}"${speaker===character.displayName?' selected':''}>${esc(ctx,character.displayName)}</option>`).join('');
    const sender=speaker==='老师'?'teacher':speaker===undefined?'':`character:${[...ctx.game.registry.characters.values()].find(character=>character.displayName===speaker)?.id??''}`;
    out.push(`<label class="story-editor-property">发出方<select data-editor-key="sender" data-editor-field="sender"${disabled(state)}><option value="narrator">旁白</option><option value="teacher"${sender==='teacher'?' selected':''}>老师</option>${known}<option value="original"${sender==='original'?' selected':''}>保留原显示名</option></select></label>`,scalar(ctx,'发出方（自由显示名）',['content','speaker'],val(content,'speaker'),state),scalar(ctx,'图片引用',['content','image'],val(content,'image'),state,'image',undefined,'可从图片目录选择，也可填当前内容的直接资源引用。'));
  }
  const presentation=record(val(node,'presentation')); out.push(optional(ctx,'呈现', ['presentation'],Boolean(presentation),state,presentationEditor(ctx,state,['presentation'],presentation),'头像隐藏时头像不显示；组合仍保留。',draft,String(val(node,'id'))));
  const pacing=record(val(node,'pacing')); const canPace=kind==='talk'&&record(val(node,'presentation'))?.side!=='right';
  // Enabled pacing always renders both inputs, so a freshly enabled switch is not blank.
  out.push(optional(ctx,'输入节奏', ['pacing'],Boolean(pacing),state,`${scalar(ctx,'打字时长（秒）',['pacing','typing'],val(pacing,'typing'),state,'number')}${scalar(ctx,'思考时长（秒）',['pacing','thinking'],val(pacing,'thinking'),state,'number')}`,canPace?'仅非右侧对话可启用。0 表示显式关闭；缺省沿用播放器默认。':'旁白或右侧对话下休眠，切回后恢复。',draft,String(val(node,'id'))));
  return out.join('');
}

export function renderStoryNodeProperties(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,node:StoryDraftNode,index:number):string {
  const n=node as unknown as Obj; const type=val(n,'type'); const pType=`<label class="story-editor-property">节点类型<select data-editor-key="node-type:${node.id}" data-story-node-type${disabled(state)}>${[['talklet','Talklet'],['click','Click'],['operation','Operation'],['transfer','Transfer']].map(([v,l])=>`<option value="${v}"${v===type?' selected':''}>${l}</option>`).join('')}</select></label>`;
  const base=`<label class="story-editor-property">节点 ID<code>${esc(ctx,node.id)}</code></label>${scalar(ctx,'需要局部标记（可选）',['requiresFlag'],val(n,'requiresFlag'),state,'text',undefined,'留空时正常执行；填写后只在 Entry 局部表中存在该键时执行。')}`;
  let body='';
  if(type==='talklet') body=talkletEditor(ctx,state,draft,n)+stageEditor(ctx,state,draft,n);
  else if(type==='click') body=clickEditor(ctx,state,['interaction'],record(val(n,'interaction')),draft,node.id)+stageEditor(ctx,state,draft,n);
  else if(type==='operation') body=actionEditor(ctx,state,['action'],record(val(n,'action')),draft,node.id);
  else if(type==='transfer') body=transferEditor(ctx,state,['transfer'],record(val(n,'transfer')),draft);
  const error=draft.editorIssues?.filter(issue=>issue.path.startsWith(`nodes[${index}]`)).map(issue=>issueDiagnostic(ctx,state,issue,index)).join('')??'';
  return `<div class="story-editor-fields" data-editor-key="inspector:${esc(ctx,node.id)}" data-story-node-properties="${esc(ctx,node.id)}">${pType}${base}<div class="story-editor-property-content" data-editor-key="property-content:${esc(ctx,node.id)}">${body}</div>${error}<div class="story-editor-actions"><button type="button" class="mini-action" data-editor-action="up"${index===0||state.storageBlocked?' disabled':''}>上移</button><button type="button" class="mini-action" data-editor-action="down"${index===draft.document.nodes.length-1||state.storageBlocked?' disabled':''}>下移</button><button type="button" class="mini-action mini-action--danger" data-editor-action="delete-node"${disabled(state)}>删除节点</button></div></div>`;
}
function parseRelativePath(raw:string):Path|null {
  const path:(string|number)[]=[]; const pattern=/\.([^.[\]]+)|\[(\d+)\]/g; let match:RegExpExecArray|null;
  while((match=pattern.exec(raw))) path.push(match[1]===undefined?Number(match[2]):match[1]);
  return path.length?path:null;
}
function issueDiagnostic(ctx:UIContext,state:StoryEditorState,issue:{path:string;message:string},index:number):string {
  const path=parseRelativePath(issue.path.slice(`nodes[${index}]`.length));
  const clear=path?`<button type="button" class="mini-action mini-action--danger" data-story-remove-readonly="true" data-story-optional-path="${esc(ctx,pathText(path))}"${disabled(state)}>清理该字段</button>`:'';
  return `<p class="story-editor-error" data-story-issue-path="${esc(ctx,issue.path)}">${esc(ctx,issue.message)}${clear}</p>`;
}
function stageEditor(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,node:Obj):string {
  const stageId=val(node,'stageId'); const stage=typeof stageId==='string'?record(draft.document.stages[stageId]):null;
  const opts=Object.keys(draft.document.stages).map(id=>`<option value="${esc(ctx,id)}"${id===stageId?' selected':''}>${esc(ctx,id)}</option>`).join('');
  return `<details class="story-editor-advanced" data-editor-key="stage:${String(stageId??'new')}"><summary>阶段</summary><label class="story-editor-property">阶段<select data-editor-key="stage-id:${esc(ctx,stageId)}" data-story-property-path='["stageId"]'${disabled(state)}><option value="">选择阶段…</option>${opts}</select></label><label class="story-editor-property">新建阶段 ID<input data-editor-key="new-stage-name" data-story-stage-name placeholder="stage-name"${readOnly(state)}></label><div class="story-editor-actions"><button type="button" class="mini-action" data-story-create-stage${disabled(state)}>新建并使用</button></div><label class="story-editor-property">推进方式<select data-editor-key="stage-advance:${esc(ctx,stageId)}" data-story-property-path='["stages","${esc(ctx,stageId)}","advance"]'${disabled(state)}><option value="auto"${stage?.advance==='auto'?' selected':''}>自动</option><option value="input"${stage?.advance==='input'?' selected':''}>等待输入</option></select></label><small class="story-editor-hint">阶段顺序由节点列表决定；改变分组不会自动改推进方式。</small></details>`;
}

export function propertyNodeKind(node: StoryDraftNode): string { return node.type; }
function entityPresentationTargets(ctx:UIContext):Array<{value:string;label:string}> {
  const r=ctx.game.registry; const out:Array<{value:string;label:string}>=[];
  const add=(type:string,items:Iterable<any>,name:(item:any)=>string)=>{for(const item of items){if(item.presentation)out.push({value:`${type}:${item.id}`,label:`${name(item)} · ${type}:${item.id}`});}};
  add('init',r.inits.values(),x=>x.name||x.id); add('area',r.areas.values(),x=>x.name||x.id); add('spot',r.spots.values(),x=>x.name||x.id); add('enhancement',r.enhancements.values(),x=>x.name||x.id); add('variant',r.characterVariants.values(),x=>x.displayName||x.id);
  return out;
}
type PresentationOptionSource = { readonly presentation?: { readonly additions?: readonly { readonly id: string; readonly label: string }[] } };
function targetOptionValues(ctx:UIContext,target:unknown):Array<[string,string]> {
  if(typeof target!=='string')return[]; const [type,...rest]=target.split(':'); const id=rest.join(':');
  const registry=ctx.game.registry;
  const maps:Record<string,ReadonlyMap<string,PresentationOptionSource>>={init:registry.inits,area:registry.areas,spot:registry.spots,enhancement:registry.enhancements,variant:registry.characterVariants};
  return (maps[type]?.get(id)?.presentation?.additions??[]).map(option=>[option.id,option.label]);
}
