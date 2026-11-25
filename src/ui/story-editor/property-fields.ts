import { renderRequiredFlagControl } from './required-flag-dropdown';
import { renderLocalFlagNaviButton } from './local-flag-navi';
import { currentStoryFlagCatalog, renderStoryFlagSuggestions } from './flag-catalog-view';
import { storyFlagNames } from './flag-catalog';
import { renderStoryTransfer } from './transfer-view';
import { structuredKey } from './authoring-model';
import { choiceOptionFlagBindings, currentDraft } from './model';
import { renderStructuredValue } from './structured-value';
import type { UIContext } from '../runtime/context';
import { renderTabs } from '../components/shared/tabs';
import type { StoryDraft, StoryDraftNode, StoryEditorState } from './model';
import { localFlagInput } from './flag-fields';
import { isOptionalEnabled, literalKindAt, propertyKey, readStoryNodeBody, rowIdAt } from './property-model';
import { storyReferenceOptions, type StoryReferenceKind } from './property-options';
import { STORY_CONDITION_COMPARATORS, STORY_CONDITION_HINTS, STORY_CONDITION_REFERENCES, STORY_CONDITION_TARGETS } from './condition-fields';
import { renderChatTexts, resolveStorySpeaker, type ChatTextEntry } from '../components/story/story';
import { renderChatEntry, renderStoryClickPreview, renderStoryClickAppearance, renderStoryNodePlacement } from '../components/story/story';
import { projectStoryContent, storyNodeDisplay } from '../../data-services/authoring/story-content-display';

