import type { UIContext } from '../runtime/context';
import { currentStoryFlagCatalog } from './flag-catalog-view';
import { storyFlagNames } from './flag-catalog';
import type { PackCatalogReadModel } from '../../arona-clicker/contracts/runtime/runtime';
import { currentAuthoringDraft, storyEntries, type StoryDraft, type StoryEditorState } from './model';
import { valueAt, renderStructuredValue } from './structured-value';
import { structuredKey } from './authoring-model';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import { renderChatEntry, renderChatTexts, renderStoryNodePlacement, type ChatTextEntry } from '../components/story/story';
import { buildBackgroundView, renderBackground } from '../presentation/background-service';
import { renderTabs } from '../components/shared/tabs';
import { baseStoryHierarchy } from '../../arona-clicker/content/story/story-hierarchy';
import { withAuthoredStoryCatalog } from '../columns/authored-story-catalog';

export const ENTRY_FIELD_SEEDS: Record<string, { label: string; value: unknown }> = {
  owner: { label: '归属角色', value: '' },
  openingTitle: { label: '开幕标题', value: '' }, travelToStartContext: { label: '前往起始场景', value: true },
  replayable: { label: '可重读', value: true }, availableInits: { label: '允许的 Init', value: [] },
  triggerCondition: { label: '触发条件', value: { type: 'AND', conditions: [] } },
  completionReward: { label: '完成奖励', value: { first: [], repeat: [] } }, completionStrategy: { label: '完成策略', value: 'simple' },
  conditionalRewards: { label: '条件奖励', value: [] }, branchGuards: { label: '分支门控', value: [] }, revealTriggers: { label: '揭示条件', value: [] },
  reactions: { label: '完结反应', value: [] }, followUps: { label: '独立后续', value: [] },
  block: { label: '阻塞条件', value: { type: 'AND', conditions: [] } }, interruptible: { label: '可打断', value: true },
  leaveArea: { label: '允许离开区域', value: true }, blocksInteraction: { label: '阻塞玩家交互', value: false },
  tags: { label: '标签', value: [] }, extra: { label: '扩展数据', value: { t: 'dict', v: {} } },
};
function renderEntryConfiguration(ctx: UIContext, state: StoryEditorState, draft: StoryDraft, table: string, index: number, row: StoryEntryDef): string {
  const e=ctx.escapeHtml, locked=state.storageBlocked?' disabled':'', base=[table,index], activation=row.activation;
  const pathAttrs=(path: (string|number)[])=>`data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base,...path]))}"`;
  const field=(label:string,path:(string|number)[],value:unknown,kind='string',reference?:string,options?:{value:string;label:string}[])=>{
    const key=structuredKey(draft,'$authoring',[...base,...path]),input=draft.structuredInputs?.[key];
    const listId=`story-catalog-${Array.from(key).map(char=>char.codePointAt(0)!.toString(16)).join('-')}`;
    return `<label class="story-editor-property">${label}${kind==='boolean'?`<select data-editor-key="value:${e(key)}" data-value-input="boolean" ${pathAttrs(path)}${locked}><option value="false"${value?'':' selected'}>否</option><option value="true"${value?' selected':''}>是</option></select>`:`<input data-editor-key="value:${e(key)}" data-value-input="${kind}" ${pathAttrs(path)} value="${e(input?.text ?? String(value ?? ''))}"${reference?` data-story-reference="${reference}"`:''}${options?.length?` list="${e(listId)}"`:''}${kind==='number'?' inputmode="decimal"':''}${locked}>${options?.length?`<datalist id="${e(listId)}">${options.map(option=>`<option value="${e(option.value)}" label="${e(option.label)}"></option>`).join('')}</datalist>`:''}`}${input?.error?`<span class="story-editor-error">${e(input.error)}</span>`:''}</label>`;
  };
  const select=(part:string,label:string,value:string,options:[string,string][])=>`<label class="story-editor-property">${label}<select data-entry-activation-part="${part}" data-entry-table="${table}" data-entry-index="${index}"${locked}>${options.map(([id,title])=>`<option value="${id}"${value===id?' selected':''}>${title}</option>`).join('')}</select></label>`;
  let content=select('kind','激活方式',activation.kind,[['active','主动接取'],['random','随机抽取'],['affection','好感／角色阶段']]);
  if(activation.kind==='active'){
    content+=select('fallback','地区兜底',activation.fallback?.kind ?? 'none',[['none','不兜底投放'],['current-area','首个符合资格的当前地区'],['fixed-area','指定接取地区']]);
    if(activation.fallback?.kind==='fixed-area') content+=field('兜底接取地区',['activation','fallback','areaId'],activation.fallback.areaId,'string','area');
  }
  const catalog=row.catalog;
  const hierarchy=withAuthoredStoryCatalog(baseStoryHierarchy,storyEntries(state,ctx.game.registry.storyEntries).values());
  const inputValue=(key:'category'|'part',value:unknown)=>draft.structuredInputs?.[structuredKey(draft,'$authoring',[...base,'catalog',key])]?.text??String(value??'');
  const categoryValue=inputValue('category',catalog?.category), category=hierarchy.categories.find(item=>item.id===categoryValue||item.name===categoryValue);
  const partValue=inputValue('part',catalog?.part), part=category?.parts.find(item=>item.id===partValue||item.name===partValue);
  const options=(items:{id:string;name:string}[]|undefined)=>[...new Set((items??[]).map(item=>item.name||item.id))].map(value=>({value,label:value}));
  const catalogHint='<p class="story-editor-hint">候选值来自内置目录、已载入 Entry 与当前草稿；也可直接输入新的分类、篇章或章节名。条目顺序数值越小越靠前。</p>';
  return `<section class="story-editor-entry-configuration" data-editor-key="entry-activation:${e(row.id)}"><h3>激活方式</h3>${content}<h3>故事目录位置</h3>${catalog?catalogHint+field('分类',['catalog','category'],catalog.category,'string',undefined,options(hierarchy.categories))+field('篇章',['catalog','part'],catalog.part,'string',undefined,options(category?.parts))+field('章节（可选）',['catalog','chapter'],catalog.chapter,'string',undefined,options(part?.chapters))+field('条目顺序',['catalog','order'],catalog.order ?? 0,'number')+`<button type="button" class="mini-action" data-value-action="remove" ${pathAttrs(['catalog'])}${locked}>移除目录位置</button>`:`<p class="story-editor-hint">尚未设置目录位置；不会改变 Entry 的触发条件。</p><button type="button" class="mini-action" data-authoring-catalog="${table}" data-authoring-index="${index}"${locked}>设置目录位置</button>`}</section>`;
}
function authoringValueRenderer(ctx: UIContext, state: StoryEditorState, draft: StoryDraft) {
  const flags = currentStoryFlagCatalog(ctx,state);
  const globalFlags = storyFlagNames(flags,'global').map(name=>({value:name,label:name}));
  const localFlags = [...new Set(flags.uses.filter(use=>use.kind==='local').map(use=>use.name))].map(name=>({value:name,label:name}));
  const entryRefs = [...storyEntries(state,ctx.game.registry.storyEntries).values()].filter(x=>typeof x.id==='string'&&Boolean(x.id)).map(x=>({value:x.id,label:String(x.openingTitle ?? x.id)}));
  const storyRefs = [...ctx.game.registry.stories.values(), ...state.drafts.map(x=>x.document)].map(x=>({value:x.id,label:x.name}));
  return (scope: string, path: readonly (string | number)[], content: unknown, label: string) => renderStructuredValue(ctx,scope,path,content,label,draft.structuredInputs,state.storageBlocked,0,(s,p)=>structuredKey(draft,s,p),{entryId:entryRefs,storyEntryId:entryRefs,storyId:storyRefs,flagId:globalFlags,$globalFlags:globalFlags,$localFlags:localFlags});
}
function renderAuthoringRow(ctx: UIContext, state: StoryEditorState, draft: StoryDraft, table: 'activeStories' | 'passiveStories' | 'passivePools', index: number): string {
  const row = draft.authoring![table][index];
  const locked = state.storageBlocked ? ' disabled' : '';
  return `${table==='passivePools'?'':renderEntryConfiguration(ctx,state,draft,table,index,row as StoryEntryDef)}${authoringValueRenderer(ctx,state,draft)('$authoring',[table,index],row,row.id)}
    ${table === 'passivePools' ? '' : `<label class="story-editor-property">添加作者字段<select data-authoring-field="${table}" data-authoring-index="${index}"${locked}><option value="">选择字段…</option>${Object.entries(ENTRY_FIELD_SEEDS).filter(([name]) => !(name in row) && (table==='passiveStories'||!['block','interruptible','leaveArea','blocksInteraction'].includes(name))).map(([name,field])=>`<option value="${name}">${ctx.escapeHtml(field.label)}</option>`).join('')}</select></label>`}`;
}
export function renderStoryEntryFields(ctx: UIContext, state: StoryEditorState): string {
  const draft = currentAuthoringDraft(state);
  const id = state.target?.kind === 'entry' ? state.target.id : undefined;
  if (!draft || id === undefined) return '<p class="story-editor-empty">找不到该 Entry 的作者草稿。</p>';
  const table = draft.authoring!.activeStories.some(entry => entry.id === id) ? 'activeStories' : 'passiveStories';
  const index = draft.authoring![table].findIndex(entry => entry.id === id);
  const locked = state.storageBlocked ? ' disabled' : '';
  if(state.entryPoolContext?.entryId!==id) state.entryPoolContext={entryId:id,poolKeys:[]};
  draft.authoring!.passivePools.forEach((pool,poolIndex)=>{
    const key=structuredKey(draft,'$authoring',['passivePools',poolIndex]);
    if(pool.children.some(child=>child.id===id)&&!state.entryPoolContext!.poolKeys.includes(key))state.entryPoolContext!.poolKeys.push(key);
  });
  const poolTokens=new Set(state.entryPoolContext.poolKeys);
  const row=draft.authoring![table][index], base=[table,index], e=ctx.escapeHtml, value=authoringValueRenderer(ctx,state,draft);
  const tabs=renderTabs(ctx,'center',[{id:'basic',label:'基本信息',action:'story-editor-entry-tab:basic'},{id:'rewards',label:'奖励信息',action:'story-editor-entry-tab:rewards'},{id:'gates',label:'详细门控',action:'story-editor-entry-tab:gates'}],state.entryEditorTab??'basic','Entry 编辑页');
  const rowValues=row as unknown as Record<string,unknown>;
  const editor=(key:string,label:string)=>value('$authoring',[...base,key],rowValues[key],label);
  const editorPath=(path:(string|number)[],content:unknown,label:string)=>value('$authoring',[...base,...path],content,label);
  const ownerPath=[...base,'owner'], ownerKey=structuredKey(draft,'$authoring',ownerPath), ownerInput=draft.structuredInputs?.[ownerKey];
  const ownerField=`<label class="story-editor-property">归属角色<input data-editor-key="value:${e(ownerKey)}" data-value-input="string" data-value-scope="$authoring" data-value-path="${e(JSON.stringify(ownerPath))}" data-story-reference="variant" data-reference-label="归属角色" value="${e(ownerInput?.text??String(row.owner??''))}"${locked}>${ownerInput?.error?`<span class="story-editor-error">${e(ownerInput.error)}</span>`:''}</label>`;
  const rewardStrategy=row.completionStrategy??'simple';
  const strategyKey=structuredKey(draft,'$authoring',[...base,'completionStrategy']);
  const strategyControl=`<label class="story-editor-property">完成策略<select data-editor-key="value:${e(strategyKey)}" data-value-input="string" data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base,'completionStrategy']))}"${locked}><option value="simple"${rewardStrategy==='simple'?' selected':''}>简单</option><option value="conditional"${rewardStrategy==='conditional'?' selected':''}>条件</option></select></label>`;
  const effectiveTitle=row.openingTitle||draft.document.name||ctx.game.registry.stories.get(row.storyId)?.name||row.storyId;
  const basic=`${renderEntryConfiguration(ctx,state,draft,table,index,row as StoryEntryDef)}<button type="button" class="mini-action" data-value-action="remove" data-value-scope="$authoring" data-value-path="${e(JSON.stringify(base))}"${locked}>删除 Entry</button>${editor('id','Entry ID')}${editor('storyId','关联 Story')}${editor('openingTitle','开幕标题')}<p class="story-editor-hint">当前显示标题：${e(effectiveTitle)}</p>${editor('replayable','可重读')}${'tags' in row?editor('tags','标签'):''}${'extra' in row?editor('extra','扩展数据'):''}<label class="story-editor-property">添加作者字段<select data-authoring-field="${table}" data-authoring-index="${index}"${locked}><option value="">选择字段…</option>${Object.entries(ENTRY_FIELD_SEEDS).filter(([name])=>!(name in row)&&!['id','storyId','activation','catalog','completionStrategy','completionReward','conditionalRewards','availableInits','triggerCondition','owner','weight','repeatable','when','cooldownFrames','interruptible','leaveArea','blocksInteraction','block','travelToStartContext','revealTriggers','branchGuards','reactions','followUps'].includes(name)).map(([name,item])=>`<option value="${name}">${e(item.label)}</option>`).join('')}</select></label>`;
  const rewardEffects=(type:'first'|'repeat',label:string)=>`<section class="story-editor-reward-simple" data-editor-key="reward:${type}"><h3>${label}</h3>${row.completionReward?editorPath(['completionReward',type],row.completionReward[type],'效果列表'):'<p class="story-editor-hint">尚未配置默认奖励。</p>'}</section>`;
  const conditionalRows=(row.conditionalRewards??[]).map((outcome,outcomeIndex)=>{
    const path=['conditionalRewards',outcomeIndex] as (string|number)[];
    const stable=structuredKey(draft,'$authoring',[...base,...path]);
    return `<article class="story-editor-reward-row" data-editor-key="reward-outcome:${e(stable)}"><header><strong>条件奖励 ${outcomeIndex+1}</strong><div class="story-editor-actions"><button type="button" class="mini-action" data-value-action="up" data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base,...path]))}"${outcomeIndex===0||locked?' disabled':''}>上移</button><button type="button" class="mini-action" data-value-action="down" data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base,...path]))}"${outcomeIndex===(row.conditionalRewards!.length-1)||locked?' disabled':''}>下移</button><button type="button" class="mini-action mini-action--danger" data-value-action="remove" data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base,...path]))}"${locked}>删除</button></div></header><div class="story-editor-reward-row__cells"><section><h4>条件／Flag</h4>${editorPath([...path,'condition'],outcome.condition,'条件组')}</section><section><h4>效果列表</h4>${editorPath([...path,'effects'],outcome.effects,'命中后发放的效果')}</section></div></article>`;
  }).join('');
  const rewards=`<h3>完结奖励</h3><p class="story-editor-hint">首次与重复奖励始终提供。条件模式逐项判断所有规则，命中的规则效果全部提供。</p>${strategyControl}${row.completionReward?'':`<button type="button" class="mini-action" data-authoring-init-rewards${locked}>配置首次与重复奖励</button>`}${rewardEffects('first','首次')}${rewardEffects('repeat','重复')}${rewardStrategy==='simple'?'':`<p class="story-editor-hint">${row.conditionalRewards?.length?'逐项判断所有配置规则；多条规则可以同时命中。':'条件表为空，仍使用首次与重复奖励。'}</p><section class="story-editor-reward-table" aria-label="条件奖励表"><div class="story-editor-reward-table__head"><span>条件／Flag</span><span>效果列表</span></div>${conditionalRows||'<p class="story-editor-hint">尚无条件奖励规则。</p>'}<button type="button" class="mini-action" data-authoring-add-condition-reward${locked}>添加条件奖励</button></section>`}`;
  const detailKeys=['availableInits','triggerCondition','owner','interruptible','leaveArea','blocksInteraction','block','travelToStartContext','revealTriggers','branchGuards','reactions','followUps'];
  const activationDetail=row.activation.kind==='random'?value('$authoring',[...base,'activation','weight'],row.activation.weight,'基础权重')+value('$authoring',[...base,'activation','repeatable'],row.activation.repeatable,'正式重复触发')+value('$authoring',[...base,'activation','cooldownFrames'],row.activation.cooldownFrames??0,'Entry 冷却帧数'):
    row.activation.kind==='affection'?value('$authoring',[...base,'activation','when'],row.activation.when,'好感等级或前置 Story')+value('$authoring',[...base,'activation','cooldownFrames'],row.activation.cooldownFrames??0,'Entry 冷却帧数'):'';
  const applicableDetail=detailKeys.filter(key=>key!=='owner'&&(row.activation.kind!=='active'||!['interruptible','leaveArea','blocksInteraction','block'].includes(key)));
  const addableDetail=applicableDetail.filter(key=>!(key in row));
  const detail=activationDetail+(row.activation.kind==='affection'||'owner' in row?ownerField:'')+applicableDetail.filter(key=>key in row).map(key=>editor(key,ENTRY_FIELD_SEEDS[key]?.label??key)).join('')+`<label class="story-editor-property">添加详细门控字段<select data-authoring-field="${table}" data-authoring-index="${index}"${locked}><option value="">选择字段…</option>${addableDetail.map(key=>`<option value="${key}">${e(ENTRY_FIELD_SEEDS[key]?.label??key)}</option>`).join('')}${row.activation.kind!=='affection'&&!( 'owner' in row)?'<option value="owner">归属角色</option>':''}</select></label><h3>所在抽取池</h3><button type="button" class="mini-action" data-authoring-add="passivePools"${state.storageBlocked||row.activation.kind!=='random'?' disabled':''}>新增关联抽取池</button>${draft.authoring!.passivePools.flatMap((pool,poolIndex) => pool.children.some(child=>child.id===id)||poolTokens.has(structuredKey(draft,'$authoring',['passivePools',poolIndex]))?[`<details class="story-editor-entry-pool" data-editor-key="entry-pool:${e(structuredKey(draft,'$authoring',['passivePools',poolIndex]))}"><summary>${e(pool.name ?? pool.id)}${pool.children.some(child=>child.id===id)?'':' · 本次编辑，已解除关联'}</summary>${renderAuthoringRow(ctx,state,draft,'passivePools',poolIndex)}</details>`]:[]).join('')}`;
  const page=state.entryEditorTab==='rewards'?rewards:state.entryEditorTab==='gates'?detail:basic;
  return `<section class="story-editor-authoring" data-editor-key="entry-authoring:${e(draft.draftId)}"><div data-editor-key="entry-tabs">${tabs}</div><section data-editor-key="entry-page:${state.entryEditorTab??'basic'}" role="tabpanel">${page}</section></section>`;
}
export function renderStoryAuthoringEntryRelations(ctx: UIContext, state: StoryEditorState, draft: StoryDraft): string {
  const e = ctx.escapeHtml;
  const related = draft.authoring;
  const tables = [['activeStories','主动 Entry','active','activeStories'],['passiveStories','随机 Entry','random','passiveStories'],['passiveStories','好感／角色阶段 Entry','affection','affection']] as const;
  const rows = tables.map(([table,label,kind,action]) => `<div class="story-editor-list-heading"><h3>${label}</h3><button type="button" class="mini-action" data-authoring-add="${action}" data-editor-key="authoring-add:${kind}"${state.storageBlocked ? ' disabled' : ''}>新增${label}</button></div>${(related?.[table] ?? []).filter(row=>row.activation.kind===kind).map(row => `<button type="button" class="story-editor-list-item story-editor-relation-item" data-editor-key="entry:${table}:${e(row.id)}" data-editor-entry-target="${e(row.id)}"><strong>${e(String(row.openingTitle || label))}</strong><code>${e(row.id)}</code></button>`).join('')}`).join('');
  return `<section class="story-editor-authoring" data-editor-key="story-authoring-relations:${e(draft.draftId)}"><h3>关联 Entry</h3><p class="story-editor-hint">创建 Entry，或选择现有 Entry 继续编辑。</p>${rows}</section>`;
}
export function renderStoryAuthoringTools(ctx: UIContext, state: StoryEditorState, draft: StoryDraft): string {
  const e = ctx.escapeHtml; const locked = state.storageBlocked ? ' disabled' : '';
  const value = authoringValueRenderer(ctx,state,draft);
  const catalog = (ctx.game as typeof ctx.game & Partial<PackCatalogReadModel>).getPackCatalog?.();
  const targets = (catalog?.entries ?? []).filter(x => x.editingMode === 'editing');
  const targetPackId = draft.targetPackId ?? state.targetPackId;
  const related = draft.authoring;
  const entries = [...(related?.activeStories ?? []), ...(related?.passiveStories ?? [])];
  const preview = state.preview;
  const phaseLabels: Record<string,string> = {idle:'播放结束',typing:'正在输入',thinking:'正在思考',operation:'正在呈现效果',banner:'开幕标题',continue:'等待继续',input:'等待输入',finishing:'正在收尾',failed:'播放失败'};
  const projection = preview?.projection;
  const availableChoices = new Set(preview?.story?.availableChoiceIndexes ?? []);
  const previewChoices = preview?.story?.page.choices?.filter((_, index) => availableChoices.has(index));
  const sceneName = projection?.scene.type === 'area'
    ? ctx.game.registry.areas.get(projection.scene.id)?.name ?? projection.scene.id
    : projection ? ctx.game.registry.characterVariants.get(projection.scene.id)?.displayName ?? projection.scene.id : '';
  const visual = projection ? `<div class="story-editor-preview-stage" aria-label="隔离试播表现预览">
    ${renderBackground(buildBackgroundView(projection.theme.background,ctx.game.pics,projection.theme.tokens),'story-editor-preview-background')}
    <div class="story-editor-preview-scene">演出场景 · ${e(sceneName || '未指定')}</div>
    ${renderChatTexts(ctx,projection.presentation.overlays.map(({id,value})=>({id,text:value.text,talklet:value.talklet,x:value.x??0,y:value.y??1,align:value.align??'left',kind:value.kind,style:value.style,title:value.title,buttonText:value.buttonText,targetStoryId:value.targetStoryId,timestamp:0} satisfies ChatTextEntry)),{preview:true})}
    ${preview?.playback?.entries.filter(entry=>entry.performance?.layout?.mode==='positioned').map(entry=>renderStoryNodePlacement(ctx,renderChatEntry(ctx,{...entry,kind:entry.kind==='travel'?'reward':entry.kind}),entry.performance!,entry.id)).join('')??''}
    ${projection.presentation.overlays.length||preview?.playback?.entries.some(entry=>entry.performance?.layout?.mode==='positioned')?'':'<p class="story-editor-preview-empty">暂无定位展示</p>'}
  </div><div class="story-editor-preview-colors">${Object.entries(projection.theme.tokens).slice(0,8).map(([name,value])=>`<span><b>${e(name)}</b> ${e(value)}</span>`).join('')}</div>` : '';
  return `<section class="story-editor-authoring" data-editor-key="story-authoring:${e(draft.draftId)}">
    <h3>文档身份</h3><label class="story-editor-property">新 Story ID<input data-editor-key="copy-story-id" data-authoring-copy-id value="${e(state.copyStoryId ?? '')}" placeholder="mod:story:name"${locked}></label><button type="button" class="mini-action" data-authoring-copy${locked}>另存为新身份</button><p class="story-editor-hint">新副本保留正文，入口由你重新配置；原 Story 与外部引用保留。</p>
    <h3>文档扩展</h3>${value('$document',['extra'],draft.document.extra,'Story Extra')}
    <h3>检查、试播与保存</h3><button type="button" class="mini-action" data-authoring-action="check"${locked}>校验作者内容</button><button type="button" class="mini-action" data-authoring-action="apply"${locked}>应用 Story 与关联内容</button>
    <label class="story-editor-property">试播 Entry<select data-authoring-preview-entry${locked}><option value="">${entries.length ? '选择入口' : '先新增或选择关联 Entry'}</option>${entries.map(entry=>`<option value="${e(String(entry.id ?? ''))}"${entry.id===state.previewEntryId?' selected':''}>${e(String(entry.openingTitle || entry.id || ''))}</option>`).join('')}</select></label>
    <button type="button" class="mini-action" data-authoring-action="preview"${locked}>隔离试播</button><p class="story-editor-hint">试播使用独立实例与重读规则，验证输入、分支与父子串联；不结算持久奖励，移动与演出仅影响隔离实例。关闭后释放演出。</p>
    <label class="story-editor-property">保存目标包<select data-authoring-target${locked}><option value="">${targets.length ? '选择编辑态数据包' : '请先在包管理创建编辑副本'}</option>${targets.map(target=>`<option value="${e(target.packRecordId ?? target.id)}"${(target.packRecordId ?? target.id)===targetPackId?' selected':''}>${e(target.name)} · ${e(target.modName)}</option>`).join('')}</select></label><button type="button" class="mini-action" data-authoring-action="pack"${locked}>保存到目标包</button><p class="story-editor-hint">仅修改目标包内的作者内容；重新载入后生效，导出沿用包管理。新内容 ID 使用目标包命名空间。</p>
    ${preview ? `<section class="story-editor-preview" data-editor-key="authoring-preview"><h3>隔离试播</h3><p class="story-editor-hint">${e(preview.playback?.error ?? phaseLabels[preview.playback?.phase ?? 'idle'])} · ${e(sceneName || '未指定演出场景')}</p>${visual}${preview.playback?.entries.filter(entry=>entry.performance?.layout?.mode!=='positioned').map(entry=>renderChatEntry(ctx,{ ...entry, kind: entry.kind === 'travel' ? 'reward' : entry.kind })).join('') ?? ''}${preview.playback?.banner ? `<p>${e(preview.playback.banner.title)}</p>` : ''}${previewChoices?.map(choice=>`<button type="button" class="mini-action" data-authoring-preview-option="${e(choice.id)}">${e(choice.text)}</button>`).join('') ?? ''}<button type="button" class="mini-action" data-authoring-action="advance">继续 / 加速</button><button type="button" class="mini-action" data-authoring-action="close-preview">关闭试播</button></section>` : ''}
  </section>`;
}
