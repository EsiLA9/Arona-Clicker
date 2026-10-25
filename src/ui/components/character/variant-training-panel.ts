import type { VariantTrainingPort, VariantTrainingSource, VariantTrainingView } from '../../../arona-clicker/contracts/character/variant-training';
import type { VariantTranslationIssue, VariantTranslationPreview, TranslatedVariantMember } from '../../../arona-clicker/contracts/character/variant-translation';
import '../../css/variant-training.css';

let nextPanelId = 0;

/** Mounts the shared training interaction in either the local console or the formal Spot modal. */
export function mountVariantTrainingPanel(
  host: HTMLElement,
  port: VariantTrainingPort,
  onEnterOffice?: () => boolean,
  options: { readonly mode?: 'development' | 'formal' } = {},
): () => void {
  const panelId = `variant-training-${++nextPanelId}`;
  const formal = options.mode === 'formal';
  const section = document.createElement('section');
  section.className = 'variant-training-panel';
  section.dataset.variantTrainingPanel = 'true';
  section.setAttribute('aria-labelledby', `${panelId}-title`);
  section.innerHTML = `
    <div class="variant-training-panel__head">
      <div><h3 id="${panelId}-title">${formal ? '转译演练' : 'Variant 转译演练场'}</h3><p data-training-summary></p></div>
      <button type="button" data-training-office>进入夏莱办公室</button>
    </div>
    <div class="variant-training-panel__controls">
      <label for="${panelId}-source">演练来源</label>
      <select id="${panelId}-source" data-training-source></select>
      <button type="button" data-training-preview>预览来源</button>
      <button type="button" data-training-start disabled>确认并开始</button>
    </div>
    <p>来源选择用于下次预览；当前战斗使用下方的入场快照。</p>
    <p class="variant-training-panel__message" data-training-message role="status" aria-live="polite"></p>
    <div class="variant-training-panel__region" data-training-preview-region hidden>
      <h4>来源预览</h4><div data-training-preview-content></div>
    </div>
    <div class="variant-training-panel__region" data-training-battle-region hidden>
      <h4>演练战斗</h4><div data-training-battle-content></div>
      <div class="variant-training-panel__actions"><button type="button" data-training-commit>提交本回合</button></div>
    </div>
    <div class="variant-training-panel__region" data-training-result-region hidden>
      <h4>结果核对</h4><div data-training-result-content></div>
    </div>
    <div class="variant-training-panel__checkpoint">
      <button type="button" data-training-save>保存检查点</button>
      <button type="button" data-training-load disabled>恢复检查点</button>
      <span data-training-checkpoint-status>尚未保存检查点</span>
    </div>`;
  host.append(section);

  const source = section.querySelector<HTMLSelectElement>('[data-training-source]')!;
  const summary = section.querySelector<HTMLElement>('[data-training-summary]')!;
  const message = section.querySelector<HTMLElement>('[data-training-message]')!;
  const previewRegion = section.querySelector<HTMLElement>('[data-training-preview-region]')!;
  const previewContent = section.querySelector<HTMLElement>('[data-training-preview-content]')!;
  const battleRegion = section.querySelector<HTMLElement>('[data-training-battle-region]')!;
  const battleContent = section.querySelector<HTMLElement>('[data-training-battle-content]')!;
  const resultRegion = section.querySelector<HTMLElement>('[data-training-result-region]')!;
  const resultContent = section.querySelector<HTMLElement>('[data-training-result-content]')!;
  const previewButton = section.querySelector<HTMLButtonElement>('[data-training-preview]')!;
  const startButton = section.querySelector<HTMLButtonElement>('[data-training-start]')!;
  const commitButton = section.querySelector<HTMLButtonElement>('[data-training-commit]')!;
  const saveButton = section.querySelector<HTMLButtonElement>('[data-training-save]')!;
  const loadButton = section.querySelector<HTMLButtonElement>('[data-training-load]')!;
  const checkpointStatus = section.querySelector<HTMLElement>('[data-training-checkpoint-status]')!;
  const officeButton = section.querySelector<HTMLButtonElement>('[data-training-office]')!;
  officeButton.hidden = formal || !onEnterOffice;

  let previewToken: string | null = null;
  let memoryCheckpoint: string | null = null;
  let previewSource: VariantTrainingSource | null = null;

  const clearPreview = (): void => {
    previewToken = null;
    previewSource = null;
    startButton.disabled = true;
    previewRegion.hidden = true;
  };

  const showPreview = (result: VariantTranslationPreview, view: VariantTrainingView): void => {
    summary.textContent = `${view.displayName} · ${view.owned ? '当前已持有' : '当前未持有'}`;
    previewContent.replaceChildren();
    previewRegion.hidden = false;
    if (result.status === 'blocked') {
      const list = document.createElement('ul');
      for (const issue of result.issues) {
        const item = document.createElement('li');
        item.textContent = previewIssueText(issue);
        list.append(item);
      }
      previewContent.append(list);
      message.textContent = result.issues[0] ? previewIssueText(result.issues[0]) : '当前来源无法进入演练。';
      return;
    }
    previewToken = result.token;
    previewSource = source.value as VariantTrainingSource;
    previewContent.append(renderMemberPreview(result.members[0], view));
    startButton.disabled = false;
    message.textContent = '预览已就绪；确认后将以这份快照进入演练。';
  };

  const refresh = (): void => {
    try {
      const view = port.getView();
      summary.textContent = `${view.displayName} · ${view.owned ? '当前已持有' : '当前未持有'}`;
      const selected = source.value;
      source.replaceChildren();
      for (const entry of view.sources) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.label;
        source.append(option);
      }
      source.value = view.sources.some(entry => entry.id === selected) ? selected : 'normal';
      previewButton.disabled = false;
      source.disabled = false;
      startButton.textContent = view.phase === 'preparation' ? '确认并开始' : '重新开始演练';
      commitButton.disabled = view.phase !== 'battle';
      saveButton.disabled = view.phase !== 'battle';
      officeButton.disabled = !onEnterOffice;
      clearPreview();
      previewRegion.hidden = true;
      battleRegion.hidden = view.phase !== 'battle';
      resultRegion.hidden = view.phase !== 'result';
      if (view.phase === 'battle') renderBattle(view);
      else if (view.phase === 'result') renderResult(view);
      if (!view.owned && source.value === 'owned') message.textContent = '当前未持有该角色。可选择普通或强化切片继续演练。';
      else if (view.phase === 'preparation') message.textContent = '选择来源并预览，确认后开始演练。';
    } catch (error) {
      message.textContent = errorText(error, '读取演练状态失败。');
    }
  };

  source.addEventListener('change', () => {
    clearPreview();
    message.textContent = source.value === 'owned'
      ? '当前持有来源会读取真实培养数据；未持有时无法开始。'
      : '预览将显示该切片的原始属性与转译结果。';
  });
  previewButton.addEventListener('click', () => {
    clearPreview();
    previewContent.replaceChildren();
    try {
      showPreview(port.preview(source.value as VariantTrainingSource), port.getView());
    } catch (error) {
      clearPreview();
      previewRegion.hidden = false;
      previewContent.textContent = errorText(error, '无法预览这个来源。');
      message.textContent = errorText(error, '来源预览失败。');
    }
  });
  startButton.addEventListener('click', () => {
    if (!previewToken || previewSource !== source.value) {
      message.textContent = '请先为当前来源重新预览。';
      return;
    }
    try {
      port.start(previewToken);
      message.textContent = '演练已开始。';
      refresh();
    } catch (error) {
      clearPreview();
      message.textContent = errorText(error, '无法开始演练；请重新预览。');
    }
  });
  commitButton.addEventListener('click', () => {
    try {
      const view = port.getView();
      port.commitRound(view.commitVersion);
      message.textContent = '本回合已提交。';
      refresh();
    } catch (error) {
      message.textContent = errorText(error, '回合提交失败；请确认当前状态后重试。');
    }
  });
  saveButton.addEventListener('click', () => {
    try {
      memoryCheckpoint = JSON.stringify(port.save());
      loadButton.disabled = false;
      checkpointStatus.textContent = '检查点已保存在当前页面内存';
      message.textContent = '检查点已保存，刷新页面后会清空。';
    } catch (error) {
      message.textContent = errorText(error, '当前状态无法保存检查点。');
    }
  });
  loadButton.addEventListener('click', () => {
    if (!memoryCheckpoint) return;
    try {
      const view = port.load(JSON.parse(memoryCheckpoint) as unknown);
      message.textContent = '检查点已恢复。';
      renderCurrent(view);
    } catch (error) {
      message.textContent = errorText(error, '检查点无法恢复；当前状态保持不变。');
    }
  });
  officeButton.addEventListener('click', () => {
    try {
      if (onEnterOffice?.()) {
        message.textContent = '已通过正常流程进入夏莱办公室。';
        refresh();
      }
      else message.textContent = '当前无法进入夏莱办公室，请检查世界线状态。';
    } catch (error) {
      message.textContent = errorText(error, '当前无法进入夏莱办公室。');
    }
  });

  function renderCurrent(view: VariantTrainingView): void {
    summary.textContent = `${view.displayName} · ${view.owned ? '当前已持有' : '当前未持有'}`;
    source.disabled = false;
    previewButton.disabled = false;
    startButton.textContent = view.phase === 'preparation' ? '确认并开始' : '重新开始演练';
    commitButton.disabled = view.phase !== 'battle';
    saveButton.disabled = view.phase !== 'battle';
    clearPreview();
    battleRegion.hidden = view.phase !== 'battle';
    resultRegion.hidden = view.phase !== 'result';
    if (view.phase === 'battle') renderBattle(view);
    if (view.phase === 'result') renderResult(view);
  }

  function renderBattle(view: VariantTrainingView): void {
    const order = view.lastRound?.order.map(row =>
      `${row.side === 'party' ? view.displayName : '训练靶'} 敏捷${row.agility}${row.skipped ? '（未行动）' : ''}`,
    ).join(' → ') ?? '尚无已提交回合';
    const member = view.translation?.members[0];
    const source = member ? sourceSummary(member, sourceLabel(member, view.sources)) : '无入场快照';
    battleContent.textContent = `${source}。${view.displayName} HP ${view.partyHp ?? '—'}/${view.partyMaxHp ?? '—'}　训练靶 HP ${view.enemyHp ?? '—'}/${view.enemyMaxHp}　回合 ${view.round}　已提交 ${view.commitVersion} 次。上一轮顺序：${order}`;
    commitButton.disabled = false;
  }

  function renderResult(view: VariantTrainingView): void {
    const outcome = view.outcome === 'success' ? '成功' : '失败';
    const snapshot = view.translation?.members[0];
    resultContent.textContent = `${view.displayName}：${outcome}。最终 HP ${view.partyHp ?? '—'}/${view.partyMaxHp ?? '—'}；训练靶 HP ${view.enemyHp ?? '—'}/${view.enemyMaxHp}。入场快照：${snapshot ? summarizeBuild(snapshot, sourceLabel(snapshot, view.sources)) : '无快照。'}`;
    commitButton.disabled = true;
  }

  function renderMemberPreview(member: TranslatedVariantMember | undefined, view: VariantTrainingView): HTMLElement {
    const paragraph = document.createElement('p');
    paragraph.textContent = member ? summarizeBuild(member, view.sources.find(entry => entry.id === source.value)?.label) : '来源预览没有成员数据。';
    return paragraph;
  }

  refresh();
  return refresh;
}

