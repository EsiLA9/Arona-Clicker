import type { UIContext } from '../runtime/context';
import { currentStoryFlagCatalog } from './flag-catalog-view';
import { storyFlagNames } from './flag-catalog';
import type { PackCatalogReadModel } from '../../arona-clicker/contracts/runtime/runtime';
import { currentAuthoringDraft, storyEntries, storyPreviewEntries, type StoryDraft, type StoryEditorState } from './model';
import { valueAt, renderStructuredValue } from './structured-value';
import { structuredKey } from './authoring-model';
import type { StoryEntryDef } from '../../data-services/contracts/story-entry';
import { parseCharacterStoryDirectoryId } from '../../data-services/contracts/story-directory';
import { storyCatalogLabel } from './catalog-dialog';
import { isTrueConditionRoot } from './condition-tree-model';
import { entryConditionField } from './condition-fields';
import { storyReferenceOptions } from './property-options';
import { renderStoryEditorTarget } from './target-view';
import type { Condition, ConditionGroup } from '../../engine/types/expression';

export function renderPublicDescriptionField(ctx: UIContext, draft: StoryDraft, scope: '$document' | '$authoring',
  path: (string | number)[], description: string | undefined, locked: string, hint: string): string {
  const e = ctx.escapeHtml;
  const key = structuredKey(draft, scope, path);
  return `<label class="story-editor-property">公开简介<textarea data-editor-key="value:${e(key)}" data-value-scope="${scope}"
    data-value-path="${e(JSON.stringify(path))}" data-public-description${locked}>${e(draft.structuredInputs?.[key]?.text ?? description ?? '')}</textarea>
    <small class="story-editor-hint">${e(hint)}</small></label>`;
}

export const ENTRY_FIELD_SEEDS: Record<string, { label: string; value: unknown }> = {
  owner: { label: '归属角色', value: '' },
  openingTitle: { label: '开幕标题', value: '' }, travelToStartContext: { label: '前往起始场景', value: true },
  availableInits: { label: '允许的 Init', value: [] },
  triggerCondition: { label: '触发条件', value: { type: 'OR', conditions: [] } },
  completionReward: { label: '完成奖励', value: { first: [], repeat: [] } }, completionStrategy: { label: '完成策略', value: 'simple' },
  conditionalRewards: { label: '条件奖励', value: [] }, branchGuards: { label: '分支门控', value: [] }, revealTriggers: { label: '揭示条件', value: [] },
  reactions: { label: '完结反应', value: [] }, followUps: { label: '独立后续', value: [] },
  block: { label: '解除阻塞条件', value: { type: 'AND', conditions: [] } }, interruptible: { label: '可打断', value: true },
  leaveArea: { label: '允许离开区域', value: true }, blocksInteraction: { label: '阻塞玩家交互', value: false },
  tags: { label: '标签', value: [] }, extra: { label: '扩展数据', value: { t: 'dict', v: {} } },
};

function entryDirectorySummary(ctx: UIContext, row: StoryEntryDef, packId?: string): string {
  const registry = ctx.game.registry;
  const pack = packId ? (ctx.game as Partial<PackCatalogReadModel>).getPackRecord?.(packId) : undefined;
  const names = row.directoryPlacements?.map(placement => {
    const init = registry.inits.get(placement.initId)?.name ?? placement.initId;
    if (placement.hierarchyString !== undefined) return `${init} · ${placement.hierarchyString}`;
    const id = placement.directoryId ?? '';
    const title = pack?.datapack.storyDirectories?.find(folder => folder.id === id)?.title
      ?? registry.storyDirectories.get(id)?.definition.title;
    const automatic = !title && parseCharacterStoryDirectoryId(id);
    const character = automatic ? registry.characters.get(automatic.characterId)?.displayName : undefined;
    return `${init} · ${title ?? character ?? id}`;
  });
  return names?.length ? names.join(' / ') : row.catalog ? storyCatalogLabel(row.catalog) : '使用自动归档';
}