type Path = readonly (string | number)[];
type Obj = Record<string, unknown>;
const record = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const pathText = (path: Path): string => JSON.stringify(path);
const key = (path: Path, suffix = ''): string => `property:${pathText(path)}${suffix}`;
const esc = (ctx: UIContext, value: unknown): string => ctx.escapeHtml(value == null ? '' : String(value));
const val = (object: Obj | null, name: string): unknown => object?.[name];
const hasOwn = (object: object, name: string): boolean => Object.prototype.hasOwnProperty.call(object, name);
const disabled = (state: StoryEditorState): string => (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : '';
const readOnly = (state: StoryEditorState): string => (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' readonly' : '';
const localFlagFields = (ctx: UIContext, state: StoryEditorState, draft: StoryDraft, node: Extract<StoryDraftNode, { type: 'operation' }>): string => {
  const action = node.action;
  if (action?.kind !== 'localFlag') return '';
  const input = localFlagInput(node, draft.localFlagInputs);
  const type = input?.type ?? 'structured';
  return `<div data-editor-key="local-flag-fields">
    <label>局部标记操作<select data-editor-key="local-flag-op" data-editor-field="local-flag-op"${disabled(state)}>${action.op ? '' : '<option value="" selected>选择操作</option>'}<option value="set"${action.op === 'set' ? ' selected' : ''}>写入 / 覆盖</option><option value="remove"${action.op === 'remove' ? ' selected' : ''}>移除</option></select></label>
    <label>标记名称<span class="story-editor-flag-control"><input data-editor-key="local-flag-name" data-editor-field="local-flag-name" list="story-editor-local-flags" value="${esc(ctx,action.name ?? '')}" placeholder="StoryName-flagid"${readOnly(state)}>${renderLocalFlagNaviButton((state.storageBlocked || Boolean(state.readOnlyReason)))}</span></label>
    ${action.op === 'set' ? `<label>值类型<select data-editor-key="local-flag-type" data-editor-field="local-flag-type"${disabled(state)}><option value="structured"${type === 'structured' ? ' selected' : ''}>对象 / 列表</option>${[['string', '文字'], ['number', '数字'], ['boolean', '布尔'], ['null', '空值']].map(([value, label]) => `<option value="${value}"${type === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      ${type === 'structured' ? structuredField(ctx,state,['action','value'],action.value,'局部标记值') : type === 'null' ? '<p class="story-editor-hint">空值仍代表键存在。</p>' : type === 'boolean'
        ? `<label>值<select data-editor-key="local-flag-value-boolean" data-editor-field="local-flag-value"${disabled(state)}><option value="false"${input?.text === 'false' ? ' selected' : ''}>false</option><option value="true"${input?.text === 'true' ? ' selected' : ''}>true</option></select></label>`
        : `<label>值<input data-editor-key="local-flag-value" data-editor-field="local-flag-value" value="${esc(ctx,input?.text ?? '')}"${type === 'number' ? ' inputmode="decimal"' : ''}${readOnly(state)}></label>`}` : ''}
    <p class="story-editor-hint">仅本次 Entry 有效；条件只检查键是否存在，不比较值。</p></div>`;
};
const choices = (ctx: UIContext, values: readonly [string, string][], current: unknown, path: Path, state: StoryEditorState, allowDefault = false): string => {
  const selected = current === undefined ? '' : String(current);
  const missing = selected && !values.some(([value]) => value === selected)
    ? `<option value="${esc(ctx, selected)}" selected>${esc(ctx, selected)}（原值，目录中不存在）</option>` : '';
  return `<select data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, pathText(path))}"${disabled(state)}>${allowDefault || !selected ? `<option value=""${selected ? '' : ' selected'}>${allowDefault?'沿用默认':'选择…'}</option>` : ''}${missing}${values.map(([value, label]) => `<option value="${esc(ctx, value)}"${value === selected ? ' selected' : ''}>${esc(ctx, label)}</option>`).join('')}</select>`;
};
function labelledChoices(ctx: UIContext, label: string, values: readonly [string,string][], current: unknown, path: Path, state: StoryEditorState, allowDefault = false): string {
  return `<label class="story-editor-property">${esc(ctx,label)}${choices(ctx,values,current,path,state,allowDefault)}</label>`;
}
function scalar(ctx: UIContext, label: string, path: Path, value: unknown, state: StoryEditorState, kind: 'text' | 'textarea' | 'number' | 'boolean' | 'ref' | 'image' = 'text', ref?: StoryReferenceKind, hint?: string, flagKind?: 'local' | 'global', omitEmpty = false): string {
  const p = pathText(path); const current = value == null ? '' : String(value);
  let control: string;
  if (kind === 'boolean') control = `<select data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}"${disabled(state)}><option value="false"${value === false ? ' selected' : ''}>false</option><option value="true"${value === true ? ' selected' : ''}>true</option></select>`;
  else if (kind === 'ref' && ref) {
    const options = storyReferenceOptions(ctx, ref, state); const found = options.some(option => option.value === current);
    const old = current && !found ? `<option value="${esc(ctx, current)}" selected data-reference-missing>${esc(ctx, current)}（引用不存在）</option>` : '';
    control = `<select data-story-reference="${ref}" data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}"${disabled(state)}><option value=""${current ? '' : ' selected'}>选择${ref === 'entry' ? '入口' : '内容'}…</option>${old}${options.map(option => `<option value="${esc(ctx, option.value)}"${option.value === current ? ' selected' : ''}>${esc(ctx, option.label)}</option>`).join('')}</select>`;
  } else if (kind === 'image') { const listId=`story-image-options-${p.replace(/[^a-zA-Z0-9_-]/g,'-')}`; control = `<input data-story-reference="image" list="${listId}" data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}" value="${esc(ctx,current)}"${readOnly(state)}><datalist id="${listId}">${storyReferenceOptions(ctx,'image').map(option=>`<option value="${esc(ctx,option.value)}" label="${esc(ctx,option.label)}"></option>`).join('')}</datalist>`; }
  else if (kind === 'textarea') control = `<textarea rows="3" data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}"${readOnly(state)}>${esc(ctx, current)}</textarea>`;
  else control = `<input data-editor-key="${esc(ctx, key(path))}" data-story-property-path="${esc(ctx, p)}" value="${esc(ctx, current)}"${kind === 'number' ? ' inputmode="decimal"' : ''}${readOnly(state)}>`;
  if (omitEmpty) control = control.replace('data-story-property-path=', 'data-story-omit-empty="true" data-story-property-path=');
  flagKind ??= path.at(-1) === 'requiresFlag' || label === '局部标记名称' ? 'local' : path.at(-1) === 'flagId' ? 'global' : undefined;
  if (flagKind === 'global') control = control.replace('<input ', '<input data-story-reference="globalFlag" ');
  if (flagKind) control = control.replace('<input ', `<input list="story-editor-${flagKind}-flags" `);
  if (flagKind === 'local') control = path.length === 1 && path.at(-1) === 'requiresFlag' ? renderRequiredFlagControl(ctx,state,control) : `<span class="story-editor-flag-control">${control}${renderLocalFlagNaviButton((state.storageBlocked || Boolean(state.readOnlyReason)))}</span>`;
  const pathId = JSON.stringify(path); const legacy = pathId === '[\"requiresFlag\"]' ? 'requires-flag' : pathId === '[\"content\",\"text\"]' || pathId === '[\"interaction\",\"text\"]' ? 'text' : '';
  if (legacy) control = control.replace('<input ', `<input data-editor-field=\"${legacy}\" `).replace('<textarea ', `<textarea data-editor-field=\"${legacy}\" `).replace('<select ', `<select data-editor-field=\"${legacy}\" `);
  return `<label class="story-editor-property">${esc(ctx, label)}${control}${hint ? `<small class="story-editor-hint">${esc(ctx, hint)}</small>` : ''}</label>`;
}

function bodyEditor(ctx: UIContext, state: StoryEditorState, draft: StoryDraft, nodeId: string): string {
  const node = draft.document.nodes.find(item => item.id === nodeId) as unknown as Obj | undefined;
  const interaction = node?.type === 'click' ? record(val(node,'interaction')) : null;
  const kind = val(interaction,'kind');
  const path = node?.type === 'talklet' ? ['content','text']
    : kind === 'button' ? ['interaction','text']
      : kind === 'entryCard' ? ['interaction','card','buttonText']
        : kind === 'areaContinue' ? ['interaction','buttonText'] : undefined;
  const property = path ? ` data-story-property-path="${esc(ctx,pathText(path))}"` : '';
  const hint = ['entryCard','areaContinue'].includes(String(kind)) ? '<small class="story-editor-hint">留空时使用该入口的默认按钮文案。</small>' : '';
  return `<label class="story-editor-property">正文<textarea rows="3" data-editor-field="text" data-editor-key="story-body:${esc(ctx,nodeId)}" data-story-body-node="${esc(ctx,nodeId)}"${property}${readOnly(state)}>${esc(ctx,readStoryNodeBody(draft,nodeId))}</textarea>${hint}</label>`;
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
  return `<div class="story-editor-actions"><button type="button" class="mini-action" data-story-row-action="up" ${attr}${index === 0 || (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}>上移</button><button type="button" class="mini-action" data-story-row-action="down" ${attr}${index === total - 1 || (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}>下移</button><button type="button" class="mini-action mini-action--danger" data-story-row-action="remove" ${attr}${(state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}>删除</button></div>`;
}
function listHeader(ctx: UIContext, title: string, path: Path, state: StoryEditorState): string {
  return `<div class="story-editor-list-heading"><strong>${esc(ctx, title)}</strong><button type="button" class="mini-action" data-story-row-action="add" data-story-row-path="${esc(ctx, pathText(path))}"${disabled(state)}>添加</button></div>`;
}

function contentEditor(ctx: UIContext, state: StoryEditorState, path: Path, content: Obj | null, presentation = false): string {
  const kind = val(content, 'kind'); const out = [branch(ctx, '内容形式', [...path, 'kind'], kind, [['talk', '对话'], ['narration', '旁白']], state)];
  out.push(scalar(ctx, '正文', [...path, 'text'], val(content, 'text'), state, 'textarea'));
  if (kind === 'talk') {
    out.push(scalar(ctx, '发出方角色', [...path, 'characterId'], val(content, 'characterId'), state, 'ref', 'character'));
    out.push(scalar(ctx, '发出方（显示名）', [...path, 'displayName'], val(content, 'displayName'), state, 'text', undefined, '留空使用角色默认名称；只修改文字，保留角色头像。'));
    out.push(scalar(ctx, '图片引用', [...path, 'image'], val(content, 'image'), state, 'image', undefined, '从数据包图片目录选择。'));
  }
  if (presentation) out.push(presentationEditor(ctx, state, [...path.slice(0, 1), 'presentation'], null));
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function presentationEditor(ctx: UIContext, state: StoryEditorState, path: Path, presentation: Obj | null): string {
  return `<section class="story-editor-presentation" data-editor-key="${esc(ctx, key(path, ':presentation'))}">
    <h3>呈现</h3>
    <label class="story-editor-property">气泡位置${choices(ctx, [['left','左侧'],['right','右侧']], val(presentation,'side'), [...path,'side'], state, true)}<small class="story-editor-hint">控制对话气泡在左侧或右侧显示；留空沿用默认。</small></label>
    <label class="story-editor-property">文字对齐${choices(ctx, [['left','左对齐'],['center','居中'],['right','右对齐']], val(presentation,'align'), [...path,'align'], state, true)}<small class="story-editor-hint">用于旁白文字的对齐，默认居中。</small></label>
    <label class="story-editor-property">头像显示${choices(ctx, [['auto','自动'],['hide','隐藏'],['show','显示']], val(presentation,'avatarMode'), [...path,'avatarMode'], state, true)}<small class="story-editor-hint">自动跟随连发分组；隐藏时不显示头像；显示时连发仍显示头像与名称。</small></label>
    ${scalar(ctx,'头像引用',[...path,'avatar'],val(presentation,'avatar'),state,'image',undefined,'覆盖角色头像；留空使用角色默认头像。隐藏时仍保留此引用。',undefined,true)}
  </section>`;
}
function transferEditor(ctx: UIContext, state: StoryEditorState, path: Path, value: Obj | null, draft?: StoryDraft): string {
  const mode=val(value,'mode'); const id=String(val(value,'storyId')??''); const target=ctx.game.registry.stories.get(id);
  return `<div class="story-editor-property-group">${branch(ctx,'转移方式',[...path,'mode'],mode,[['goto','跳转'],['insert','插入并返回']],state)}${draft ? storyReference(ctx,state,[...path,'storyId'],id,draft) : scalar(ctx,'Story',[...path,'storyId'],id,state,'ref','story')}<p class="story-editor-hint">${mode==='goto'?`goto 离开当前正文并进入“${esc(ctx,target?.name??(id||'目标 Story'))}”；不创建返回点。`:`insert 先播放“${esc(ctx,target?.name??(id||'目标 Story'))}”，结束后回到调用位置的下一节点。`}</p>${renderStoryTransfer(ctx,state,{ mode: mode === 'goto' || mode === 'insert' ? mode : undefined, storyId: id })}</div>`;
}
function storyReference(ctx: UIContext,state:StoryEditorState,path:Path,value:unknown,draft:StoryDraft):string {
  const current=value==null?'':String(value); const options=storyReferenceOptions(ctx,'story',state); const self=draft.document.id;
  const missing=current&&!options.some(item=>item.value===current)&&current!==self?`<option value="${esc(ctx,current)}" selected data-reference-missing>${esc(ctx,current)}（目标不存在）</option>`:'';
  const entries=[...options,...(options.some(item=>item.value===self)?[]:[{value:self,label:`${draft.document.name||self}（当前 Story）`}])];
  return `<label class="story-editor-property">Story<select data-story-reference="story" data-editor-key="${esc(ctx,key(path))}" data-story-property-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value=""${current?'':' selected'}>选择 Story…</option>${missing}${entries.map(item=>`<option value="${esc(ctx,item.value)}"${item.value===current?' selected':''}>${esc(ctx,item.label)}</option>`).join('')}</select></label>`;
}
function cursorOwnerSelect(ctx: UIContext, state: StoryEditorState, path: Path, owner: unknown): string {
  const characters = [...ctx.game.registry.characters.values()];
  const unknown = typeof owner === 'string' && !ctx.game.registry.characters.has(owner);
  const missing = unknown ? `<option value="${esc(ctx,owner)}" selected data-reference-missing>${esc(ctx,owner)}（原值，角色目录中不存在）</option>` : '';
  return `<label class="story-editor-property">游标归属<select data-story-reference="character" data-editor-key="${esc(ctx,key(path))}" data-story-property-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value="__global__"${owner == null ? ' selected' : ''}>全局（null）</option>${characters.map(character => `<option value="${esc(ctx,character.id)}"${owner === character.id ? ' selected' : ''}>${esc(ctx,character.displayName)}</option>`).join('')}${missing}</select><small class="story-editor-hint">全局 null 与角色字符串是两种显式取值。</small></label>`;
}
function entryCardEditor(ctx: UIContext, state: StoryEditorState, path: Path, card: Obj | null, requestPath: Path, draft: StoryDraft, nodeId: string): string {
  const request = record(val(card,'request')) ?? record(card);
  const out = [storyEntryReference(ctx,state,[...requestPath,'entryId'],val(request,'entryId'),draft), cursorOwnerSelect(ctx,state,[...requestPath,'owner'],val(request,'owner'))];
  out.push(scalar(ctx,'标题',[...path,'title'],val(card,'title'),state,'text',undefined,'留空沿用目标入口标题。',undefined,true),labelledChoices(ctx,'卡片对齐',[['left','左'],['right','右']],val(card,'align'),[...path,'align'],state,true));
  const continuation = record(val(card,'continuation'));
  const continuationPath = [...path,'continuation'];
  const continuationCreate = `<button type="button" class="mini-action" data-story-init-object="true" data-story-path="${esc(ctx,pathText(continuationPath))}"${disabled(state)}>完成后返回当前故事</button>`;
  out.push(continuation ? optional(ctx,'父故事续接',continuationPath,true,state,
    `${scalar(ctx,'赴约地点',[...continuationPath,'areaId'],val(continuation,'areaId'),state,'ref','area')}${structuredField(ctx,state,[...continuationPath,'returnFlags'],continuation.returnFlags,'回传局部标记白名单')}`,
    undefined,draft,nodeId) : continuationCreate);
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function storyEntryReference(ctx: UIContext,state:StoryEditorState,path:Path,value:unknown,draft:StoryDraft):string {
  const current=value==null?'':String(value);
  const options=storyReferenceOptions(ctx,'activeEntry',state);
  const missing=current&&!options.some(item=>item.value===current)?`<option value="${esc(ctx,current)}" selected data-reference-missing>${esc(ctx,current)}（目标不存在）</option>`:'';
  return `<label class="story-editor-property">目标 StoryEntry<select data-story-reference="activeEntry" data-editor-key="${esc(ctx,key(path))}" data-story-property-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value=""${current?'':' selected'}>选择主动 Entry…</option>${missing}${options.map(item=>`<option value="${esc(ctx,item.value)}"${item.value===current?' selected':''}>${esc(ctx,item.label)}</option>`).join('')}</select></label>`;
}

const actionKinds: readonly [string,string][] = [['clearNode','清除节点展示'],['state','状态动作'],['travel','移动'],['entryRequest','请求剧情入口'],['overlay','覆盖层演出'],['presentation','表现演出'],['localFlag','局部标记']];
function actionImpact(ctx:UIContext,action:Obj|null):string {
  const kind=val(action,'kind'); const command=record(val(action,'command')); const name=val(command,'command');
  if(kind==='localFlag')return '只改本次 Entry 的局部标记；不会写入持久 flags。';
  if(kind==='state')return '提交持久状态动作；后续状态变化由 Runtime 保留。';
  if(kind==='travel')return `真实旅行到${ctx.game.registry.areas.get(String(val(action,'areaId')??''))?.name??'目标 Area'}，不是移动屏幕上的内容。`;
  if(kind==='entryRequest')return '向 Runtime 请求指定 Entry；是否接纳、阻塞或延后由入口与会话规则决定。';
  if(kind==='overlay'){
    if(name==='show')return `在当前 owner 聊天窗格显示覆盖层（ID：${String(val(command,'id')??'未填写')}）；同 ID 后写内容替换旧覆盖层。`;
    if(name==='clearId')return `只清除当前 owner 的覆盖层“${String(val(command,'id')??'未填写')}”。`;
    if(name==='clearAllTexts')return '清除当前 owner 的全部覆盖层，保留聊天历史与剧情进度。';
    if(name==='clearFlow')return '清除当前 owner 的聊天流内容，不回退已执行动作或剧情进度。';
    return '';
  }
  if(kind==='presentation'){
    if(name==='theme') {const theme=record(val(command,'value'));const scope=val(theme,'scope')??'ephemeral';return scope==='ephemeral'?'设置本 Story Run 的临时主题；Run 结束后清理。':`设置${scope==='area'?'Area':'角色'}主题槽，后续表现会继续使用该槽。`;}
    if(name==='setEntityPresentation') {const lifetime=val(command,'lifetime')??'manual';return lifetime==='story'?'按当前 Story Run 持有，Run 结束时清理。':lifetime==='area'?'Area 变化时清理。':lifetime==='init'?'切换 Init 时清理。':'手动生命周期；需有对应 clearEntityPresentation 才会清理。';}
    if(name==='clearEntityPresentation')return '按目标和持有者清除可见的匹配覆盖；不会恢复已写入的主题槽。';
    if(name==='openingTitle')return '在当前 Story 输出通道显示开幕标题，不改变正文去向。';
  }
  return '';
}
function actionEditor(ctx: UIContext, state: StoryEditorState, path: Path, action: Obj | null, draft: StoryDraft, nodeId: string): string {
  const kind = val(action,'kind'); const out = [branch(ctx,'行为类型',[...path,'kind'],kind,actionKinds,state)];
  if (kind === 'clearNode') {
    const storyId=String(val(action,'storyId')??'');
    const target=storyId===draft.document.id?draft.document:ctx.game.registry.stories.get(storyId);
    const nodes=(target?.nodes??[]).filter(node=>node.type==='talklet'||node.type==='click');
    out.push(storyReference(ctx,state,[...path,'storyId'],storyId,draft),labelledChoices(ctx,'目标节点',nodes.map(node=>[node.id,node.id]),val(action,'nodeId'),[...path,'nodeId'],state),`<button type="button" class="mini-action" data-story-display-target="${esc(ctx,storyId)}" data-story-display-node="${esc(ctx,val(action,'nodeId'))}"${nodes.some(node=>node.id===val(action,'nodeId'))?'':' disabled'}>查看目标节点</button><p class="story-editor-hint">清除本次运行内目标节点的全部展示；不撤销标记、效果或执行进度。</p>`);
  } else if (kind === 'localFlag') {
    const node = draft.document.nodes.find(item => item.id === nodeId);
    if (node?.type === 'operation' && path.length === 1 && path[0] === 'action') out.push(localFlagFields(ctx, state, draft, node));
    else {
      out.push(`<label class="story-editor-property">局部标记操作${choices(ctx,[['set','写入 / 覆盖'],['remove','移除']],val(action,'op'),[...path,'op'],state)}</label>`,scalar(ctx,'局部标记名称',[...path,'name'],val(action,'name'),state));
      if (val(action,'op') === 'set') out.push(structuredField(ctx,state,[...path,'value'],val(action,'value'),'局部标记值'));
    }
  } else if (kind === 'travel') out.push(scalar(ctx,'区域',[...path,'areaId'],val(action,'areaId'),state,'ref','area'),scalarOptional(ctx,'显示移动通知',action,'notice',[...path,'notice'],state,'boolean',undefined,draft,nodeId));
  else if (kind === 'entryRequest') {
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
  if (kind === 'presentation') out.push(presentationActionEditor(ctx,state,[...path,'command'],record(val(action,'command')),draft,nodeId));
  const impact=actionImpact(ctx,action); if(impact)out.push(`<p class="story-editor-hint"><strong>执行影响：</strong>${esc(ctx,impact)}</p>`);
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function stateActionRow(ctx: UIContext, state: StoryEditorState, path: Path, index: number, rows: unknown[], row: Obj | null, draft: StoryDraft, nodeId: string): string {
  const opValues: [string,string][] = [['setResource','设置资源'],['addResource','增加资源'],['setSpotLevel','设置设施等级'],['addSpotLevel','增加设施等级'],['setManager','设置经理'],['addEnhancement','获得强化'],['addItem','获得物品'],['unlockInit','解锁世界线'],['acquireAreaMap','收录区域地图'],['revealInformation','告知世界信息'],['setFlag','写持久标记'],['setExtra','设置 Extra'],['addExtra','增加 Extra'],['removeExtra','移除 Extra'],['grantCharacter','获得角色'],['addAffectionExp','增加好感经验']];
  const op=val(row,'op'); const p=[...path,index]; const fields: string[]=[];
  fields.push(branch(ctx,'状态动作',[...p,'op'],op,opValues,state));
  if (op==='setResource'||op==='addResource') fields.push(scalar(ctx,'资源',[...p,'resourceId'],val(row,'resourceId'),state,'ref','resource'),numericValueEditor(ctx,'数值',[...p,'amount'],val(row,'amount'),state));
  if (op==='setSpotLevel'||op==='addSpotLevel') fields.push(scalar(ctx,'设施',[...p,'spotId'],val(row,'spotId'),state,'ref','spot'),numericValueEditor(ctx,'数值',[...p,'amount'],val(row,'amount'),state));
  if (op==='setManager') fields.push(scalar(ctx,'设施',[...p,'spotId'],val(row,'spotId'),state,'ref','spot'),scalar(ctx,'经理角色',[...p,'managerId'],val(row,'managerId'),state,'ref','character'));
  if (op==='addEnhancement') fields.push(scalar(ctx,'强化',[...p,'enhancementId'],val(row,'enhancementId'),state,'ref','enhancement'));
  if (op==='addItem') fields.push(scalar(ctx,'物品',[...p,'itemId'],val(row,'itemId'),state,'ref','item'),numericValueEditor(ctx,'数量',[...p,'amount'],val(row,'amount'),state));
  if (op==='unlockInit') fields.push(scalar(ctx,'世界线',[...p,'initId'],val(row,'initId'),state,'ref','init'));
  if (op==='acquireAreaMap') fields.push(scalar(ctx,'地图',[...p,'mapId'],val(row,'mapId'),state,'ref','areaMap'));
  if (op==='revealInformation') {
    const target = record(val(row,'target'));
    const targetPath = [...p,'target'];
    const entityKind = val(target,'entityKind');
    fields.push(branch(ctx,'世界对象类型',[...targetPath,'entityKind'],entityKind,[['area','区域'],['areaMap','区域地图'],['areaMapNode','地图节点']],state));
    if (entityKind === 'area') fields.push(scalar(ctx,'区域',[...targetPath,'entityId'],val(target,'entityId'),state,'ref','area'));
    if (entityKind === 'areaMap') fields.push(scalar(ctx,'地图',[...targetPath,'entityId'],val(target,'entityId'),state,'ref','areaMap'));
    if (entityKind === 'areaMapNode') {
      const mapId = val(target,'mapId');
      const map = typeof mapId === 'string' ? ctx.game.registry.areaMaps.get(mapId) : undefined;
      fields.push(scalar(ctx,'地图',[...targetPath,'mapId'],mapId,state,'ref','areaMap'));
      fields.push(labelledChoices(ctx,'地图节点',(map?.nodes ?? []).map(item => [item.id,item.name || item.id] as [string,string]),val(target,'nodeId'),[...targetPath,'nodeId'],state));
    }
    if (entityKind === 'area' || entityKind === 'areaMap' || entityKind === 'areaMapNode') fields.push(labelledChoices(ctx,'信息面',[['existence','存在'],['name','身份'],['utility','用途'],['condition','方法']],val(target,'target'),[...targetPath,'target'],state));
  }
  if (op==='setFlag') { fields.push(scalar(ctx,'全局标记名称',[...p,'flagId'],val(row,'flagId'),state)); fields.push(literalValueEditor(ctx,'值',[...p,'value'],val(row,'value'),state,draft,nodeId)); }
  if (op==='setExtra'||op==='addExtra'||op==='removeExtra') { fields.push(scalar(ctx,'Extra 路径',[...p,'path'],val(row,'path'),state,'text',undefined,'按现有 ExtraPath 规则填写。')); if(op==='setExtra') fields.push(literalValueEditor(ctx,'值',[...p,'value'],val(row,'value'),state,draft,nodeId)); if(op==='addExtra') fields.push(numericValueEditor(ctx,'增量',[...p,'amount'],val(row,'amount'),state)); }
  if (op==='grantCharacter'||op==='addAffectionExp') { fields.push(scalar(ctx,'角色差分',[...p,'variantId'],val(row,'variantId'),state,'ref','variant')); if(op==='addAffectionExp') fields.push(numericValueEditor(ctx,'经验',[...p,'amount'],val(row,'amount'),state)); }
  const rowId=rowIdAt(draft,nodeId,path,index)??String(index);
  return `<div class="story-editor-property-row" data-editor-key="effect:${esc(ctx,rowId)}">${fields.join('')}${rowButtons(ctx,path,rowId,index,rows.length,state)}</div>`;
}
function structuredField(ctx: UIContext, state: StoryEditorState, path: Path, value: unknown, title: string): string {
  const draft = currentDraft(state);
  const flags = currentStoryFlagCatalog(ctx,state);
  const globalFlags = storyFlagNames(flags,'global').map(name=>({value:name,label:name}));
  const localFlags = [...new Set(flags.uses.filter(use=>use.kind==='local').map(use=>use.name))].map(name=>({value:name,label:name}));
  return renderStructuredValue(ctx, state.selectedNodeId ?? '', path, value, title, draft?.structuredInputs, (state.storageBlocked || Boolean(state.readOnlyReason)), 0, draft ? (scope, p) => structuredKey(draft,scope,p) : undefined, {flagId:globalFlags,$globalFlags:globalFlags,$localFlags:localFlags});
}
function numericValueEditor(ctx: UIContext,label: string,path: Path,value: unknown,state: StoryEditorState): string {
  if (typeof value === 'number' || value === undefined || typeof value === 'string') return `${scalar(ctx,label,path,value,state,'number')}<label class="story-editor-property">数值构造<select data-value-type data-value-scope="${esc(ctx,state.selectedNodeId)}" data-value-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value="">选择表达式构造…</option><option value="const">常量表达式</option><option value="value">读取数值</option><option value="add">加法</option><option value="mul">乘法</option><option value="clamp">范围限制</option></select></label>`;
  return structuredField(ctx,state,path,value,label);
}
function literalValueEditor(ctx: UIContext,label: string,path: Path,value: unknown,state: StoryEditorState,draft: StoryDraft,nodeId: string): string {
  if (value !== null && value !== undefined && typeof value === 'object') return structuredField(ctx,state,path,value,label);
  const recorded=literalKindAt(draft,nodeId,path);
  const kind=recorded ?? (typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : typeof value === 'string' ? 'string' : undefined);
  const kindSelect=`<label class="story-editor-property">${esc(ctx,label)}类型<select data-story-literal-kind-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value=""${kind?'':' selected'}>选择类型…</option>${[['string','文字'],['number','数字'],['boolean','布尔']].map(([value,text])=>`<option value="${value}"${value===kind?' selected':''}>${esc(ctx,text)}</option>`).join('')}</select><small class="story-editor-hint">持久标记只接受标量或数值表达式；Extra 还支持有类型的复合结构。</small></label>`;
  const control=kind==='boolean' ? scalar(ctx,label,path,value===true,state,'boolean')
    : kind==='number' ? scalar(ctx,label,path,value,state,'number')
    : scalar(ctx,label,path,value,state,'text');
  return `<div class="story-editor-literal" data-editor-key="${esc(ctx,key(path,':literal'))}">${kindSelect}${control}${structuredField(ctx,state,path,value,`${label} / 结构化构造`)}</div>`;
}
function overlayEditor(ctx: UIContext,state: StoryEditorState,path: Path,value: Obj|null,draft: StoryDraft,nodeId: string): string {
  const command=val(value,'command'); const listId=`story-overlay-ids-${pathText(path).replace(/[^a-zA-Z0-9_-]/g,'-')}`; const out=[branch(ctx,'覆盖层命令',[...path,'command'],command,[['show','显示'],['clearId','按 ID 清除'],['clearAllTexts','清除全部覆盖文本'],['clearFlow','清除当前聊天流']],state)];
  if(command==='show') {
    const ids=storyOverlayIds(ctx,draft); const current=String(val(value,'id')??'');
    out.push(`<label class="story-editor-property">覆盖层 ID<input data-story-reference="overlay" list="${listId}" data-editor-key="${esc(ctx,key([...path,'id']))}" data-story-property-path="${esc(ctx,pathText([...path,'id']))}" value="${esc(ctx,current)}"${readOnly(state)}><datalist id="${listId}">${ids.map(id=>`<option value="${esc(ctx,id)}"></option>`).join('')}</datalist><small class="story-editor-hint">同一聊天流内再次显示同 ID 会替换旧覆盖层；可在后续动作按 ID 清除。</small></label>`,scalarOptional(ctx,'X（0–1，左下原点）',value,'x',[...path,'x'],state,'number',undefined,draft,nodeId),scalarOptional(ctx,'Y（0–1，左下原点）',value,'y',[...path,'y'],state,'number',undefined,draft,nodeId),labelledChoices(ctx,'覆盖层对齐',[['left','左'],['center','中'],['right','右']],val(value,'align'),[...path,'align'],state,true),`<div class="story-editor-overlay-presets"><strong>常用位置</strong>${[['top-left','左上'],['top-center','上中'],['top-right','右上'],['bottom-left','左下'],['bottom-center','下中'],['bottom-right','右下']].map(([preset,label])=>`<button type="button" class="mini-action" data-story-overlay-preset="${preset}" data-story-overlay-path="${esc(ctx,pathText(path))}"${disabled(state)}>${label}</button>`).join('')}</div>`);
    const cp=[...path,'content']; const content=record(val(value,'content')); const kind=val(content,'kind'); out.push(branch(ctx,'内容类型',[...cp,'kind'],kind,[['text','文本'],['message','消息'],['entryCard','入口卡']],state));
    if(kind==='text') out.push(scalar(ctx,'文本',[...cp,'text'],val(content,'text'),state,'textarea'),labelledChoices(ctx,'文本模板',[['default','默认'],['title','标题'],['badge','徽标'],['note','注记']],val(content,'template'),[...cp,'template'],state,true),styleEditor(ctx,state,[...cp,'style'],record(val(content,'style'))));
    if(kind==='message') out.push(contentEditor(ctx,state,[...cp,'content'],record(val(content,'content'))),presentationEditor(ctx,state,[...cp,'presentation'],record(val(content,'presentation'))),styleEditor(ctx,state,[...cp,'style'],record(val(content,'style'))));
    if(kind==='entryCard') out.push(entryCardEditor(ctx,state,[...cp,'card'],record(val(content,'card')),[...cp,'card','request'],draft,nodeId));
  }
  if(command==='clearId') out.push(`<label class="story-editor-property">覆盖层 ID<input data-story-reference="overlay" list="${listId}" data-editor-key="${esc(ctx,key([...path,'id']))}" data-story-property-path="${esc(ctx,pathText([...path,'id']))}" value="${esc(ctx,val(value,'id')??'')}"${readOnly(state)}><datalist id="${listId}">${storyOverlayIds(ctx,draft).map(id=>`<option value="${esc(ctx,id)}"></option>`).join('')}</datalist></label><p class="story-editor-hint">候选来自当前 Story 与可达转移。只清除当前 owner 的同 ID 覆盖层；未找到时不改聊天流。</p>`);
  if(command==='clearAllTexts') out.push('<p class="story-editor-hint">清除当前 owner 的全部演出覆盖层，保留聊天历史与 Story 进度。</p>');
  if(command==='clearFlow') out.push('<p class="story-editor-hint">清空当前 owner 的聊天流（含 Story 输出与覆盖层）；不清除其他 owner，也不回退已执行动作或剧情进度。</p>');
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function storyOverlayIds(ctx:UIContext,draft:StoryDraft):string[] {
  const ids=new Set<string>(); const stories=new Set<string>([draft.document.id]); const queue=[draft.document.id];
  while(queue.length){const id=queue.pop()!;const story=id===draft.document.id?draft.document:ctx.game.registry.stories.get(id);if(!story)continue;const visit=(value:unknown)=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}const row=value as Record<string,unknown>;if(row.command==='show'&&typeof row.id==='string')ids.add(row.id);if(row.command==='clearId'&&typeof row.id==='string')ids.add(row.id);if(row.mode==='goto'||row.mode==='insert'){const next=typeof row.storyId==='string'?row.storyId:'';if(next&&!stories.has(next)){stories.add(next);queue.push(next);}}Object.values(row).forEach(visit);};visit(story);}
  return [...ids].sort();
}
function nodeOverlayActions(node:StoryDraftNode):{path:(string|number)[];action:Obj}[] {
  const found:{path:(string|number)[];action:Obj}[]=[];
  const visit=(value:unknown,path:(string|number)[])=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach((child,index)=>visit(child,[...path,index]));return;}const row=value as Obj;if(row.kind==='overlay'&&record(row.command)?.command==='show')found.push({path,action:row});for(const [key,child] of Object.entries(row))visit(child,[...path,key]);};visit(node,[]);
  return found;
}
export function hasStoryNodeOverlay(node:StoryDraftNode):boolean {
  return ((node.type==='talklet'||node.type==='click')&&node.performance?.layout?.mode==='positioned') || nodeOverlayActions(node).length>0;
}
export function renderStoryPerformanceEditing(ctx:UIContext,state:StoryEditorState):string {
  const draft=currentDraft(state);if(!draft)return '';
  const editing=state.performanceEditing?.[draft.draftId]??[];
  return `<div class="story-editor-performance-layer" data-editor-key="performance-layer:${esc(ctx,draft.draftId)}" aria-label="演出编辑层">${draft.document.nodes.filter(node=>editing.includes(node.id)).map(node=>renderNodePerformanceEditing(ctx,draft,node)).join('')}</div>`;
}
function renderNodePerformanceEditing(ctx:UIContext,draft:StoryDraft,node:StoryDraftNode):string {
  const canvas=(path:Path,body:string):string=>`<div class="story-editor-overlay-canvas" data-editor-key="overlay-canvas:${esc(ctx,propertyKey(draft,node.id,path))}" data-story-overlay-canvas data-story-overlay-node="${esc(ctx,node.id)}" data-story-overlay-draft="${esc(ctx,draft.draftId)}" data-story-overlay-path="${esc(ctx,pathText(path))}" aria-label="拖动演出以调整位置">${body}</div>`;
  if ((node.type==='talklet'||node.type==='click')&&node.performance?.layout?.mode==='positioned') {
    const body=node.type==='talklet' ? renderChatEntry(ctx,{...projectStoryContent(node.content,(node.appearance?.presentation ?? node.presentation)),kind:node.content.kind,performance:storyNodeDisplay(node)}) : renderStoryClickAppearance(renderStoryClickPreview(ctx,node.interaction),storyNodeDisplay(node));
    return canvas(['performance','layout'],renderStoryNodePlacement(ctx,body,node.performance,node.id));
  }
  return nodeOverlayActions(node).map(({path,action},index)=>{const command=record(action.command)!;const content=record(command.content);const kind=val(content,'kind');const card=record(val(content,'card'));const request=record(val(card,'request'));const entry=request&&typeof request.entryId==='string'?ctx.game.registry.activeStories.get(request.entryId):undefined;const talklet=kind==='message'?record(val(content,'content')):null;
    const entryView:ChatTextEntry={id:String(command.id||`${node.id}-${index}`),text:kind==='text'?String(val(content,'text')??''):undefined,talklet:talklet?{kind:val(talklet,'kind')==='narration'?'narration':'talk',text:String(val(talklet,'text')??''),speaker:String(val(talklet,'speaker')??''),...(val(talklet,'displayName')?{displayName:String(val(talklet,'displayName'))}:{}),...(val(talklet,'characterId')?{characterId:String(val(talklet,'characterId'))}:{}),...(val(record(val(content,'presentation')),'avatar')?{avatar:String(val(record(val(content,'presentation')),'avatar'))}:{}),...(val(talklet,'image')?{image:String(val(talklet,'image'))}:{}),...(record(val(content,'presentation'))?.side?{side:record(val(content,'presentation'))!.side as 'left'|'right'}:{}),...(record(val(content,'presentation'))?.align?{align:record(val(content,'presentation'))!.align as 'left'|'center'|'right'}:{}),...(record(val(content,'presentation'))?.avatarMode==='hide'?{noAvatar:true}:{}),...(record(val(content,'presentation'))?.avatarMode==='show'?{showAvatar:true}:{})}:undefined,x:Number.isFinite(Number(command.x))?Number(command.x):0,y:Number.isFinite(Number(command.y))?Number(command.y):1,align:command.align==='center'||command.align==='right'?command.align:'left',kind:kind==='text'&&['title','badge','note'].includes(String(val(content,'template')))?val(content,'template') as ChatTextEntry['kind']:kind==='entryCard'?'kizuna':undefined,style:record(val(content,'style')) as ChatTextEntry['style'],title:kind==='entryCard'?String(val(card,'title')??''):undefined,buttonText:kind==='entryCard'?String(val(card,'buttonText')??''):undefined,targetStoryId:entry?.storyId,timestamp:0};
    if(kind==='entryCard') entryView.talklet={kind:'click',text:entryView.buttonText??'',kizuna:{storyId:entry?.storyId??'',title:entryView.title,buttonText:entryView.buttonText,align:val(card,'align')==='right'?'right':val(card,'align')==='left'?'left':undefined}};
    return canvas([...path,'command'],renderChatTexts(ctx,[entryView],{preview:true}));
  }).join('');
}
function styleEditor(ctx: UIContext,state: StoryEditorState,path: Path,value: Obj|null,omitEmpty=false): string {
  return `<section class="story-editor-property-group" data-editor-key="${esc(ctx,key(path,':style'))}"><strong>基础样式</strong>${labelledChoices(ctx,'字型',[['default','默认字型'],['serif','衬线'],['sans','无衬线'],['mono','等宽'],['handwritten','手写']],val(value,'font'),[...path,'font'],state,true)}${scalar(ctx,'字号',[...path,'fontSize'],val(value,'fontSize'),state,'text',undefined,omitEmpty?'例如 24px 或 1.5rem；留空沿用默认。':undefined,undefined,omitEmpty)}${scalar(ctx,'文字颜色',[...path,'color'],val(value,'color'),state,'text',undefined,undefined,undefined,omitEmpty)}${labelledChoices(ctx,'背景显示',[['true','显示背景'],['false','透明背景']],val(value,'background') === undefined ? undefined : String(val(value,'background')),[...path,'background'],state,true)}${scalar(ctx,'背景颜色',[...path,'backgroundColor'],val(value,'backgroundColor'),state,'text',undefined,undefined,undefined,omitEmpty)}</section>`;
}
const THEME_TOKENS:[string,string][]=[['primary','主色'],['primaryDim','主色弱化'],['primaryStrong','强调主色'],['bg','画布背景'],['bgAlt','次级背景'],['panel','面板'],['panelLight','浅面板'],['text','正文文字'],['textDim','弱化文字'],['muted','提示文字'],['line','分隔线'],['border','边框'],['active','激活态'],['highlight','高亮'],['success','成功'],['warning','警告'],['danger','危险'],['accent','强调色'],['playerBubble','玩家气泡'],['playerBubbleText','玩家气泡文字'],['npcBubble','角色气泡'],['npcBubbleText','角色气泡文字']];
const THEME_NODES:[string,string][]=[['primary','主色'],['primaryStrong','强调主色'],['bg','画布背景'],['bgAlt','次级背景'],['panel','面板'],['panelLight','浅面板'],['text','正文文字'],['muted','提示文字'],['line','分隔线'],['active','激活态'],['highlight','高亮'],['success','成功'],['warning','警告'],['danger','危险'],['accent','强调色'],['playerBubble','玩家气泡'],['npcBubble','角色气泡']];
function themeValueRow(ctx:UIContext,state:StoryEditorState,path:Path,name:string,label:string,value:unknown,source:string):string {
  const pathValue=[...path,name]; const set=value!==undefined&&value!==null; const current=String(value??source??''); const validHex=/^#[0-9a-f]{6}$/i.test(current);
  return `<div class="story-editor-theme-value"><strong>${esc(ctx,label)} <code>${esc(ctx,name)}</code></strong><small class="story-editor-hint">${set?'显式覆盖':'继承'} · ${esc(ctx,source||'运行时默认')}</small>${set?`<div class="story-editor-theme-color"><input data-editor-key="${esc(ctx,key(pathValue))}" data-story-property-path="${esc(ctx,pathText(pathValue))}" value="${esc(ctx,current)}"${readOnly(state)}>${validHex?`<input type="color" aria-label="选择${esc(ctx,label)}颜色" data-editor-key="${esc(ctx,key(pathValue,':picker'))}" data-story-property-path="${esc(ctx,pathText(pathValue))}" value="${esc(ctx,current)}"${disabled(state)}>`:''}</div><button type="button" class="mini-action" data-story-theme-remove="${esc(ctx,pathText(pathValue))}"${disabled(state)}>恢复继承</button>`:`<button type="button" class="mini-action" data-story-theme-add="${esc(ctx,pathText(pathValue))}" data-story-theme-value="${esc(ctx,source)}"${disabled(state)}>添加覆盖</button>`}</div>`;
}
function themeMapEditor(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,nodeId:string,path:Path,value:Obj|null,known:[string,string][],base:Record<string,string>,title:string):string {
  const map=value??{}; const fields=known.map(([name,label])=>themeValueRow(ctx,state,path,name,label,map[name],base[name]??'未设置')).join('');
  const custom=Object.keys(map).filter(name=>!known.some(([key])=>key===name)).map(name=>themeValueRow(ctx,state,path,name,'自定义变量',map[name],base[name]??'未设置')).join('');
  return `<section class="story-editor-theme-map"><h4>${esc(ctx,title)}</h4>${fields}${custom}<div class="story-editor-theme-add-key"><input aria-label="新${esc(ctx,title)}键" placeholder="自定义键" data-story-theme-key><button type="button" class="mini-action" data-story-theme-add-key="${esc(ctx,pathText(path))}"${disabled(state)}>新增自定义键</button></div></section>`;
}
function themePaletteEditor(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,nodeId:string,path:Path,colors:unknown[],inherited:readonly string[]):string {
  return `<section class="story-editor-theme-map"><div class="story-editor-list-heading"><strong>有序色板（最多六色）</strong><button type="button" class="mini-action" data-story-theme-add-palette="${esc(ctx,pathText(path))}"${colors.length>=6||(state.storageBlocked || Boolean(state.readOnlyReason))?' disabled':''}>添加色槽</button></div><small class="story-editor-hint">${colors.length?'当前色板为显式值':'沿用所选色彩组色板'}${inherited.length?`：${inherited.map(x=>esc(ctx,x)).join('、')}`:''}</small>${colors.map((color,index)=>{const p=[...path,index];const rowId=rowIdAt(draft,nodeId,path,index)??String(index);const text=String(color??'');const picker=/^#[0-9a-f]{6}$/i.test(text);return `<div class="story-editor-property-row" data-editor-key="theme-palette:${esc(ctx,rowId)}"><strong>色槽 ${index+1}</strong><div class="story-editor-theme-color"><input data-editor-key="${esc(ctx,key(p))}" data-story-property-path="${esc(ctx,pathText(p))}" value="${esc(ctx,text)}"${readOnly(state)}>${picker?`<input type="color" aria-label="选择色槽 ${index+1} 颜色" data-editor-key="${esc(ctx,key(p,':picker'))}" data-story-property-path="${esc(ctx,pathText(p))}" value="${esc(ctx,text)}"${disabled(state)}>`:''}</div>${rowButtons(ctx,path,rowId,index,colors.length,state)}</div>`;}).join('')}</section>`;
}
function themeBackgroundEditor(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,nodeId:string,path:Path,layers:unknown[]):string {
  const rows=layers.map((raw,index)=>{const layer=record(raw)??{};const p=[...path,index];const rowId=rowIdAt(draft,nodeId,path,index)??String(index);return `<div class="story-editor-property-row" data-editor-key="theme-background:${esc(ctx,rowId)}"><strong>背景层 ${index+1}</strong>${scalar(ctx,'层 ID',[...p,'id'],val(layer,'id'),state)}${labelledChoices(ctx,'类型',[['empty','空'],['solid','纯色'],['gradient','渐变'],['image','图片']],val(layer,'kind'),[...p,'kind'],state)}${scalar(ctx,val(layer,'kind')==='image'?'图片资源':'值',[...p,'value'],val(layer,'value'),state,val(layer,'kind')==='image'?'image':'text',undefined,'图片从资源目录选择；渐变和颜色保留原始合法表达式。')}${scalar(ctx,'透明度',[...p,'opacity'],val(layer,'opacity'),state,'number')}${scalar(ctx,'位置',[...p,'position'],val(layer,'position'),state)}${scalar(ctx,'尺寸',[...p,'size'],val(layer,'size'),state)}${scalar(ctx,'重复',[...p,'repeat'],val(layer,'repeat'),state)}${scalar(ctx,'混合模式',[...p,'blendMode'],val(layer,'blendMode'),state)}${labelledChoices(ctx,'附着方式',[['scroll','随滚动'],['fixed','固定'],['local','局部']],val(layer,'attachment'),[...p,'attachment'],state,true)}${scalar(ctx,'缩放',[...p,'scale'],val(layer,'scale'),state,'number')}${scalar(ctx,'旋转角度',[...p,'rotation'],val(layer,'rotation'),state,'number')}${scalar(ctx,'启用',[...p,'enabled'],val(layer,'enabled'),state,'boolean')}${rowButtons(ctx,path,rowId,index,layers.length,state)}</div>`;}).join('');
  return `<section class="story-editor-theme-map"><div class="story-editor-list-heading"><strong>背景图层</strong><button type="button" class="mini-action" data-story-theme-add-background="${esc(ctx,pathText(path))}"${disabled(state)}>添加图层</button></div>${rows}<p class="story-editor-hint">组件锚点与偏移属于 ThemeDef 的 Presentation 内容；聊天覆盖层坐标不适用于此处。</p></section>`;
}
type ThemeContentEdit=NonNullable<StoryEditorState['themeContentEdit']>;
function contentRowId(edit:ThemeContentEdit,path:Path,index:number):string { const key=JSON.stringify(path);const ids=edit.rows[key]??(edit.rows[key]=[]);while(ids.length<=index)ids.push(crypto.randomUUID());return ids[index]!; }
function contentField(ctx:UIContext,label:string,path:Path,value:unknown,state:StoryEditorState,kind:'text'|'number'|'boolean'='text'):string {
  const current=value==null?'':String(value);const id=esc(ctx,`theme-content:${pathText(path)}`);const control=kind==='boolean'?`<select data-editor-key="${id}" data-theme-content-path="${esc(ctx,pathText(path))}" data-theme-content-kind="boolean"${disabled(state)}><option value="true"${value===true?' selected':''}>是</option><option value="false"${value!==true?' selected':''}>否</option></select>`:`<input data-editor-key="${id}" data-theme-content-path="${esc(ctx,pathText(path))}" data-theme-content-kind="${kind}" value="${esc(ctx,current)}"${kind==='number'?' inputmode="decimal"':''}${readOnly(state)}>`;
  return `<label class="story-editor-property">${esc(ctx,label)}${control}</label>`;
}
function contentSelect(ctx:UIContext,label:string,path:Path,value:unknown,options:readonly [string,string][],state:StoryEditorState):string {
  const current=String(value??'');return `<label class="story-editor-property">${esc(ctx,label)}<select data-editor-key="${esc(ctx,`theme-content:${pathText(path)}`)}" data-theme-content-path="${esc(ctx,pathText(path))}"${disabled(state)}>${options.map(([key,text])=>`<option value="${esc(ctx,key)}"${current===key?' selected':''}>${esc(ctx,text)}</option>`).join('')}</select></label>`;
}
function contentAction(ctx:UIContext,label:string,action:string,path:Path,state:StoryEditorState,index?:number):string {
  return `<button type="button" class="mini-action${action==='remove'?' mini-action--danger':''}" data-theme-content-action="${action}" data-theme-content-path="${esc(ctx,pathText(path))}"${index===undefined?'':` data-theme-content-index="${index}"`}${disabled(state)}>${esc(ctx,label)}</button>`;
}
function themeContentMap(ctx:UIContext,label:string,path:Path,value:unknown,state:StoryEditorState):string {
  const map=record(value)??{};return `<section class="story-editor-theme-map"><h4>${esc(ctx,label)}</h4>${Object.entries(map).map(([key,current])=>`<div class="story-editor-theme-value"><strong><code>${esc(ctx,key)}</code></strong><small class="story-editor-hint">${esc(ctx,label==='ColorGroup 主题'?'色彩组定义值':'ThemeDef 显式值')}</small><input data-editor-key="${esc(ctx,`theme-content:${pathText([...path,key])}`)}" data-theme-content-path="${esc(ctx,pathText([...path,key]))}" value="${esc(ctx,current)}"${readOnly(state)}>${contentAction(ctx,'移除','remove',[...path,key],state)}</div>`).join('')}<div class="story-editor-theme-add-key"><input data-editor-key="${esc(ctx,`theme-content-key:${pathText(path)}`)}" data-theme-content-key placeholder="自定义键" aria-label="新增${esc(ctx,label)}键"><button type="button" class="mini-action" data-theme-content-action="add-key" data-theme-content-path="${esc(ctx,pathText(path))}"${disabled(state)}>新增键</button></div></section>`;
}
function themeContentLayers(ctx:UIContext,edit:ThemeContentEdit,state:StoryEditorState,path:Path,items:unknown[],presentation=false):string {
  const layers=items.map((raw,index)=>{const row=record(raw)??{};const p=[...path,index];const id=contentRowId(edit,path,index);return `<div class="story-editor-property-row" data-editor-key="theme-content-layer:${esc(ctx,id)}"><strong>${presentation?'表现层':'背景层'} ${index+1}</strong>${presentation?contentSelect(ctx,'表现区域',[...p,'region'],row.region,[['shell','外壳'],['header','顶栏'],['leftPanel','左栏'],['centerPanel','中栏'],['rightPanel','右栏'],['footer','底栏'],['story','Story'],['modal','弹窗']],state):''}${contentField(ctx,'层 ID',[...p,'id'],row.id,state)}${contentSelect(ctx,'类型',[...p,'kind'],row.kind,[['empty','空'],['solid','纯色'],['gradient','渐变'],['image','图片']],state)}${contentField(ctx,row.kind==='image'?'图片资源':'值',[...p,'value'],row.value,state)}${contentField(ctx,'透明度',[...p,'opacity'],row.opacity,state,'number')}${contentField(ctx,'位置',[...p,'position'],row.position,state)}${contentField(ctx,'尺寸',[...p,'size'],row.size,state)}${contentField(ctx,'重复',[...p,'repeat'],row.repeat,state)}${contentField(ctx,'混合模式',[...p,'blendMode'],row.blendMode,state)}${contentField(ctx,'缩放',[...p,'scale'],row.scale,state,'number')}${contentField(ctx,'旋转',[...p,'rotation'],row.rotation,state,'number')}${contentAction(ctx,'上移','up',path,state,index)}${contentAction(ctx,'下移','down',path,state,index)}${contentAction(ctx,'删除','remove',path,state,index)}</div>`;}).join('');
  return `<section class="story-editor-theme-map"><div class="story-editor-list-heading"><strong>${presentation?'Presentation 表现层':'ThemeDef 背景层'}</strong>${contentAction(ctx,'添加图层','add-layer',path,state)}</div>${layers}</section>`;
}
function themeContentEditor(ctx:UIContext,state:StoryEditorState,edit:ThemeContentEdit):string {
  const e=ctx.escapeHtml;const content=record(edit.draft)!;const target=edit.session.target;
  const close=`<button type="button" class="mini-action" data-theme-content-action="cancel">关闭会话</button>`;
  const actions=`${edit.previewing?'<p class="story-editor-hint">已使用 ThemeContentEditorService 临时预览；关闭或保存会清理预览，不写玩家主题存档。</p>':''}<div class="story-editor-actions"><button type="button" class="mini-action" data-theme-content-action="preview"${disabled(state)}>预览定义</button><button type="button" class="mini-action" data-theme-content-action="save"${disabled(state)}>保存到编辑态包</button>${close}</div>`;
  if(target.kind==='color-group'){
    const slots=array(content.slots);return `<section class="story-editor-theme-content" data-editor-key="theme-content:${e(target.kind)}:${e(target.contentId)}"><h4>编辑色彩组 · ${e(target.contentId)}</h4>${contentField(ctx,'名称',['name'],content.name,state)}${contentField(ctx,'说明',['description'],content.description,state)}${contentSelect(ctx,'组合方式',['compositionType'],content.compositionType,[['solid','纯色'],['gradient','渐变'],['duotone','双色'],['pie','饼图'],['radial','径向']],state)}${contentField(ctx,'忽略系统颜色底层',['systemColorLayerIgnored'],content.systemColorLayerIgnored,state,'boolean')}<div class="story-editor-theme-map"><div class="story-editor-list-heading"><strong>色槽（最多六色）</strong>${contentAction(ctx,'添加色槽','add-slot',['slots'],state)}</div>${slots.map((raw,index)=>{const slot=record(raw)??{};const path=['slots',index];const id=contentRowId(edit,['slots'],index);return `<div class="story-editor-property-row" data-editor-key="theme-content-slot:${e(id)}"><strong>色槽 ${index+1}</strong>${contentSelect(ctx,'颜色角色',[...path,'role'],slot.role,[['primary','主色'],['secondary','次色'],['accent','强调'],['highlight','高亮'],['shadow','阴影'],['edge','边缘']],state)}${contentField(ctx,'颜色表达式',[...path,'color'],slot.color,state)}${contentAction(ctx,'上移','up',['slots'],state,index)}${contentAction(ctx,'下移','down',['slots'],state,index)}${contentAction(ctx,'删除','remove',['slots'],state,index)}</div>`;}).join('')}</div>${themeContentMap(ctx,'ColorGroup 主题',['theme'],content.theme,state)}${edit.error?`<p class="story-editor-error">${e(edit.error)}</p>`:''}${actions}</section>`;
  }
  const palette=array(content.palette);const presentation=record(content.presentation)??{};const components=array(presentation.components);const layouts=components.map((raw,index)=>{const item=record(raw)??{};const path=['presentation','components',index];const id=contentRowId(edit,['presentation','components'],index);return `<div class="story-editor-property-row" data-editor-key="theme-content-component:${e(id)}"><strong>组件 ${index+1}</strong>${contentField(ctx,'组件 ID',[...path,'id'],item.id,state)}${contentField(ctx,'父区域 / 组件 ID',[...path,'parent'],item.parent,state)}${contentField(ctx,'资源引用',[...path,'asset'],item.asset,state)}${contentSelect(ctx,'锚点',[...path,'anchor'],item.anchor,[['top-left','左上'],['top-right','右上'],['bottom-left','左下'],['bottom-right','右下'],['center','居中']],state)}${contentField(ctx,'偏移 X',[...path,'offset','x'],record(item.offset)?.x,state,'number')}${contentField(ctx,'偏移 Y',[...path,'offset','y'],record(item.offset)?.y,state,'number')}${contentSelect(ctx,'偏移单位',[...path,'offset','unit'],record(item.offset)?.unit,[['percent','百分比'],['px','像素']],state)}${contentField(ctx,'宽度',[...path,'size','width'],record(item.size)?.width,state,'number')}${contentField(ctx,'高度',[...path,'size','height'],record(item.size)?.height,state,'number')}${contentSelect(ctx,'尺寸单位',[...path,'size','unit'],record(item.size)?.unit,[['percent','百分比'],['px','像素'],['auto','自动']],state)}${contentSelect(ctx,'图片适配',[...path,'fit'],item.fit,[['contain','完整显示'],['cover','铺满裁切'],['natural','原尺寸']],state)}${contentAction(ctx,'删除','remove',['presentation','components'],state,index)}</div>`;}).join('');
  return `<section class="story-editor-theme-content" data-editor-key="theme-content:${e(target.kind)}:${e(target.contentId)}"><h4>编辑主题内容 · ${e(target.contentId)}</h4>${contentField(ctx,'色彩组 ID',['colorGroupId'],content.colorGroupId,state)}<div class="story-editor-theme-map"><div class="story-editor-list-heading"><strong>色板（最多六色）</strong>${contentAction(ctx,'添加色槽','add-palette',['palette'],state)}</div>${palette.map((color,index)=>`<div class="story-editor-property-row" data-editor-key="theme-content-palette:${e(contentRowId(edit,['palette'],index))}">${contentField(ctx,`色槽 ${index+1}`,['palette',index],color,state)}${contentAction(ctx,'上移','up',['palette'],state,index)}${contentAction(ctx,'下移','down',['palette'],state,index)}${contentAction(ctx,'删除','remove',['palette'],state,index)}</div>`).join('')}</div>${themeContentMap(ctx,'ThemeDef 主题变量',['tokens'],content.tokens,state)}${themeContentMap(ctx,'ThemeDef 语义颜色',['nodes'],content.nodes,state)}${themeContentLayers(ctx,edit,state,['background'],array(content.background))}${themeContentLayers(ctx,edit,state,['presentation','layers'],array(presentation.layers),true)}<section class="story-editor-theme-map"><div class="story-editor-list-heading"><strong>组件布局</strong>${contentAction(ctx,'添加组件','add-component',['presentation','components'],state)}</div>${layouts}<p class="story-editor-hint">父级必须引用现有宿主或组件 ID；锚点、偏移和尺寸沿用 ThemeDef 单位。</p></section>${edit.error?`<p class="story-editor-error">${e(edit.error)}</p>`:''}${actions}</section>`;
}
function themeContentTrigger(ctx:UIContext,state:StoryEditorState,kind:'color-group'|'theme-def',contentId:string,owner?:string):string {
  const e=ctx.escapeHtml;const packId=state.targetPackId??'';const current=state.themeContentEdit?.session.target;
  if(current?.kind===kind&&current.contentId===contentId&&(kind==='color-group'||JSON.stringify(current.owner)===owner))return themeContentEditor(ctx,state,state.themeContentEdit!);
  return `<div class="story-editor-actions"><button type="button" class="mini-action" data-story-theme-content-open="${kind}" data-story-theme-content-id="${e(contentId)}" data-story-theme-content-owner="${e(owner??'')}" data-story-theme-content-pack="${e(packId)}"${packId?'':' disabled'}>编辑${kind==='color-group'?'引用色彩组':'目标 ThemeDef'}</button>${packId?'':'<small class="story-editor-hint">先在 Story 信息中选择编辑态数据包。</small>'}</div>`;
}
function presentationActionEditor(ctx: UIContext,state:StoryEditorState,path: Path,value: Obj|null,draft:StoryDraft,nodeId:string): string {
  const command=val(value,'command'); const commands: [string,string][]=[['theme','临时主题'],['setEntityPresentation','设置实体表现'],['clearEntityPresentation','清除实体表现'],['openingTitle','开幕标题']];
  const out=[branch(ctx,'表现命令',[...path,'command'],command,commands,state)];
  if(command==='openingTitle') out.push(scalar(ctx,'标题（留空使用来源标题）',[...path,'title'],val(value,'title'),state));
  if(command==='theme') {
    const theme=record(val(value,'value')); const scopeValue=val(theme,'scope');
    const scope=scopeValue==='area'||scopeValue==='student'?scopeValue:'ephemeral';
    out.push(`<label class="story-editor-property">主题作用域<select data-editor-key="${esc(ctx,key([...path,'value','scope'],':scope'))}" data-story-theme-scope-path="${esc(ctx,pathText([...path,'value']))}"${disabled(state)}>${[['ephemeral','临时'],['area','区域'],['student','学生']].map(([v,l])=>`<option value="${v}"${v===scope?' selected':''}>${esc(ctx,l)}</option>`).join('')}</select><small class="story-editor-hint">切换作用域只休眠/恢复实体键；颜色组与其他覆盖保持原值。</small></label>`);
    if(scope!=='ephemeral') out.push(entityKeySelect(ctx,state,[...path,'value','entityKey'],val(theme,'entityKey'),scope));
    out.push(scalar(ctx,'颜色组',[...path,'value','colorGroupId'],val(theme,'colorGroupId'),state,'ref','colorGroup'));
    const groupId=typeof val(theme,'colorGroupId')==='string'?String(val(theme,'colorGroupId')):'';
    const group=groupId?ctx.game.registry.colorGroups.get(groupId):undefined;
    const baseTokens=group?ctx.game.colorSystem.describeGroup(group).tokens.reduce<Record<string,string>>((out,item)=>(out[item.key]=item.value,out),{}):ctx.game.colorSystem.runtimeTheme().tokens;
    const runtimeNodes=ctx.game.colorSystem.runtimeTheme().nodeOverrides as Record<string,string>;
    const palette=Array.isArray(val(theme,'palette'))?array(val(theme,'palette')):[];
    const inheritedPalette=group?.slots.map(slot=>slot.color).slice(0,6)??[];
    out.push(themePaletteEditor(ctx,state,draft,nodeId,[...path,'value','palette'],palette,inheritedPalette));
    out.push(themeMapEditor(ctx,state,draft,nodeId,[...path,'value','tokens'],record(val(theme,'tokens')),THEME_TOKENS,baseTokens,'主题变量'));
    out.push(themeMapEditor(ctx,state,draft,nodeId,[...path,'value','nodes'],record(val(theme,'nodes')),THEME_NODES,runtimeNodes,'语义颜色'));
    out.push(themeBackgroundEditor(ctx,state,draft,nodeId,[...path,'value','background'],array(val(theme,'background'))));
    if(group)out.push(themeContentTrigger(ctx,state,'color-group',group.id));
    if(scope==='area'||scope==='student'){
      const rawKey=String(val(theme,'entityKey')??'');const entityId=rawKey.slice(rawKey.indexOf(':')+1);const entity=scope==='area'?ctx.game.registry.areas.get(entityId):ctx.game.registry.characterVariants.get(entityId);
      if(entity?.theme)out.push(themeContentTrigger(ctx,state,'theme-def',entityId,JSON.stringify({table:scope==='area'?'areas':'characterVariants',path:{kind:'field'}})));
    }
  }
  if(command==='setEntityPresentation'||command==='clearEntityPresentation') {
    const target=val(value,'target'); const targetOptions=entityPresentationTargets(ctx); const selected=typeof target==='string'?target:'';
    const missing=selected&&!targetOptions.some(item=>item.value===selected)?`<option value="${esc(ctx,selected)}" selected>${esc(ctx,selected)}（目标不存在）</option>`:'';
    out.push(`<label class="story-editor-property">表现目标<select data-editor-key="${esc(ctx,key([...path,'target']))}" data-story-property-path="${esc(ctx,pathText([...path,'target']))}"${disabled(state)}><option value=""${selected?'':' selected'}>选择实体…</option>${missing}${targetOptions.map(item=>`<option value="${esc(ctx,item.value)}"${item.value===selected?' selected':''}>${esc(ctx,item.label)}</option>`).join('')}</select></label>`,scalar(ctx,'持有者',[...path,'owner'],val(value,'owner'),state,'text',undefined,'同一目标可由不同 owner 独立持有；清理命令需要使用匹配 owner。'));
    if(command==='setEntityPresentation') {
      const options=targetOptionValues(ctx,target);
      out.push(typeof target==='string'
        ? labelledChoices(ctx,'表现选项',options,val(value,'optionId'),[...path,'optionId'],state,true)
        : `<label class="story-editor-property">表现选项<select disabled><option value="">先选择表现目标</option></select><small class="story-editor-hint">选项来自目标实体自身的 presentation.additions。</small></label>`);
      out.push(labelledChoices(ctx,'表现生命周期',[['story','Story'],['area','区域'],['init','世界线'],['manual','手动']],val(value,'lifetime'),[...path,'lifetime'],state,true),'<small class="story-editor-hint">默认手动；Story 在 Run 结束时清理，区域表现随 Area 进入清理，世界线表现切换 Init 时清理。手动项需显式 clearEntityPresentation。</small>');
    }
  }
  return `<div class="story-editor-property-group">${out.join('')}</div>`;
}
function entityKeySelect(ctx: UIContext,state: StoryEditorState,path: Path,value: unknown,scope: 'area'|'student'): string {
  const current=typeof value==='string'?value:''; const prefix=scope==='area'?'area:':'variant:';
  const options=storyReferenceOptions(ctx,scope==='area'?'area':'variant').map(item=>({value:`${prefix}${item.value}`,label:item.label}));
  const missing=current&&!options.some(item=>item.value===current)?`<option value="${esc(ctx,current)}" selected data-reference-missing>${esc(ctx,current)}（实体不存在）</option>`:'';
  return `<label class="story-editor-property">${scope==='area'?'区域':'角色差分'}<select data-story-reference="${scope==='area'?'area':'variant'}" data-editor-key="${esc(ctx,key(path))}" data-story-property-path="${esc(ctx,pathText(path))}"${disabled(state)}><option value=""${current?'':' selected'}>选择…</option>${missing}${options.map(item=>`<option value="${esc(ctx,item.value)}"${item.value===current?' selected':''}>${esc(ctx,item.label)}</option>`).join('')}</select></label>`;
}
function conditionEditor(ctx: UIContext,state: StoryEditorState,path: Path,value: unknown): string {
  if (!record(value)) return '<p class="story-editor-hint">条件尚未配置。</p>';
  const group=Array.isArray(record(value)?.conditions); const obj=record(value)!;
  if(group) {
    const rows=array(obj.conditions); return `<section class="story-editor-condition" data-editor-key="condition:${pathText(path)}">${labelledChoices(ctx,'条件关系',[['AND','全部满足'],['OR','任一满足']],val(obj,'type'),[...path,'type'],state)}<div class="story-editor-actions"><button type="button" class="mini-action" data-story-condition-add="leaf" data-story-condition-path="${esc(ctx,pathText([...path,'conditions']))}"${disabled(state)}>添加条件</button><button type="button" class="mini-action" data-story-condition-add="group" data-story-condition-path="${esc(ctx,pathText([...path,'conditions']))}"${disabled(state)}>添加条件组</button></div>${rows.map((child,index)=>`<div class="story-editor-condition-child" data-editor-key="condition-row:${pathText(path)}:${index}">${conditionEditor(ctx,state,[...path,'conditions',index],child)}<button type="button" class="mini-action mini-action--danger" data-story-row-action="remove-index" data-story-row-path="${esc(ctx,pathText([...path,'conditions']))}" data-story-row-index="${index}"${disabled(state)}>删除</button></div>`).join('')}</section>`;
  }
  const target = STORY_CONDITION_TARGETS.find(([id]) => id === val(obj,'target'))?.[0];
  const conditionRef = target && STORY_CONDITION_REFERENCES[target];
  const conditionHint = (target && STORY_CONDITION_HINTS[target]) ?? '从当前内容目录选择判断对象。';
  return `<section class="story-editor-condition-leaf" data-editor-key="condition-leaf:${pathText(path)}">${labelledChoices(ctx,'条件目标',STORY_CONDITION_TARGETS,val(obj,'target'),[...path,'target'],state)}${scalar(ctx,'条件键',[...path,'key'],val(obj,'key'),state,conditionRef?'ref':'text',conditionRef,conditionHint,target==='flag'?'global':undefined)}${labelledChoices(ctx,'比较方式',STORY_CONDITION_COMPARATORS,val(obj,'comparator'),[...path,'comparator'],state)}${scalar(ctx,'比较值',[...path,'value'],val(obj,'value'),state,'number')}</section>`;
}
function clickEditor(ctx: UIContext,state: StoryEditorState,path: Path,interaction: Obj|null,draft: StoryDraft,nodeId: string): string {
  const kind=val(interaction,'kind'); const out=[branch(ctx,'交互形式',[...path,'kind'],kind,[['button','按钮'],['choice','选项组'],['entryCard','剧情入口卡'],['areaContinue','到地点继续']],state)];
  if(kind!=='choice') out.push(bodyEditor(ctx,state,draft,nodeId));
  if(kind==='button') {
    const press=record(val(interaction,'press')); const pressPath=[...path,'press'];
    out.push(scalar(ctx,'基础次数',[...pressPath,'base'],val(press,'base'),state,'number',undefined,'留空且无随机增量时，只需按一次。',undefined,true),
      scalar(ctx,'随机增量上限',[...pressPath,'rand'],val(press,'rand'),state,'number',undefined,'留空不增加随机次数；0 表示显式关闭随机增量。',undefined,true));
    if (interaction && hasOwn(interaction,'result')) out.push(legacyChoiceField(ctx,state,'旧按钮 result（不再执行，请改用后续节点）',[...path,'result'],interaction.result));
  }
  if(kind==='choice') {
    out.push('<p class="story-editor-hint">选择标记用于关联后续节点；再次选择时会替换本组旧记录。</p>');
    const sp=[...path,'sharedActions'];
    if(interaction&&hasOwn(interaction,'sharedActions')) out.push(legacyChoiceField(ctx,state,'旧 Choice sharedActions',sp,interaction.sharedActions));
    const optionsPath=[...path,'options']; const options=array(val(interaction,'options'));
    out.push(listHeader(ctx,'选项（按顺序）',optionsPath,state),...options.map((item,index)=>choiceOption(ctx,state,[...optionsPath,index],record(item),optionsPath,index,options.length,draft,nodeId)));
  }
  if(kind==='entryCard') out.push(entryCardEditor(ctx,state,[...path,'card'],record(val(interaction,'card')),[...path,'card','request'],draft,nodeId));
  if(kind==='areaContinue') out.push(scalar(ctx,'续播地点',[...path,'areaId'],val(interaction,'areaId'),state,'ref','area'));
  if(kind==='areaContinue') out.push('<p class="story-editor-hint">停住当前 Entry；玩家到达指定 Area 后手动接纳，沿同一游标继续后继。</p>');
  return out.join('');
}
function legacyChoiceField(ctx:UIContext,state:StoryEditorState,label:string,path:Path,value:unknown):string {
  return `<p class="story-editor-error">${esc(ctx,label)}：<code>${esc(ctx,JSON.stringify(value))}</code><button type="button" class="mini-action mini-action--danger" data-story-remove-readonly="true" data-story-optional-path="${esc(ctx,pathText(path))}"${disabled(state)}>显式移除</button></p>`;
}
function choiceMarkList(ctx:UIContext,state:StoryEditorState,path:Path,opt:Obj|null,draft:StoryDraft,nodeId:string):string {
  const marksPath=[...path,'marks']; const raw=val(opt,'marks');
  if(raw!==undefined&&!Array.isArray(raw)) return legacyChoiceField(ctx,state,'选择标记结构无效',marksPath,raw);
  const marks=array(raw);
  const optionIndex = Number(path.at(-1)), optionId = String(val(opt, 'id') ?? '');
  const bindings = choiceOptionFlagBindings(draft, nodeId, optionIndex, optionId);
  const rows=marks.map((name,index)=>{
    const rowId=rowIdAt(draft,nodeId,marksPath,index)??String(index);
    const editor=typeof name==='string'
      ? scalar(ctx,'选择标记',[...marksPath,index],name,state,'text',undefined,undefined,'local')
      : `<p class="story-editor-error">选择标记结构无效：<code>${esc(ctx,JSON.stringify(name))}</code></p>`;
    const readers = marks.indexOf(name) === index ? bindings.find(binding => binding.flagName === name)?.nodeIds ?? [] : [];
    const unbind = readers.map(reader => `<button type="button" class="mini-action" data-editor-key="unbind:${esc(ctx,reader)}" data-story-choice-flag-unbind data-story-choice-node="${esc(ctx,nodeId)}" data-story-option-index="${optionIndex}" data-story-option-id="${esc(ctx,optionId)}" data-story-flag-name="${esc(ctx,name)}" data-story-node-id="${esc(ctx,reader)}" title="解除这个节点的标记条件。共用该标记的选项也将失去对该节点的控制。"${disabled(state)}>解绑 ${esc(ctx,reader)}</button>`).join('');
    return `<div class="story-editor-property-row" data-editor-key="choice-mark:${esc(ctx,rowId)}">${editor}<div class="story-editor-actions"><button type="button" class="mini-action mini-action--danger" data-story-row-action="remove" data-story-row-path="${esc(ctx,pathText(marksPath))}" data-story-row-id="${esc(ctx,rowId)}"${disabled(state)}>移除标记</button>${unbind}</div></div>`;
  }).join('');
  return `<div class="story-editor-list-block" data-editor-key="choice-marks:${esc(ctx,pathText(path))}"><div class="story-editor-list-heading"><strong>选择标记</strong><button type="button" class="mini-action" data-story-row-action="add" data-story-row-path="${esc(ctx,pathText(marksPath))}"${disabled(state)}>添加标记</button></div>${rows}</div>`;
}
function choiceOption(ctx:UIContext,state:StoryEditorState,path:Path,opt:Obj|null,listPath:Path,index:number,total:number,draft:StoryDraft,nodeId:string):string {
  const id=val(opt,'id'); const out=[`<div class="story-editor-property-row"><label class="story-editor-property">选项 ID<code>${esc(ctx,id)}</code></label><button type="button" class="mini-action" data-story-rename-option-id="true" data-story-node-id="${esc(ctx,nodeId)}" data-story-option-index="${index}" data-story-option-id="${esc(ctx,id)}"${disabled(state)}>更改 ID</button><small class="story-editor-hint">选项 ID 用于稳定标识；发布后尽量不要更改。若旧游标不再匹配，恢复时会从 Entry 开始。</small></div>`,scalar(ctx,'选项文案',[...path,'text'],val(opt,'text'),state,'textarea')];
  const oldConditionPath=[...path,'condition'];
  if(opt&&hasOwn(opt,'condition')) out.push(legacyChoiceField(ctx,state,'旧 Choice condition（禁用语义，不等同于 showWhen）',oldConditionPath,opt.condition));
  const showWhenPath=[...path,'showWhen']; const showWhen=val(opt,'showWhen'); const showWhenRecord=record(showWhen);
  const showWhenGroup=Boolean(showWhenRecord&&['AND','OR'].includes(String(showWhenRecord.type))&&Array.isArray(showWhenRecord.conditions));
  const showWhenCreate=`<button type="button" class="mini-action" data-story-init-condition="true" data-story-path="${esc(ctx,pathText(showWhenPath))}"${disabled(state)}>配置出现条件</button>`;
  out.push(showWhen!==undefined&&!showWhenGroup
    ? legacyChoiceField(ctx,state,'出现条件结构无效',showWhenPath,showWhen)
    : showWhen!==undefined ? optional(ctx,'出现条件',showWhenPath,true,state,conditionEditor(ctx,state,showWhenPath,showWhen),undefined,draft,nodeId) : showWhenCreate);
  if(opt&&hasOwn(opt,'result')) out.push(legacyChoiceField(ctx,state,'旧 Choice result（不再执行）',[...path,'result'],opt.result));
  const requiredFlag=val(opt,'requiresFlag');
  out.push(requiredFlag!==undefined&&typeof requiredFlag!=='string'
    ? legacyChoiceField(ctx,state,'局部出现标记结构无效',[...path,'requiresFlag'],requiredFlag)
    : scalar(ctx,'局部出现标记（需存在）',[...path,'requiresFlag'],requiredFlag,state,'text',undefined,'填写 Entry 局部表中的名称；仅检查该键是否存在。'));
  out.push(choiceMarkList(ctx,state,path,opt,draft,nodeId));
  const rowId=rowIdAt(draft,nodeId,listPath,index)??String(id);
  return `<section class="story-editor-property-row" data-editor-key="choice:${esc(ctx,rowId)}">${out.join('')}${rowButtons(ctx,listPath,rowId,index,total,state)}</section>`;
}
function talkletEditor(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,node:Obj):string {
  const content=record(val(node,'content')); const kind=val(content,'kind'); const out:string[]=[];
  out.push(branch(ctx,'正文形式',['content','kind'],kind,[['talk','对话'],['narration','旁白']],state));
  out.push(bodyEditor(ctx,state,draft,String(val(node,'id'))));
  if(kind==='talk') {
    const speaker=val(content,'speaker'), characterId=val(content,'characterId');
    const identity = resolveStorySpeaker(ctx.game, { characterId: typeof characterId === 'string' ? characterId : undefined, speaker: typeof speaker === 'string' ? speaker : undefined });
    const sender=identity.characterId ? `character:${identity.characterId}` : characterId===undefined && speaker==='老师' ? 'teacher' : characterId===undefined && speaker===undefined ? 'anonymous' : 'original';
    const known=[...ctx.game.registry.characters.values()].map(character=>`<option value="character:${esc(ctx,character.id)}"${sender===`character:${character.id}`?' selected':''}>${esc(ctx,character.displayName)}</option>`).join('');
    out.push(`<label class="story-editor-property">发出方<select data-story-reference="sender" data-editor-key="sender" data-editor-field="sender"${disabled(state)}><option value="narrator">旁白</option><option value="anonymous"${sender==='anonymous'?' selected':''}>不指定角色</option><option value="teacher"${sender==='teacher'?' selected':''}>老师</option>${known}<option value="original"${sender==='original'?' selected':''}>保留当前发出方${characterId || speaker ? `：${esc(ctx,characterId??speaker)}` : ''}</option></select></label>`,scalar(ctx,'发出方（自由显示名）',['content','displayName'],val(content,'displayName'),state,'text',undefined,'留空使用角色默认名称；修改名称不会改变头像。'),scalar(ctx,'图片引用',['content','image'],val(content,'image'),state,'image',undefined,'可从图片目录选择，也可填当前内容的直接资源引用。留空不附图。',undefined,true));
  }
  return out.join('');
}

/** The basic page owns the existing node payload; performance editing mounts alongside it. */
export function renderStoryNodeBasicProperties(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,node:StoryDraftNode):string {
  const value=node as unknown as Obj;
  const body=node.type==='talklet' ? talkletEditor(ctx,state,draft,value)
    : node.type==='click' ? clickEditor(ctx,state,['interaction'],record(val(value,'interaction')),draft,node.id) : '';
  return `<section class="story-editor-property-content" data-story-basic-properties="${esc(ctx,node.id)}" data-editor-key="basic:${esc(ctx,node.id)}" aria-label="基础内容">${body}</section>`;
}

function performanceEditor(ctx:UIContext,state:StoryEditorState,node:StoryDraftNode):string {
  const value=record(val(node as unknown as Obj,'performance')), layout=record(val(value,'layout'));
  const path=['performance','layout'];
  const out=[branch(ctx,'展示方式',[...path,'mode'],val(layout,'mode')??'flow',[['flow','随流排列'],['positioned','定位展示']],state)];
  const anchor = record(val(layout,'anchor'));
  const unit = val(layout,'unit') === 'px' ? 'px' : anchor ? '比例 −1–1' : '比例 0–1';
  if (val(layout,'mode')==='positioned') {
    out.push(
      scalar(ctx,`X（${unit}，${anchor ? '向右为正' : '左下原点'}）`,[...path,'x'],val(layout,'x'),state,'number'),
      scalar(ctx,`Y（${unit}，${anchor ? '向上为正' : '左下原点'}）`,[...path,'y'],val(layout,'y'),state,'number'));
    if (!anchor) out.push(labelledChoices(ctx,'定位锚点',[['left','左'],['center','中'],['right','右']],val(layout,'align'),[...path,'align'],state,true));
  }
  if (node.type === 'talklet') {
    const dialogue = node.appearance?.presentation ?? node.presentation;
    const pacing = record(val(value, 'pacing') ?? node.pacing);
    const timing = ['performance', 'pacing'];
    out.push(node.content.kind === 'talk' && dialogue?.side !== 'right'
      ? `<section class="story-editor-presentation" data-editor-key="pacing"><h3>输入节奏</h3><p class="story-editor-hint">0 表示关闭，留空沿用默认节奏。</p>${scalar(ctx,'打字时长（秒）',[...timing,'typing'],val(pacing,'typing'),state,'number',undefined,undefined,undefined,true)}${scalar(ctx,'思考时长（秒）',[...timing,'thinking'],val(pacing,'thinking'),state,'number',undefined,undefined,undefined,true)}</section>`
      : '<p class="story-editor-hint" data-editor-key="pacing-inactive">输入节奏在旁白或右侧对话下休眠。</p>');
  }
  out.push('<p class="story-editor-hint">定位内容在本轮运行结束或换场时清理；重复到达同一节点会替换其定位展示。输入按钮仍只在当前等待点可操作。</p>');
  return out.join('');
}

function appearanceEditor(ctx:UIContext,state:StoryEditorState,node:StoryDraftNode):string {
  if (node.type !== 'talklet' && node.type !== 'click') return '';
  const visual = storyNodeDisplay(node);
  const out = [styleEditor(ctx, state, ['appearance','style'], record(visual?.style), true)];
  if (node.type === 'talklet') {
    out.unshift(labelledChoices(ctx,'正文模板',[['message','对话 / 旁白'],['default','纯文字'],['title','标题'],['badge','徽标'],['note','注记']],visual?.template,['appearance','template'],state,true),
      presentationEditor(ctx,state,['appearance','presentation'],record(node.appearance?.presentation ?? node.presentation)));
  }
  return out.join('');
}

function nodeDesigner(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,node:StoryDraftNode):string {
  const tab=state.nodeDesignerTab??'basic';
  const tabs = [
    {id:'basic',label:'内容',action:'story-editor-designer:basic'},
    {id:'appearance',label:'外观',action:'story-editor-designer:appearance'},
    {id:'performance',label:'演出',action:'story-editor-designer:performance'},
  ];
  const reset = (group: 'appearance' | 'performance') => record(val(node as unknown as Obj, group))
    ? `<button type="button" class="mini-action" data-story-reset-design="${group}"${disabled(state)}>恢复${group === 'appearance' ? '默认外观' : '默认演出'}</button>` : '';
  return `${renderTabs(ctx,'right',tabs,tab,'节点设计页')}
    <div class="story-editor-designer-page" data-story-designer-page="basic" data-editor-key="designer:basic"${tab==='basic'?'':' hidden'}>${renderStoryNodeBasicProperties(ctx,state,draft,node)}</div>
    <div class="story-editor-designer-page story-editor-property-content" data-story-designer-page="appearance" data-editor-key="designer:appearance"${tab==='appearance'?'':' hidden'}>${appearanceEditor(ctx,state,node)}${reset('appearance')}</div>
    <div class="story-editor-designer-page story-editor-property-content" data-story-designer-page="performance" data-editor-key="designer:performance"${tab==='performance'?'':' hidden'}>${performanceEditor(ctx,state,node)}${reset('performance')}</div>`;
}

export function renderStoryNodeProperties(ctx:UIContext,state:StoryEditorState,draft:StoryDraft,node:StoryDraftNode,index:number):string {
  const n=node as unknown as Obj; const type=String(val(n,'type'));
  const nodeTypeSwitch=renderTabs(ctx,'right',[
    {id:'talklet',label:'Talklet',action:'story-editor-node-type:talklet'},
    {id:'click',label:'Click',action:'story-editor-node-type:click'},
    {id:'operation',label:'Operation',action:'story-editor-node-type:operation'},
    {id:'transfer',label:'Transfer',action:'story-editor-node-type:transfer'},
    {id:'moveToArea',label:'移动到 Area',action:'story-editor-node-type:moveToArea'},
    {id:'moveToCharaspace',label:'移动到 Chara',action:'story-editor-node-type:moveToCharaspace'},
  ],type,'节点类型');
  const base=`<div class="story-editor-property-row"><label class="story-editor-property">节点 ID<code>${esc(ctx,node.id)}</code></label><button type="button" class="mini-action" data-story-rename-node-id="${esc(ctx,node.id)}"${disabled(state)}>更改 ID</button><small class="story-editor-hint">手写 ID 更易维护。ID 是游标定位键；更改后，旧游标会从 StoryEntry 开始。内容发布后尽量不要更改。</small></div>${scalar(ctx,'需要局部标记（可选）',['requiresFlag'],val(n,'requiresFlag'),state,'text',undefined,'留空时正常执行；填写后只在 Entry 局部表中存在该键时执行。')}`;
  let body='';
  if(type==='talklet'||type==='click') body=nodeDesigner(ctx,state,draft,node);
  else if(type==='operation') body=`<p class="story-editor-hint">重读保留清理与临时演出，业务结算不重复执行；空间切换请使用独立移动节点。</p>${actionEditor(ctx,state,['action'],record(val(n,'action')),draft,node.id)}`;
  else if(type==='transfer') body=transferEditor(ctx,state,['transfer'],record(val(n,'transfer')),draft);
  else if(type==='moveToArea') body=`${scalar(ctx,'目标 Area',['areaId'],val(n,'areaId'),state,'ref','area')}<p class="story-editor-hint">正式播放会真实切换到目标 Area；隔离重读只切换演出场景。动作完成后继续当前正文，不建立返回点。</p>`;
  else if(type==='moveToCharaspace') body=`${scalar(ctx,'目标角色',['characterId'],val(n,'characterId'),state,'ref','variant')}<p class="story-editor-hint">正式播放切换到目标角色对话流；隔离重读只切换演出场景。动作完成后继续当前正文，不建立返回点。</p>`;
  const error=draft.editorIssues?.filter(issue=>issue.path.startsWith(`nodes[${index}]`)
    && !/\.interaction\.(?:result|sharedActions|options\[\d+\]\.(?:condition|result))$/.test(issue.path))
    .map(issue=>issueDiagnostic(ctx,state,issue,index)).join('')??'';
  return `<div class="story-editor-fields" data-editor-key="inspector:${esc(ctx,node.id)}" data-story-node-properties="${esc(ctx,node.id)}"><div class="story-editor-node-type-switch">${nodeTypeSwitch}</div>${base}<div class="story-editor-property-content" data-editor-key="property-content:${esc(ctx,node.id)}">${body}</div>${renderStoryFlagSuggestions(ctx,state)}${error}<div class="story-editor-actions"><button type="button" class="mini-action" data-editor-action="up"${index===0||(state.storageBlocked || Boolean(state.readOnlyReason))?' disabled':''}>上移</button><button type="button" class="mini-action" data-editor-action="down"${index===draft.document.nodes.length-1||(state.storageBlocked || Boolean(state.readOnlyReason))?' disabled':''}>下移</button><button type="button" class="mini-action mini-action--danger" data-editor-action="delete-node"${disabled(state)}>删除节点</button></div></div>`;
}
function parseRelativePath(raw:string):Path|null {
  const path:(string|number)[]=[]; const pattern=/\.([^.[\]]+)|\[(\d+)\]/g; let match:RegExpExecArray|null;
  while((match=pattern.exec(raw))) path.push(match[1]===undefined?Number(match[2]):match[1]);
  return path.length?path:null;
}
function issueDiagnostic(ctx:UIContext,state:StoryEditorState,issue:{path:string;message:string;removable?:boolean},index:number):string {
  const path=parseRelativePath(issue.path.slice(`nodes[${index}]`.length));
  const clear=path&&issue.removable!==false?`<button type="button" class="mini-action mini-action--danger" data-story-remove-readonly="true" data-story-optional-path="${esc(ctx,pathText(path))}"${disabled(state)}>清理该字段</button>`:'';
  return `<p class="story-editor-error" data-story-issue-path="${esc(ctx,issue.path)}">${esc(ctx,issue.message)}${clear}</p>`;
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
