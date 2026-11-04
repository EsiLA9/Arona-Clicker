import type { UIContext } from '../runtime/context';
import type { PackCatalogReadModel } from '../../arona-clicker/contracts/runtime/runtime';
import type { StoryDraft, StoryEditorState } from './model';
import { valueAt, renderStructuredValue } from './structured-value';
import { structuredKey } from './authoring-model';
import { renderChatEntry } from '../components/story/story';

export const ENTRY_FIELD_SEEDS: Record<string, { label: string; value: unknown }> = {
  owner: { label: '归属角色', value: '' }, kizuna: { label: '羁绊子故事 / 赴约 / 回传', value: { entryId: '', returnFlags: [] } },
  affectionRequired: { label: '好感等级', value: 1 }, cooldownFrames: { label: '冷却帧数', value: 0 },
  openingTitle: { label: '开幕标题', value: '' }, travelToStartContext: { label: '前往起始场景', value: true },
  replayable: { label: '可重读', value: true }, availableInits: { label: '允许的 Init', value: [] },
  triggerCondition: { label: '触发条件', value: { type: 'AND', conditions: [] } },
  completionReward: { label: '完成奖励', value: { first: [], repeat: [] } }, completionStrategy: { label: '完成策略', value: 'simple' },
  conditionalRewards: { label: '条件奖励', value: [] }, branchGuards: { label: '分支门控', value: [] }, revealTriggers: { label: '揭示条件', value: [] },
  reactions: { label: '完结反应', value: [] }, followUps: { label: '独立后续', value: [] }, pushAfterStory: { label: '前置 Story', value: '' },
  block: { label: '阻塞条件', value: { type: 'AND', conditions: [] } }, interruptible: { label: '可打断', value: true },
  leaveArea: { label: '允许离开区域', value: true }, blocksInteraction: { label: '阻塞玩家交互', value: false },
  tags: { label: '标签', value: [] }, extra: { label: '扩展数据', value: { t: 'dict', v: {} } },
};
function renderKizunaBinding(ctx: UIContext, state: StoryEditorState, draft: StoryDraft, table: string, index: number): string {
  const e=ctx.escapeHtml; const path=[table,index,'kizuna']; const binding=valueAt(draft.authoring,path) as {entryId?:string;areaId?:string;returnFlags?:string[]} | undefined;
  if(binding===undefined)return '';
  if (!binding || typeof binding!=='object' || Array.isArray(binding)) return `<p class="story-editor-error">羁绊关联结构不完整。<button type="button" class="mini-action mini-action--danger" data-value-action="remove" data-value-scope="$authoring" data-value-path="${e(JSON.stringify(path))}">移除无效关联</button></p>`;
  const locked=state.storageBlocked?' disabled':'';
  const attrs=(p: readonly (string|number)[])=>`data-value-scope="$authoring" data-value-path="${e(JSON.stringify(p))}"`;
  const candidates=new Map([...ctx.game.registry.activeStories.values(),...state.drafts.flatMap(x=>x.authoring?.activeStories ?? [])].filter(x=>typeof x.id==='string'&&Boolean(x.id)).map(x=>[x.id,x]));
  const own=valueAt(draft.authoring,[table,index,'id']);
  const all=[...ctx.game.registry.storyEntries.values(),...state.drafts.flatMap(x=>[...(x.authoring?.activeStories ?? []),...(x.authoring?.passiveStories ?? [])])];
  const used=new Set(all.filter(x=>x.id!==own).map(x=>x.kizuna?.entryId));
  const entries=[...candidates.values()].filter(x=>x.id!==own&&!x.kizuna&&(!used.has(x.id)||x.id===binding.entryId));
  const missing=binding.entryId&&!entries.some(x=>x.id===binding.entryId)?`<option value="${e(binding.entryId)}" selected>${e(binding.entryId)}（目标不存在）</option>`:'';
  return `<section class="story-editor-presentation" data-editor-key="kizuna:${e(structuredKey(draft,'$authoring',path))}"><h3>羁绊子故事</h3>
    <label class="story-editor-property">目标主动 Entry<select data-value-input="string" ${attrs([...path,'entryId'])}${locked}><option value="">选择子故事</option>${missing}${entries.map(x=>`<option value="${e(x.id)}"${x.id===binding.entryId?' selected':''}>${e(x.openingTitle ?? x.id)}</option>`).join('')}</select></label>
    <label class="story-editor-property">接续方式<select data-authoring-kizuna-mode="${table}" data-authoring-index="${index}"${locked}><option value="direct"${binding.areaId===undefined?' selected':''}>从爱心卡直接开始</option><option value="area"${binding.areaId!==undefined?' selected':''}>前往指定 Area 后接取</option></select></label>
    ${binding.areaId!==undefined?`<label class="story-editor-property">赴约地点<select data-value-input="string" ${attrs([...path,'areaId'])}${locked}><option value="">选择 Area</option>${[...ctx.game.registry.areas.values()].map(x=>`<option value="${e(x.id)}"${x.id===binding.areaId?' selected':''}>${e(x.name)}</option>`).join('')}</select></label>`:''}
    ${renderStructuredValue(ctx,'$authoring',[...path,'returnFlags'],binding.returnFlags,'回传局部标记白名单',draft.structuredInputs,state.storageBlocked,0,(scope,p)=>structuredKey(draft,scope,p))}
    <p class="story-editor-hint">只允许一个子故事；子故事不能再呼出羁绊或到场续播。结束保留子故事最终场景，父正文按既有规则接续。</p>
    <button type="button" class="mini-action mini-action--danger" data-value-action="remove" ${attrs(path)}${locked}>移除羁绊关联</button></section>`;
}
export function renderStoryAuthoringFields(ctx: UIContext, state: StoryEditorState, draft: StoryDraft): string {
  const e = ctx.escapeHtml; const locked = state.storageBlocked ? ' disabled' : '';
  const entryRefs = [...ctx.game.registry.storyEntries.values(), ...state.drafts.flatMap(x=>[...(x.authoring?.activeStories ?? []),...(x.authoring?.passiveStories ?? [])])].filter(x=>typeof x.id==='string'&&Boolean(x.id)).map(x=>({value:x.id,label:String(x.openingTitle ?? x.id)}));
  const storyRefs = [...ctx.game.registry.stories.values(), ...state.drafts.map(x=>x.document)].map(x=>({value:x.id,label:x.name}));
  const value = (scope: string, path: readonly (string | number)[], content: unknown, label: string) => renderStructuredValue(ctx,scope,path,content,label,draft.structuredInputs,state.storageBlocked,0,(s,p)=>structuredKey(draft,s,p),{entryId:entryRefs,storyEntryId:entryRefs,storyId:storyRefs});
  const catalog = (ctx.game as typeof ctx.game & Partial<PackCatalogReadModel>).getPackCatalog?.();
  const targets = (catalog?.entries ?? []).filter(x => x.editingMode === 'editing');
  const related = draft.authoring;
  const entries = [...(related?.activeStories ?? []), ...(related?.passiveStories ?? [])];
  const tables = [['activeStories','主动 Entry'],['passiveStories','被动 Entry'],['passivePools','被动池']] as const;
  const rows = tables.map(([table,label]) => `<h3>${label}</h3><button type="button" class="mini-action" data-authoring-add="${table}"${locked}>新增${label}</button>${(related?.[table] ?? []).map((row,index) => `
    ${value('$authoring',[table,index],row,String(row.id ?? label))}
    ${table==='passivePools'?'':renderKizunaBinding(ctx,state,draft,table,index)}
    ${table === 'passivePools' ? '' : `<label class="story-editor-property">添加作者字段<select data-authoring-field="${table}" data-authoring-index="${index}"${locked}><option value="">选择字段…</option>${Object.entries(ENTRY_FIELD_SEEDS).filter(([name]) => !(name in row)).map(([name,field])=>`<option value="${name}">${e(field.label)}</option>`).join('')}</select></label><button type="button" class="mini-action" data-authoring-catalog="${table}" data-authoring-index="${index}"${locked}>配置故事目录</button>`}
  `).join('')}`).join('');
  const preview = state.preview;
  const phaseLabels: Record<string,string> = {idle:'播放结束',typing:'正在输入',thinking:'正在思考',operation:'正在呈现效果',banner:'开幕标题',continue:'等待继续',input:'等待输入',finishing:'正在收尾',failed:'播放失败'};
  return `<section class="story-editor-authoring" data-editor-key="story-authoring:${e(draft.draftId)}">
    <h3>文档身份</h3><label class="story-editor-property">新 Story ID<input data-editor-key="copy-story-id" data-authoring-copy-id value="${e(state.copyStoryId ?? '')}" placeholder="mod:story:name"${locked}></label><button type="button" class="mini-action" data-authoring-copy${locked}>另存为新身份</button><p class="story-editor-hint">新副本保留正文，入口由你重新配置；原 Story 与外部引用保留。</p>
    <h3>文档扩展</h3>${value('$document',['extra'],draft.document.extra,'Story Extra')}
    <h3>关联内容</h3><p class="story-editor-hint">Entry 决定故事如何触发。羁绊关联只允许一层；areaId 表示到场接取，returnFlags 是回传白名单。新字段选择值类型后填写；移除字段表示省略。</p>${rows}
    <h3>检查、试播与保存</h3><button type="button" class="mini-action" data-authoring-action="check"${locked}>校验作者内容</button><button type="button" class="mini-action" data-authoring-action="apply"${locked}>应用 Story 与关联内容</button>
    <label class="story-editor-property">试播 Entry<select data-authoring-preview-entry${locked}><option value="">${entries.length ? '选择入口' : '先新增或选择关联 Entry'}</option>${entries.map(entry=>`<option value="${e(String(entry.id ?? ''))}"${entry.id===state.previewEntryId?' selected':''}>${e(String(entry.openingTitle || entry.id || ''))}</option>`).join('')}</select></label>
    <button type="button" class="mini-action" data-authoring-action="preview"${locked}>隔离试播</button><p class="story-editor-hint">试播使用独立实例与重读规则，验证输入、分支与父子串联；不结算持久奖励，移动与演出仅影响隔离实例。关闭后释放演出。</p>
    <label class="story-editor-property">保存目标包<select data-authoring-target${locked}><option value="">${targets.length ? '选择编辑态数据包' : '请先在包管理创建编辑副本'}</option>${targets.map(target=>`<option value="${e(target.packRecordId ?? target.id)}"${target.packRecordId===state.targetPackId?' selected':''}>${e(target.name)} · ${e(target.modName)}</option>`).join('')}</select></label><button type="button" class="mini-action" data-authoring-action="pack"${locked}>保存到目标包</button><p class="story-editor-hint">仅修改目标包内的作者内容；重新载入后生效，导出沿用包管理。新内容 ID 使用目标包命名空间。</p>
    ${preview ? `<section class="story-editor-preview" data-editor-key="authoring-preview"><h3>隔离试播</h3>${preview.playback?.entries.map(entry=>renderChatEntry(ctx,{ ...entry, kind: entry.kind === 'travel' ? 'reward' : entry.kind })).join('') ?? ''}${preview.playback?.banner ? `<p>${e(preview.playback.banner.title)}</p>` : ''}<p class="story-editor-hint">${e(preview.playback?.error ?? phaseLabels[preview.playback?.phase ?? 'idle'])}</p>${preview.story?.page.choices?.map(choice=>`<button type="button" class="mini-action" data-authoring-preview-option="${e(choice.id)}">${e(choice.text)}</button>`).join('') ?? ''}<button type="button" class="mini-action" data-authoring-action="advance">继续 / 加速</button><button type="button" class="mini-action" data-authoring-action="close-preview">关闭试播</button></section>` : ''}
  </section>`;
}