function summarizeBuild(member: TranslatedVariantMember, sourceLabel?: string): string {
  const source = sourceSummary(member, sourceLabel);
  const raw = member.input.attributes.map(row => `${trainingLabel(row.id)} ${row.value}`).join('、') || '无原始属性';
  const grades = member.build.grades.map(row => `${trainingLabel(row.attributeId)} ${row.rawValue}→${trainingGradeLabel(row.gradeId)}`).join('；') || '无阶级映射';
  const { maxHp, baseAgility, maxAgility } = member.build.parameters;
  return `${source}。原始值：${raw}。转译阶级：${grades}。结果：HP ${maxHp}，敏捷 ${baseAgility}/${maxAgility}。`;
}

function sourceSummary(member: TranslatedVariantMember, sourceLabel?: string): string {
  const sourceRevision = member.source.kind === 'owned'
    ? `档案版本 r${member.profile?.revision ?? '未知'}`
    : `切片版本 r${member.source.slice.revision}`;
  return `来源：${sourceLabel ?? semanticSourceLabel(member)}（${sourceRevision}）`;
}

function sourceLabel(
  member: TranslatedVariantMember,
  sources: VariantTrainingView['sources'],
): string | undefined {
  const sourceId: VariantTrainingSource = member.source.kind === 'owned'
    ? 'owned'
    : member.source.slice.id.endsWith(':enhanced') ? 'enhanced' : 'normal';
  const entry = sources.find(candidate => candidate.id === sourceId);
  const semantic = sourceId === 'owned' ? '战备' : sourceId === 'enhanced' ? '强化' : '普通';
  return entry ? `${semantic} · ${entry.label}` : semantic;
}

function semanticSourceLabel(member: TranslatedVariantMember): string {
  if (member.source.kind === 'owned') return '战备';
  return member.source.slice.id.endsWith(':enhanced') ? '强化' : '普通';
}

function trainingLabel(id: string): string {
  return id === 'readiness' ? '战备值' : id;
}

function trainingGradeLabel(id: string): string {
  if (id === 'normal') return '普通';
  if (id === 'enhanced') return '强化';
  return id;
}

function previewIssueText(issue: VariantTranslationIssue): string {
  if (issue.code === 'variant-not-owned') return '当前未持有该角色，可先选择普通或强化切片。';
  if (issue.code === 'input-invalid' && issue.path.includes('activeInit')) return '请先通过正常流程进入夏莱办公室。';
  return issue.message;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
