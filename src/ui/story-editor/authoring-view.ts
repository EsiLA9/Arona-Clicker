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
  const field=(label:string,path:(string|number)[],value:unknown,kind='string',reference?:string)=>{
    const key=structuredKey(draft,'$authoring',[...base,...path]),input=draft.structuredInputs?.[key];
    return `<label class="story-editor-property">${label}${kind==='boolean'?`<select data-editor-key="value:${e(key)}" data-value-input="boolean" ${pathAttrs(path)}${locked}><option value="false"${value?'':' selected'}>否</option><option value="true"${value?' selected':''}>是</option></select>`:`<input data-editor-key="value:${e(key)}" data-value-input="${kind}" ${pathAttrs(path)} value="${e(input?.text ?? String(value ?? ''))}"${reference?` data-story-reference="${reference}"`:''}${kind==='number'?' inputmode="decimal"':''}${locked}>`}${input?.error?`<span class="story-editor-error">${e(input.error)}</span>`:''}</label>`;
  };
  const select=(part:string,label:string,value:string,options:[string,string][])=>`<label class="story-editor-property">${label}<select data-entry-activation-part="${part}" data-entry-table="${table}" data-entry-index="${index}"${locked}>${options.map(([id,title])=>`<option value="${id}"${value===id?' selected':''}>${title}</option>`).join('')}</select></label>`;
  let content=select('kind','激活方式',activation.kind,[['active','主动接取'],['random','随机抽取'],['affection','好感／角色阶段']]);
  if(activation.kind==='active'){
    content+=select('fallback','地区兜底',activation.fallback?.kind ?? 'none',[['none','不兜底投放'],['current-area','首个符合资格的当前地区'],['fixed-area','指定接取地区']]);
    if(activation.fallback?.kind==='fixed-area') content+=field('兜底接取地区',['activation','fallback','areaId'],activation.fallback.areaId,'string','area');
  }else{
    if(activation.kind==='random') content+=field('基础抽取权重',['activation','weight'],activation.weight,'number')+field('允许再次正式触发',['activation','repeatable'],activation.repeatable,'boolean');
    else{
      content+=select('when','角色阶段来源',activation.when.kind,[['level','好感达到等级'],['after-story','前置故事完成']]);
      content+=activation.when.kind==='level'?field('好感等级',['activation','when','level'],activation.when.level,'number'):field('前置 Story',['activation','when','storyId'],activation.when.storyId,'string','story');
    }
    content+=field('冷却帧数（0 为无冷却）',['activation','cooldownFrames'],activation.cooldownFrames ?? 0,'number');
  }
  const catalog=row.catalog;
  return `<section class="story-editor-entry-configuration" data-editor-key="entry-activation:${e(row.id)}"><h3>激活方式</h3>${content}<h3>历史归档</h3>${catalog?field('分类',['catalog','category'],catalog.category)+field('篇章',['catalog','part'],catalog.part)+field('章节',['catalog','chapter'],catalog.chapter)+field('条目排序',['catalog','order'],catalog.order ?? 0,'number')+`<button type="button" class="mini-action" data-value-action="remove" ${pathAttrs(['catalog'])}${locked}>移出历史归档</button>`:`<p class="story-editor-hint">未编入历史目录；不影响正式激活。</p><button type="button" class="mini-action" data-authoring-catalog="${table}" data-authoring-index="${index}"${locked}>配置故事目录</button>`}</section>`;
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
  return `<section class="story-editor-authoring" data-editor-key="entry-authoring:${ctx.escapeHtml(draft.draftId)}">${renderAuthoringRow(ctx,state,draft,table,index)}
    <h3>所在抽取池</h3><button type="button" class="mini-action" data-authoring-add="passivePools"${state.storageBlocked||draft.authoring![table][index].activation.kind!=='random'?' disabled':''}>新增关联抽取池</button>${draft.authoring!.passivePools.flatMap((pool,poolIndex) => pool.children.some(child=>child.id===id)||poolTokens.has(structuredKey(draft,'$authoring',['passivePools',poolIndex]))?[`<details class="story-editor-entry-pool" data-editor-key="entry-pool:${ctx.escapeHtml(structuredKey(draft,'$authoring',['passivePools',poolIndex]))}"><summary>${ctx.escapeHtml(pool.name ?? pool.id)}${pool.children.some(child=>child.id===id)?'':' · 本次编辑，已解除关联'}</summary>${renderAuthoringRow(ctx,state,draft,'passivePools',poolIndex)}</details>`]:[]).join('')}
    <div class="story-editor-actions"><button type="button" class="mini-action" data-editor-action="save"${locked}>保存草稿</button><button type="button" class="mini-action" data-authoring-action="check"${locked}>校验作者内容</button><button type="button" class="mini-action" data-authoring-action="apply"${locked}>应用 Story 与关联内容</button></div></section>`;
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