function renderEntryConfiguration(ctx: UIContext, state: StoryEditorState, draft: StoryDraft, table: string, index: number, row: StoryEntryDef): string {
  const e=ctx.escapeHtml, locked=(state.storageBlocked || Boolean(state.readOnlyReason))?' disabled':'', base=[table,index], activation=row.activation;
  const pathAttrs=(path: (string|number)[])=>`data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base,...path]))}"`;
  const select=(part:string,label:string,value:string,options:[string,string][])=>`<label class="story-editor-property">${label}<select data-entry-activation-part="${part}" data-entry-table="${table}" data-entry-index="${index}"${locked}>${options.map(([id,title])=>`<option value="${id}"${value===id?' selected':''}>${title}</option>`).join('')}</select></label>`;
  let content=select('kind','激活方式',activation.kind,[['active','主动接取'],['random','随机抽取'],['affection','好感／角色阶段']]);
  if(activation.kind==='active'){
    content+=select('fallback','地区兜底',activation.fallback?.kind ?? 'none',[['none','不兜底投放'],['current-area','首个符合资格的当前地区'],['fixed-area','指定接取地区']]);
    if(activation.fallback?.kind==='fixed-area') {
      const path = ['activation', 'fallback', 'areaId'];
      const key = structuredKey(draft, '$authoring', [...base, ...path]);
      const input = draft.structuredInputs?.[key];
      content += `<label class="story-editor-property">兜底接取地区<input data-editor-key="value:${e(key)}" data-value-input="string" ${pathAttrs(path)} value="${e(input?.text ?? activation.fallback.areaId)}" data-story-reference="area"${locked}>${input?.error ? `<span class="story-editor-error">${e(input.error)}</span>` : ''}</label>`;
    }
  }
  return `<section class="story-editor-entry-section" data-editor-key="entry-activation:${e(row.id)}">
    <h3>接取与目录</h3>
    <div class="story-editor-entry-grid">${content}</div>
    <section class="story-editor-trigger-condition" data-editor-key="entry-catalog">
      <div><h4>故事目录位置</h4><p>${e(entryDirectorySummary(ctx, row, draft.targetPackId))}</p></div>
      <div class="story-editor-actions story-editor-actions--tools"><button type="button" class="mini-action" data-editor-directory="entry">${state.readOnlyReason ? '查看目录' : '选择目录'}</button><button type="button" class="mini-action" data-authoring-catalog="${table}" data-authoring-index="${index}"${locked}>旧编排</button></div>
    </section>
  </section>`;
}
function authoringValueRenderer(ctx: UIContext, state: StoryEditorState, draft: StoryDraft) {
  const flags = currentStoryFlagCatalog(ctx,state);
  const globalFlags = storyFlagNames(flags,'global').map(name=>({value:name,label:name}));
  const localFlags = [...new Set(flags.uses.filter(use=>use.kind==='local').map(use=>use.name))].map(name=>({value:name,label:name}));
  const entryRefs = [...storyEntries(state,ctx.game.registry.storyEntries).values()].filter(x=>typeof x.id==='string'&&Boolean(x.id)).map(x=>({value:x.id,label:String(x.openingTitle ?? x.id)}));
  const storyRefs = storyReferenceOptions(ctx, 'story', state);
  return (scope: string, path: readonly (string | number)[], content: unknown, label: string) => renderStructuredValue(ctx,scope,path,content,label,draft.structuredInputs,(state.storageBlocked || Boolean(state.readOnlyReason)),0,(s,p)=>structuredKey(draft,s,p),{entryId:entryRefs,storyEntryId:entryRefs,storyId:storyRefs,flagId:globalFlags,$globalFlags:globalFlags,$localFlags:localFlags},
    scope === '$authoring' && (path[0] === 'activeStories' || path[0] === 'passiveStories')
      ? (fieldPath, value) => renderEntryConditionField(ctx, state, draft, fieldPath, value) : undefined);
}

function renderEntryConditionField(ctx: UIContext, state: StoryEditorState, draft: StoryDraft, path: readonly (string | number)[], value: unknown): string | undefined {
  const field = entryConditionField(path.slice(2));
  if (!field) return;
  const e = ctx.escapeHtml;
  const locked = (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : '';
  const group = value as Partial<ConditionGroup> | undefined;
  const leaf = value as Partial<Condition> | undefined;
  const summary = isTrueConditionRoot(value) ? '恒为 True'
    : value === undefined ? field.absent ?? '待配置'
    : Array.isArray(group?.conditions) && group.type === 'AND' ? `全部满足 · ${group.conditions.length} 项`
    : Array.isArray(group?.conditions) && group.type === 'OR'
      ? group.conditions.length ? `任一满足 · ${group.conditions.length} 个分支` : '空 OR · 恒不成立'
      : typeof leaf?.target === 'string' ? '单条条件' : '待配置';
  const attrs = `data-value-scope="$authoring" data-value-path="${e(JSON.stringify(path))}"`;
  return `<section class="story-editor-trigger-condition" data-editor-key="entry-condition:${e(structuredKey(draft, '$authoring', path))}">
    <div><h3>${e(field.label)}</h3><p>${e(summary)}</p></div>
    <div class="story-editor-actions story-editor-actions--tools">
      <button type="button" class="mini-action" data-entry-condition="${e(String(path[2]))}" ${attrs}${locked}>${value === undefined ? '配置条件' : '编辑条件'}</button>
      ${field.optional && value !== undefined ? `<button type="button" class="mini-action" data-value-action="remove" ${attrs}${locked}>移除条件</button>` : ''}
    </div>
  </section>`;
}
export function renderStoryEntryFields(ctx: UIContext, state: StoryEditorState): string {
  const draft = currentAuthoringDraft(state);
  const id = state.target?.kind === 'entry' ? state.target.id : undefined;
  if (!draft || id === undefined) return '<p class="story-editor-empty">找不到该 Entry 的作者草稿。</p>';
  const table = draft.authoring!.activeStories.some(entry => entry.id === id) ? 'activeStories' : 'passiveStories';
  const index = draft.authoring![table].findIndex(entry => entry.id === id);
  const locked = (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : '';
  if(state.entryPoolContext?.entryId!==id) state.entryPoolContext={entryId:id,poolKeys:[]};
  draft.authoring!.passivePools.forEach((pool,poolIndex)=>{
    const key=structuredKey(draft,'$authoring',['passivePools',poolIndex]);
    if(pool.children.some(child=>child.id===id)&&!state.entryPoolContext!.poolKeys.includes(key))state.entryPoolContext!.poolKeys.push(key);
  });
  const poolTokens=new Set(state.entryPoolContext.poolKeys);
  const row=draft.authoring![table][index], base=[table,index], e=ctx.escapeHtml, value=authoringValueRenderer(ctx,state,draft);
  const rowValues=row as unknown as Record<string,unknown>;
  const editor=(key:string,label:string)=>value('$authoring',[...base,key],rowValues[key],label);
  const editorPath=(path:(string|number)[],content:unknown,label:string)=>value('$authoring',[...base,...path],content,label);
  const ownerPath=[...base,'owner'], ownerKey=structuredKey(draft,'$authoring',ownerPath), ownerInput=draft.structuredInputs?.[ownerKey];
  const ownerField=`<label class="story-editor-property">归属角色<input data-editor-key="value:${e(ownerKey)}" data-value-input="string" data-value-scope="$authoring" data-value-path="${e(JSON.stringify(ownerPath))}" data-story-reference="variant" data-reference-label="归属角色" value="${e(ownerInput?.text??String(row.owner??''))}"${locked}>${ownerInput?.error?`<span class="story-editor-error">${e(ownerInput.error)}</span>`:''}</label>`;
  const rewardStrategy=row.completionStrategy??'simple';
  const strategyKey=structuredKey(draft,'$authoring',[...base,'completionStrategy']);
  const strategyControl=`<label class="story-editor-property">完成策略<select data-editor-key="value:${e(strategyKey)}" data-value-input="string" data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base,'completionStrategy']))}"${locked}><option value="simple"${rewardStrategy==='simple'?' selected':''}>简单</option><option value="conditional"${rewardStrategy==='conditional'?' selected':''}>条件</option></select></label>`;
  const storyOptions = storyReferenceOptions(ctx, 'story', state);
  const effectiveTitle = row.openingTitle || storyOptions.find(option => option.value === row.storyId)?.label || row.storyId;
  const binding = (field: string) => `data-editor-key="value:${e(structuredKey(draft, '$authoring', [...base, field]))}" data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base, field]))}"`;
  const textField = (field: 'id' | 'storyId' | 'openingTitle', label: string) => {
    const key = structuredKey(draft, '$authoring', [...base, field]);
    const input = draft.structuredInputs?.[key];
    const fields = field === 'storyId' ? ' data-story-reference="story" list="story-editor-entry-linked-stories"' : '';
    return `<label class="story-editor-property">${label}<input ${binding(field)} data-value-input="string"${fields} value="${e(input?.text ?? row[field] ?? '')}"${locked}>${input?.error ? `<span class="story-editor-error">${e(input.error)}</span>` : ''}</label>`;
  };
  const authorFields = (['tags', 'extra'] as const).filter(key => !(key in row));
  const basic = `
    <section class="story-editor-entry-section">
      <h3>入口身份</h3>
      <div class="story-editor-entry-grid story-editor-entry-identity">${textField('id', '入口 ID')}${textField('storyId', '关联剧情')}</div>
      <datalist id="story-editor-entry-linked-stories">${storyOptions.map(option => `<option value="${e(option.value)}" label="${e(option.label)}"></option>`).join('')}</datalist>
    </section>
    ${renderEntryConfiguration(ctx, state, draft, table, index, row)}
    <section class="story-editor-entry-section">
      <h3>展示与重读</h3>
      <div class="story-editor-actions story-editor-actions--tools story-editor-entry-title">
        ${textField('openingTitle', '开幕标题')}
        ${row.openingTitle === undefined ? '' : `<button type="button" class="mini-action" data-value-action="remove" data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base, 'openingTitle']))}"${locked}>恢复默认标题</button>`}
      </div>
      <p class="story-editor-hint">当前显示标题：${e(effectiveTitle)}</p>
      ${renderPublicDescriptionField(ctx, draft, '$authoring', [...base, 'publicDescription'], row.publicDescription, locked,
        '入口可见且名称已揭示后展示。留空时可使用同 Mod 正文的公开简介。')}
      <label class="story-editor-property">剧情重读
        <select ${binding('replayable')} data-value-input="boolean" data-entry-replay-policy${locked}>
          <option value=""${row.replayable === undefined ? ' selected' : ''}>按已读记录开放（默认）</option>
          <option value="true"${row.replayable === true ? ' selected' : ''}>允许重读</option>
          <option value="false"${row.replayable === false ? ' selected' : ''}>不开放重读</option>
        </select>
      </label>
    </section>
    <details class="story-editor-entry-section story-editor-advanced" data-editor-key="entry-author-fields">
      <summary>标签与扩展数据</summary>
      ${'tags' in row ? editor('tags', '标签') : ''}
      ${'extra' in row ? editor('extra', '扩展数据') : ''}
      ${authorFields.length ? `<label class="story-editor-property">添加字段<select data-authoring-field="${table}" data-authoring-index="${index}"${locked}><option value="">选择字段…</option>${authorFields.map(name => `<option value="${name}">${e(ENTRY_FIELD_SEEDS[name].label)}</option>`).join('')}</select></label>` : ''}
    </details>
    <div class="story-editor-entry-section story-editor-actions story-editor-actions--tools">
      <button type="button" class="mini-action mini-action--danger" data-value-action="remove" data-value-scope="$authoring" data-value-path="${e(JSON.stringify(base))}"${locked}>删除入口</button>
    </div>`;
  const rewardEffects = (type: 'first' | 'repeat', label: string) =>
    `<section class="story-editor-reward-simple" data-editor-key="reward:${type}"><h4>${label}</h4>${editorPath(['completionReward', type], row.completionReward?.[type], '效果列表')}</section>`;
  const conditionalRows=(row.conditionalRewards??[]).map((outcome,outcomeIndex)=>{
    const path=['conditionalRewards',outcomeIndex] as (string|number)[];
    const stable=structuredKey(draft,'$authoring',[...base,...path]);
    const attrs = `data-value-scope="$authoring" data-value-path="${e(JSON.stringify([...base, ...path]))}"`;
    return `<article class="story-editor-reward-row" data-editor-key="reward-outcome:${e(stable)}">
      <header class="story-editor-list-heading"><strong>条件奖励 ${outcomeIndex + 1}</strong>
        <div class="story-editor-actions story-editor-actions--tools">
          <button type="button" class="mini-action" data-value-action="up" ${attrs}${outcomeIndex === 0 || locked ? ' disabled' : ''}>上移</button>
          <button type="button" class="mini-action" data-value-action="down" ${attrs}${outcomeIndex === row.conditionalRewards!.length - 1 || locked ? ' disabled' : ''}>下移</button>
          <button type="button" class="mini-action mini-action--danger" data-value-action="remove" ${attrs}${locked}>删除</button>
        </div>
      </header>
      <div class="story-editor-entry-grid">
        ${editorPath([...path, 'condition'], outcome.condition, '条件组')}
        ${editorPath([...path, 'effects'], outcome.effects, '命中后发放的效果')}
      </div>
    </article>`;
  }).join('');
  const rewards = `
    <section class="story-editor-entry-section">
      <h3>完结奖励</h3>
      ${strategyControl}
      <p class="story-editor-hint">首次与重复奖励始终提供。条件模式下，每条命中的规则都会发放效果。</p>
      ${row.completionReward ? `<div class="story-editor-entry-grid">${rewardEffects('first', '首次奖励')}${rewardEffects('repeat', '重复奖励')}</div>`
        : `<div class="story-editor-actions story-editor-actions--tools"><button type="button" class="mini-action" data-authoring-init-rewards${locked}>配置首次与重复奖励</button></div>`}
    </section>
    ${rewardStrategy === 'simple' ? '' : `<section class="story-editor-entry-section" aria-label="条件奖励表">
      <header class="story-editor-list-heading">
        <h3>条件奖励</h3>
        <div class="story-editor-actions story-editor-actions--tools"><button type="button" class="mini-action" data-authoring-add-condition-reward${locked}>添加条件奖励</button></div>
      </header>
      ${conditionalRows || '<p class="story-editor-hint">尚无条件奖励规则。</p>'}
    </section>`}`;
  const detailKeys=['availableInits','triggerCondition','owner','interruptible','leaveArea','blocksInteraction','block','travelToStartContext','revealTriggers','branchGuards','reactions','followUps'];
  const activationDetail=row.activation.kind==='random'?value('$authoring',[...base,'activation','weight'],row.activation.weight,'基础权重')+value('$authoring',[...base,'activation','repeatable'],row.activation.repeatable,'正式重复触发')+value('$authoring',[...base,'activation','cooldownFrames'],row.activation.cooldownFrames??0,'Entry 冷却帧数'):
    row.activation.kind==='affection'?value('$authoring',[...base,'activation','when'],row.activation.when,'好感等级或前置 Story')+value('$authoring',[...base,'activation','cooldownFrames'],row.activation.cooldownFrames??0,'Entry 冷却帧数'):'';
  const applicableDetail=detailKeys.filter(key=>key!=='owner'&&(row.activation.kind!=='active'||!['interruptible','leaveArea','blocksInteraction','block'].includes(key)));
  const addableDetail=applicableDetail.filter(key=>key!=='triggerCondition'&&!(key in row));
  const gateFields = applicableDetail.map(key => key === 'triggerCondition' || key in row
    ? editor(key, ENTRY_FIELD_SEEDS[key]?.label ?? key) : '').join('');
  const pools = draft.authoring!.passivePools.map((pool, poolIndex) => {
    const path = ['passivePools', poolIndex];
    const key = structuredKey(draft, '$authoring', path);
    const linked = pool.children.some(child => child.id === id);
    if (!linked && !poolTokens.has(key)) return '';
    return `<details class="story-editor-entry-pool" data-editor-key="entry-pool:${e(key)}">
      <summary>${e(pool.name ?? pool.id)}${linked ? '' : ' · 本次编辑，已解除关联'}</summary>
      ${value('$authoring', path, pool, pool.id)}
    </details>`;
  }).join('');
  const detail = `
    <section class="story-editor-entry-section">
      <h3>触发与限制</h3>
      ${activationDetail}
      ${row.activation.kind === 'affection' || 'owner' in row ? ownerField : ''}
      ${gateFields}
      <label class="story-editor-property">添加详细门控字段<select data-authoring-field="${table}" data-authoring-index="${index}"${locked}><option value="">选择字段…</option>${addableDetail.map(key=>`<option value="${key}">${e(ENTRY_FIELD_SEEDS[key]?.label??key)}</option>`).join('')}${row.activation.kind!=='affection'&&!( 'owner' in row)?'<option value="owner">归属角色</option>':''}</select></label>
    </section>
    <section class="story-editor-entry-section">
      <header class="story-editor-list-heading">
        <h3>所在抽取池</h3>
        <div class="story-editor-actions story-editor-actions--tools"><button type="button" class="mini-action" data-authoring-add="passivePools"${(state.storageBlocked || Boolean(state.readOnlyReason)) || row.activation.kind !== 'random' ? ' disabled' : ''}>新增关联抽取池</button></div>
      </header>
      ${pools || `<p class="story-editor-hint">${row.activation.kind === 'random' ? '尚未关联抽取池。' : '随机抽取入口可加入抽取池。'}</p>`}
    </section>`;
  const tab = state.entryEditorTab ?? 'basic';
  const page = tab === 'rewards' ? rewards : tab === 'gates' ? detail : basic;
  return `<div data-editor-key="entry-authoring:${e(draft.draftId)}"><section class="story-editor-entry-page" data-editor-key="entry-page:${tab}" role="tabpanel">${page}</section></div>`;
}
export function renderStoryAuthoringEntryRelations(ctx: UIContext, state: StoryEditorState, draft: StoryDraft): string {
  const e = ctx.escapeHtml;
  const related = draft.authoring;
  const entries = storyEntries(state, ctx.game.registry.storyEntries);
  const tables = [['activeStories','主动 Entry','active','activeStories'],['passiveStories','随机 Entry','random','passiveStories'],['passiveStories','好感／角色阶段 Entry','affection','affection']] as const;
  const rows = tables.map(([table,label,kind,action]) => `<div class="story-editor-list-heading"><h3>${label}</h3><button type="button" class="mini-action" data-authoring-add="${action}" data-editor-key="authoring-add:${kind}"${(state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : ''}>新增${label}</button></div>${(related?.[table] ?? []).filter(row=>row.activation.kind===kind).map(row =>
    renderStoryEditorTarget(ctx, 'entry', row.id, row.openingTitle || draft.document.name, true, {
      relation: { key: `entry:${table}:${row.id}`, detail: entryDirectorySummary(ctx, row, draft.targetPackId), showType: false },
      gradient: entries.get(row.id)?.cardGradient,
    })).join('')}`).join('');
  return `<section class="story-editor-authoring" data-editor-key="story-authoring-relations:${e(draft.draftId)}"><h3>关联 Entry</h3><p class="story-editor-hint">创建 Entry，或选择现有 Entry 继续编辑。</p>${rows}</section>`;
}
export function renderStoryAuthoringTools(ctx: UIContext, state: StoryEditorState, draft: StoryDraft): string {
  const e = ctx.escapeHtml; const locked = (state.storageBlocked || Boolean(state.readOnlyReason)) ? ' disabled' : '';
  const value = authoringValueRenderer(ctx,state,draft);
  const catalog = (ctx.game as typeof ctx.game & Partial<PackCatalogReadModel>).getPackCatalog?.();
  const targets = (catalog?.entries ?? []).filter(x => x.editingMode === 'editing');
  const targetPackId = draft.targetPackId ?? state.targetPackId;
  const { entries, entryId } = storyPreviewEntries(state, draft, ctx.game.registry.storyEntries);
  return `<section class="story-editor-authoring" data-editor-key="story-authoring:${e(draft.draftId)}">
    <section class="story-editor-tool-section">
      <h3>试播</h3>
      <div class="story-editor-actions story-editor-actions--tools">
        ${entries.length ? `<label class="story-editor-property">试播入口<select data-editor-key="preview-entry:${e(draft.draftId)}" data-authoring-preview-entry><option value=""${entryId === '' ? ' selected' : ''}>直接试播正文</option>${entries.map(entry => `<option value="${e(entry.id)}"${entry.id === entryId ? ' selected' : ''}>${e(entry.openingTitle || entry.id)}</option>`).join('')}</select></label>` : ''}
        <button type="button" class="mini-action" data-authoring-action="preview" data-editor-key="tools-preview">试播</button>
      </div>
      <p class="story-editor-hint">${entryId ? '使用所选入口试播，会检查入口资格与重读分支条件。' : '从当前正文开始。'} 试播决定只在本次播放中生效。</p>
    </section>
    <section class="story-editor-tool-section">
      <h3>检查与应用</h3>
      <div class="story-editor-actions story-editor-actions--tools">
        <button type="button" class="mini-action" data-authoring-action="check"${locked}>检查内容</button>
        <button type="button" class="mini-action" data-authoring-action="apply"${locked || (state.canApplySource === false ? ' disabled' : '')}>应用正文与关联内容</button>
      </div>
    </section>
    <section class="story-editor-tool-section">
      <h3>数据包</h3>
      <div class="story-editor-actions story-editor-actions--tools">
        ${state.sourceOptions ? `<p class="story-editor-hint">${e(draft.packSource?.label ?? '请打开内容所属的编辑态包。')}</p>` : `<label class="story-editor-property">目标数据包<select data-authoring-target${locked}><option value="">${targets.length ? '选择编辑态数据包' : '请先在包管理创建编辑副本'}</option>${targets.map(target=>`<option value="${e(target.packRecordId ?? target.id)}"${(target.packRecordId ?? target.id)===targetPackId?' selected':''}>${e(target.name)} · ${e(target.modName)}</option>`).join('')}</select></label>`}
        <button type="button" class="mini-action" data-authoring-action="pack"${locked}>保存到编辑态包</button>
      </div>
      <p class="story-editor-hint">修改在重新载入目标包后生效。新内容 ID 使用目标包命名空间。</p>
    </section>
    <section class="story-editor-tool-section">
      <h3>文档身份</h3>
      <div class="story-editor-actions story-editor-actions--tools">
        <label class="story-editor-property">新 Story ID<input data-editor-key="copy-story-id" data-authoring-copy-id value="${e(state.copyStoryId ?? '')}" placeholder="mod:story:name"${locked}></label>
        <button type="button" class="mini-action" data-authoring-copy${locked}>另存为副本</button>
      </div>
      <p class="story-editor-hint">副本保留正文，入口需要重新配置。</p>
    </section>
    <section class="story-editor-tool-section">
      <h3>文档扩展</h3>
      ${value('$document', ['extra'], draft.document.extra, '扩展数据')}
    </section>
  </section>`;
}
