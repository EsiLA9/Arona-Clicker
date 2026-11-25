// @vitest-environment happy-dom
import { setImmediate } from 'node:timers/promises';
import { storyEntryType } from '../../../src/data-services/contracts/story-entry';
import { createStoryForTest } from './story-editor-test-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { defaultDatapack } from '../../../src/arona-clicker/content';
import { AronaClickerRuntime } from '../../../src/arona-clicker/runtime/runtime';
import { UIController } from '../../../src/ui/controller/controller';
import { currentDraft, renameStoryNodeId, type StoryEditorState } from '../../../src/ui/story-editor/model';
import { editProperty, rowIdAt } from '../../../src/ui/story-editor/property-model';
import { StoryDraftPersistence, STORY_EDITOR_STORAGE_KEY } from '../../../src/ui/story-editor/persistence';
import '../../../src/ui/runtime/service-definitions';

type Path = readonly (string | number)[];
type Obj = Record<string, unknown>;
const json = (path: Path): string => JSON.stringify(path);

describe('Story Editor property panel', () => {
  let game: GameInstance;
  let ctrl: UIController;
  let root: HTMLElement;

  const draft = () => currentDraft(ctrl.storyEditor.state)!;
  const node = (index = 0) => draft().document.nodes[index] as unknown as Obj;
  const q = <T extends HTMLElement>(selector: string): T => {
    const found = root.querySelector<T>(selector);
    expect(found, selector).not.toBeNull();
    return found!;
  };
  const click = (action: string): void => { if(action==='new') createStoryForTest(game,ctrl); else q<HTMLButtonElement>(`[data-editor-action="${action}"]`).click(); if(action==='new'){const current=currentDraft(ctrl.storyEditor.state);if(current&&!current.document.startContext){current.document={...current.document,startContext:{type:'area',areaId:[...game.registry.areas.keys()][0]??''}};current.dirty=true;ctrl.storyEditor.requestRefresh();}} ctrl.flushUIUpdates(); };
  const composer = (selector: string, value: string): void => {
    const field = q<HTMLInputElement | HTMLTextAreaElement>(selector);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    ctrl.flushUIUpdates();
  };
  /** Find a rendered property control by its node-relative JSON path. */
  const property = <T extends HTMLElement = HTMLInputElement>(path: Path): T => {
    const key = json(path);
    const found = [...root.querySelectorAll<HTMLElement>('[data-story-property-path]')].find(item => item.dataset.storyPropertyPath === key);
    expect(found, `property ${key}`).toBeTruthy();
    return found as T;
  };
  const hasProperty = (path: Path): boolean => {
    const key = json(path);
    return [...root.querySelectorAll<HTMLElement>('[data-story-property-path]')].some(item => item.dataset.storyPropertyPath === key);
  };
  const setProperty = (path: Path, value: string): void => {
    const field = property<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(path);
    field.value = value;
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    ctrl.flushUIUpdates();
  };
  const selectBranch = (path: Path, field: string, value: string): void => {
    const key = json(path);
    const found = [...root.querySelectorAll<HTMLSelectElement>('[data-story-branch-path]')]
      .find(item => item.dataset.storyBranchPath === key && item.dataset.storyBranchField === field);
    expect(found, `branch ${key}.${field}`).toBeTruthy();
    found!.value = value;
    found!.dispatchEvent(new Event('change', { bubbles: true }));
    ctrl.flushUIUpdates();
  };
  const selectThemeScope = (path: Path, value: string): void => {
    const key = json(path);
    const found = [...root.querySelectorAll<HTMLSelectElement>('[data-story-theme-scope-path]')].find(item => item.dataset.storyThemeScopePath === key);
    expect(found, `theme scope ${key}`).toBeTruthy();
    found!.value = value;
    found!.dispatchEvent(new Event('change', { bubbles: true }));
    ctrl.flushUIUpdates();
  };
  const toggleOptional = (path: Path, checked = true): void => {
    const key = json(path);
    const found = [...root.querySelectorAll<HTMLInputElement>('input[data-story-optional-path]')].find(item => item.dataset.storyOptionalPath === key);
    expect(found, `optional ${key}`).toBeTruthy();
    found!.checked = checked;
    found!.dispatchEvent(new Event('change', { bubbles: true }));
    ctrl.flushUIUpdates();
  };
  const rowAction = (action: string, path: Path, index = 0): void => {
    const key = json(path);
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-story-row-action]')]
      .filter(item => item.dataset.storyRowAction === action && item.dataset.storyRowPath === key);
    expect(buttons[index], `${action} ${key}`).toBeTruthy();
    buttons[index].click();
    ctrl.flushUIUpdates();
  };
  const open = (): void => { ctrl.render(); q<HTMLButtonElement>('#story-editor-launch').click(); ctrl.flushUIUpdates(); };
  const submit = (): void => { click('save-to-runtime'); };
  const stored = (): Obj => game.registry.stories.get(draft().document.id) as unknown as Obj;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    game = new GameInstance();
    game.init([baseDatapack]);
    ctrl = new UIController(game, root);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    ctrl.modal.close();
    ctrl.destroy();
    game.dispose();
    localStorage.clear();
    // Happy DOM's query WeakRefs can keep detached trees alive until the next turn.
    await setImmediate();
  });

  it('keeps one transfer target when switching modes, replacing the target or clearing it', () => {
    open(); click('new'); click('transfer');
    const mode = ['transfer', 'mode'];
    const target = ['transfer', 'storyId'];
    const first = [...game.registry.stories.keys()][0];
    const second = draft().document.id;
    const targetInput = property<HTMLSelectElement>(target);
    setProperty(target, first);
    setProperty(mode, 'goto');
    setProperty(mode, 'insert');
    expect(property<HTMLSelectElement>(target)).toBe(targetInput);
    expect(node().transfer).toEqual({ mode: 'insert', storyId: first });
    setProperty(target, second);
    setProperty(mode, 'goto');
    expect(node().transfer).toEqual({ mode: 'goto', storyId: second });
    expect(q<HTMLButtonElement>('.story-editor-right .story-editor-property-content [data-editor-story-target]').dataset.editorStoryTarget).toBe(second);
    setProperty(target, '');
    setProperty(mode, 'insert');
    expect(node().transfer).toEqual({ mode: 'insert' });
    expect(targetInput.value).toBe('');
    expect(root.querySelector('.story-editor-right .story-editor-property-content [data-editor-story-target]')).toBeNull();
  });

  it('keeps talk-only speaker, image and pacing asleep under narration and restores them on the way back', () => {
    open(); click('new');
    composer('[data-editor-composer-text]', '原始旁白'); click('send');
    const pic = [...game.registry.pics.keys()][0];
    expect(pic).toBeTruthy();

    selectBranch(['content'], 'kind', 'talk');
    expect(node()).toMatchObject({ type: 'talklet', content: { kind: 'talk' } });
    setProperty(['content', 'displayName'], '自定义发出方');
    setProperty(['content', 'image'], pic);
    setProperty(['performance', 'pacing', 'typing'], '2');
    expect((node().performance as Obj).pacing).toEqual({ typing: '2' });
    expect(root.textContent).toContain('0 表示关闭');

    click('save');
    expect(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)).toContain('typing');

    selectBranch(['content'], 'kind', 'narration');
    expect(node().content).toEqual({ kind: 'narration', text: '原始旁白' });
    expect((node().performance as Obj).pacing).toEqual({ typing: '2' });
    submit();
    expect((stored().nodes as Obj[])[0]).not.toHaveProperty('performance');
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0]).toMatchObject({ content: { kind: 'narration', text: '原始旁白' } });
    expect(((stored().nodes as Obj[])[0].content as Obj)).not.toHaveProperty('speaker');
    expect(((stored().nodes as Obj[])[0].content as Obj)).not.toHaveProperty('displayName');

    selectBranch(['content'], 'kind', 'talk');
    expect(node().content).toMatchObject({ displayName: '自定义发出方', image: pic });
    expect((node().performance as Obj).pacing).toEqual({ typing: '2' });
  });

  it('shows presentation fields without enabling a group, supports defaults and keeps live controls', () => {
    open(); click('new');
    composer('[data-editor-composer-text]', '旁白'); click('send');
    expect(node()).not.toHaveProperty('presentation');
    q('[data-column-action="story-editor-designer:appearance"]').click(); ctrl.flushUIUpdates();
    const section = q<HTMLElement>('.story-editor-presentation');
    expect(section.querySelector('h3')?.textContent).toBe('呈现');
    expect(section.closest('.story-editor-optional')).toBeNull();
    expect(section.querySelector('.story-editor-property-group, .story-editor-optional-content')).toBeNull();
    for (const [name, title] of [['side', '气泡位置'], ['align', '文字对齐'], ['avatarMode', '头像显示'], ['avatar', '头像引用']]) {
      const label = property(['appearance', 'presentation', name]).closest('label')!;
      expect(label.parentElement === section).toBe(true);
      expect(label.textContent).toContain(title);
      expect(label.querySelector('.story-editor-hint')?.textContent).toBeTruthy();
    }

    const body = q<HTMLElement>('.story-editor-right .workspace-column__body');
    body.scrollTop = 87;
    const avatar = property<HTMLInputElement>(['appearance', 'presentation', 'avatar']);
    avatar.focus(); avatar.value = 'portrait'; avatar.setSelectionRange(4, 4);
    avatar.dispatchEvent(new Event('input', { bubbles: true })); ctrl.flushUIUpdates();
    expect(property(['appearance', 'presentation', 'avatar']) === avatar).toBe(true);
    expect(document.activeElement === avatar).toBe(true);
    expect(avatar.selectionStart).toBe(4);
    setProperty(['appearance', 'presentation', 'avatarMode'], 'hide');
    expect((node().appearance as Obj).presentation).toEqual({ avatar: 'portrait', avatarMode: 'hide' });
    const mode = property<HTMLSelectElement>(['appearance', 'presentation', 'avatarMode']);
    expect([...mode.options].some(option => option.value === '' && option.textContent === '沿用默认')).toBe(true);
    setProperty(['appearance', 'presentation', 'avatarMode'], '');
    expect((node().appearance as Obj).presentation).toEqual({ avatar: 'portrait' });
    expect(property(['appearance', 'presentation', 'avatar']) === avatar).toBe(true);
    expect(body.scrollTop).toBe(87);
  });

  it('switches button, choice and entry card without leaking fields, inventing a stage advance or losing the draft on reload', () => {
    open(); click('new'); click('click');
    const stageId = node().stageId as string;
    expect(draft().document.stages[stageId].advance).toBe('input');
    expect(q<HTMLElement>('[data-story-body-node]').closest('.story-editor-property-group')).toBeNull();
    setProperty(['interaction', 'text'], '继续调查');

    selectBranch(['interaction'], 'kind', 'choice');
    expect(node().interaction).toEqual({ kind: 'choice', options: [{ id: 'option1', text: '继续调查' }] });
    const option = ((node().interaction as Obj).options as Obj[])[0];
    expect(root.querySelector('[data-story-body-node]')).toBeNull();
    const choiceNodeId=String(node().id);
    const optionText=property<HTMLTextAreaElement>(['interaction','options',0,'text']);
    const optionRow=root.querySelector<HTMLElement>('[data-editor-key^="choice:"]')!;
    const flowNode=q<HTMLElement>(`[data-editor-node="${choiceNodeId}"]`);
    optionText.focus();optionText.value='去左边';optionText.dispatchEvent(new Event('input',{bubbles:true}));ctrl.flushUIUpdates();
    expect(property(['interaction','options',0,'text'])).toBe(optionText);
    expect(globalThis.document.activeElement).toBe(optionText);
    expect(root.querySelector('[data-editor-key^="choice:"]')).toBe(optionRow);
    expect(q<HTMLElement>(`[data-editor-node="${choiceNodeId}"]`)).toBe(flowNode);
    expect(root.textContent).toContain('选项（按顺序）');

    selectBranch(['interaction'], 'kind', 'button');
    expect((node().interaction as Obj).text).toBe('继续调查');
    selectBranch(['interaction'], 'kind', 'choice');
    expect((node().interaction as Obj).options).toEqual([{ id: option.id, text: '去左边' }]);

    selectBranch(['interaction'], 'kind', 'entryCard');
    expect(node().interaction).toEqual({ kind: 'entryCard', card: { buttonText: '继续调查', request: { entryType: 'active', intent: 'card', owner: null } } });
    const entry = [...game.registry.storyEntries].find(([, item]) => storyEntryType(item) === 'active')!;
    expect(entry).toBeTruthy();
    setProperty(['interaction', 'card', 'request', 'entryId'], entry[0]);

    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0]).toMatchObject({
      stageId, interaction: { kind: 'entryCard', card: { buttonText: '继续调查', request: { entryId: entry[0], entryType: 'active', intent: 'card', owner: null } } },
    });
    expect(draft().document.stages[stageId].advance).toBe('input');

    click('save');
    const document = structuredClone(draft().document);
    ctrl.destroy();
    ctrl = new UIController(game, root);
    ctrl.storyEditor.open();
    expect(currentDraft(ctrl.storyEditor.state)?.document).toEqual(document);
    q('[data-editor-node]').click(); ctrl.flushUIUpdates();
    expect(property(['interaction', 'card', 'request', 'entryId'])).toBeTruthy();
  });

  it('diagnoses legacy Choice fields, preserves the draft, and requires explicit cleanup before Runtime save', () => {
    open(); click('new'); click('click');
    const clickNode=node();
    clickNode.interaction={kind:'choice',sharedActions:[{kind:'travel',areaId:'base:area:schale_main'},{kind:'localFlag',op:'set',name:'kept',value:true}],options:[{id:'legacy',text:'旧选项',condition:{target:'alwaysTrue',comparator:'==',value:1},result:{actions:[{kind:'state',effects:[{op:'setFlag',flagId:'legacy',value:true}]}],transfer:{mode:'goto',storyId:'legacy:target'}}}]};
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(root.textContent).toContain('旧 Choice sharedActions');
    expect(root.textContent).toContain('旧 Choice condition（禁用语义，不等同于 showWhen）');
    expect(root.textContent).toContain('旧 Choice result（不再执行）');
    expect(root.textContent).toContain('legacy:target');
    expect(hasProperty(['interaction','options',0,'condition','target'])).toBe(false);
    expect(hasProperty(['interaction','sharedActions',1,'name'])).toBe(false);
    expect(hasProperty(['interaction','options',0,'result','actions',0,'op'])).toBe(false);
    click('save');
    const saved=structuredClone(draft().document);
    expect(JSON.stringify(saved)).toContain('sharedActions');
    expect(JSON.stringify(saved)).toContain('condition');
    expect(JSON.stringify(saved)).toContain('result');
    const beforeRuntime=game.registry.stories.get(draft().document.id);
    submit();
    expect(ctrl.storyEditor.state.error).toContain('旧 Choice sharedActions 不支持');
    expect(game.registry.stories.get(draft().document.id)).toBe(beforeRuntime);
    const remove = (path: Path): void => {
      const button=[...root.querySelectorAll<HTMLButtonElement>('[data-story-remove-readonly]')].find(item=>item.dataset.storyOptionalPath===json(path));
      expect(button,json(path)).toBeTruthy();button!.click();ctrl.flushUIUpdates();
    };
    remove(['interaction','sharedActions']);
    remove(['interaction','options',0,'condition']);
    remove(['interaction','options',0,'result']);
    expect(node().interaction).toEqual({kind:'choice',options:[{id:'legacy',text:'旧选项'}]});
    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0].interaction).toEqual({kind:'choice',options:[{id:'legacy',text:'旧选项'}]});
    ctrl.destroy();ctrl=new UIController(game,root);ctrl.storyEditor.open();
    expect(currentDraft(ctrl.storyEditor.state)?.document).toMatchObject({nodes:[{interaction:{kind:'choice',options:[{id:'legacy',text:'旧选项'}]}}]});
  });

  it('edits Choice declarations and exposes only press work on plain Buttons', () => {
    open();click('new');click('click');selectBranch(['interaction'],'kind','choice');
    const addShowWhen=[...root.querySelectorAll<HTMLButtonElement>('[data-story-init-condition]')].find(button=>button.dataset.storyPath===json(['interaction','options',0,'showWhen']));
    expect(addShowWhen).toBeTruthy();addShowWhen!.click();ctrl.flushUIUpdates();
    setProperty(['interaction','options',0,'requiresFlag'],'available');
    rowAction('add',['interaction','options',0,'marks']);
    setProperty(['interaction','options',0,'marks',0],'selected');
    expect(node().interaction).toMatchObject({kind:'choice',options:[{showWhen:{type:'AND',conditions:[]},requiresFlag:'available',marks:['selected']} ]});
    expect(hasProperty(['interaction','options',0,'showWhen','type'])).toBe(false);
    expect(q('[data-choice-condition]').parentElement?.textContent).toContain('全部满足 · 0 项');
    const editCondition = () => {
      q<HTMLButtonElement>('[data-choice-condition]').click();
      const relation = document.querySelector<HTMLSelectElement>('.app-modal [data-condition-field="operator"]')!;
      expect(relation.value).toBe('AND');
      relation.value = 'OR'; relation.dispatchEvent(new Event('change', { bubbles: true }));
    };
    editCondition();
    document.querySelector<HTMLButtonElement>('.app-modal .modal-foot .modal-close')!.click();
    expect(node().interaction).toMatchObject({options:[{showWhen:{type:'AND'}}]});
    editCondition();
    document.querySelector<HTMLButtonElement>('[data-modal-action="apply-condition-tree"]')!.click();
    ctrl.flushUIUpdates();
    expect(node().interaction).toMatchObject({options:[{showWhen:{type:'OR',conditions:[]}}]});
    expect(hasProperty(['interaction','options',0,'condition','type'])).toBe(false);
    expect(root.textContent).toContain('选择标记用于关联后续节点');
    expect(root.textContent).not.toContain('选择结果');
    expect(root.textContent).not.toContain('行为类型');
    expect(hasProperty(['interaction','options',0,'result'])).toBe(false);

    click('new');click('click');
    expect([...root.querySelectorAll<HTMLElement>('[data-story-init-object]')].some(item=>item.dataset.storyPath===json(['interaction','result']))).toBe(false);
    expect(root.textContent).not.toContain('配置结果');
    expect(node().interaction).not.toHaveProperty('result');

  });

  it.each([null, [], {actions:[{kind:'localFlag',op:'set',name:'legacy',value:true}],transfer:{mode:'goto',storyId:'missing:story:target'}}])('retains retired Button result diagnostics without executing or publishing them (%j)', result => {
    open();click('new');click('click');
    node().interaction={kind:'button',text:'继续',result};
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(root.textContent).toContain('旧按钮 result（不再执行，请改用后续节点）');
    expect(root.textContent).toContain(JSON.stringify(result));
    expect(hasProperty(['interaction','result','actions',0,'name'])).toBe(false);
    click('save');
    expect(JSON.parse(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)!).drafts[0].document.nodes[0].interaction.result).toEqual(result);
    submit(); expect(ctrl.storyEditor.state.error).toContain('旧按钮 result 不再执行');
    const remove=[...root.querySelectorAll<HTMLButtonElement>('[data-story-remove-readonly]')].find(item=>item.dataset.storyOptionalPath===json(['interaction','result']))!;
    remove.click();ctrl.flushUIUpdates();
    expect(node().interaction).not.toHaveProperty('result');
    submit();expect(ctrl.storyEditor.state.error).toBeNull();
  });

  it('shows malformed legacy Choice values verbatim and does not recreate result controls', () => {
    open();click('new');click('click');
    node().interaction={kind:'choice',options:[{id:'null',text:'null result',result:null},{id:'actions',text:'bad result',result:{actions:'legacy raw value'}},{id:'array',text:'array result',result:[]},{id:'disabled',text:'disabled',condition:{target:'alwaysTrue',comparator:'==',value:1}}]} as unknown as Obj;
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(root.textContent).toContain('旧 Choice result（不再执行）');
    expect(root.textContent).toContain('旧 Choice condition（禁用语义，不等同于 showWhen）');
    expect(root.textContent).toContain('legacy raw value');
    expect(root.textContent).toContain('[]');
    expect(root.querySelectorAll('[data-story-remove-readonly]').length).toBeGreaterThanOrEqual(4);
    expect(hasProperty(['interaction','options',1,'result','actions'])).toBe(false);
    submit();expect(ctrl.storyEditor.state.error).toContain('旧 Choice result 不再执行');
  });

  it('keeps p6 focused on option services, preserves its bindings and flag fields through keyed updates', () => {
    game.init([defaultDatapack]);open();
    const id='base:story:schale_welcome';
    const story=root.querySelector<HTMLButtonElement>(`[data-editor-story="source:${id}"]`);
    expect(story).toBeTruthy();story!.click();ctrl.flushUIUpdates();
    const draft=currentDraft(ctrl.storyEditor.state)!;
    const choice=draft.document.nodes.find(item=>item.id==='p6-choice');
    expect(choice?.type).toBe('click');
    if(choice?.type!=='click'||choice.interaction.kind!=='choice')return;
    expect(choice.interaction.options).toHaveLength(2);
    expect(choice.interaction).not.toHaveProperty('sharedActions');
    expect(choice.interaction.options.every(option=>option.marks?.length)).toBe(true);
    const flag = choice.interaction.options[0].marks![0];
    editProperty(draft, choice.id, ['interaction', 'options', 0, 'requiresFlag'], 'choice-visibility');
    editProperty(draft, choice.id, ['interaction', 'options', 0, 'marks'], [flag, flag, 'unused-flag']);
    draft.document.nodes.push({ id: 'second-flag-reader', type: 'operation', requiresFlag: flag });
    const flowNode=q<HTMLElement>('[data-editor-node="p6-choice"]');flowNode.click();ctrl.flushUIUpdates();
    const fields=q<HTMLElement>('[data-story-node-properties="p6-choice"]');
    expect(fields.textContent).not.toContain('局部标记（按顺序）');
    expect(fields.textContent).not.toContain('选择结果');
    expect(fields.textContent).not.toContain('执行影响');
    expect([...fields.querySelectorAll<HTMLElement>('[data-story-property-path]')].some(field=>field.dataset.storyPropertyPath===json(['interaction','options',0,'result']))).toBe(false);
    const mark=property<HTMLInputElement>(['interaction','options',0,'marks',0]);
    expect(mark.value).toBe(choice.interaction.options[0].marks![0]);
    expect(mark.closest('.story-editor-flag-control')?.querySelector('[data-local-flag-navi]')).toBeTruthy();
    const choiceRow = q('[data-story-drop-target="choice-flag"][data-story-choice-node="p6-choice"][data-story-option-index="0"]');
    const [need, markFlags] = [choiceRow.firstElementChild, choiceRow.lastElementChild];
    expect(need?.textContent).toBe('choice-visibility');
    expect(need?.nextElementSibling?.classList.contains('choice-option')).toBe(true);
    const marks = [...markFlags!.querySelectorAll<HTMLButtonElement>('.story-editor-flow-flag')];
    expect(marks.map(button => [button.textContent, button.title])).toEqual([[flag, flag], ['unused-flag', 'unused-flag']]);
    const center = q('.story-editor-center .workspace-column__body'); center.scrollTop = 80;
    const flagRow = () => q<HTMLDetailsElement>(`.story-editor-flag-item[data-story-flag-name="${flag}"]`);
    marks[0].click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.storyInspectorTab).toBe('flags');
    expect(ctrl.storyEditor.state.selectedNodeId).toBe('p6-choice');
    expect(flagRow().open).toBe(true);
    expect(center.scrollTop).toBe(80);
    flowNode.click(); ctrl.flushUIUpdates();
    const unbind = q<HTMLButtonElement>('[data-story-choice-flag-unbind][data-story-node-id="second-flag-reader"]');
    expect(unbind.title).toContain('共用该标记');
    const optionText=property<HTMLTextAreaElement>(['interaction','options',0,'text']);
    const optionRow=root.querySelector<HTMLElement>('[data-editor-key^="choice:"]');
    optionText.focus();optionText.value=`${optionText.value}!`;optionText.dispatchEvent(new Event('input',{bubbles:true}));ctrl.flushUIUpdates();
    expect(property(['interaction','options',0,'text'])).toBe(optionText);
    expect(root.querySelector('[data-editor-key^="choice:"]')).toBe(optionRow);
    expect(root.querySelector('[data-editor-node="p6-choice"]')).toBe(flowNode);
    unbind.click(); ctrl.flushUIUpdates();
    expect(draft.document.nodes.find(item=>item.id==='second-flag-reader')?.requiresFlag).toBeUndefined();
    const branchNode=draft.document.nodes.find(item=>item.id==='p6-option1-op');
    expect(branchNode?.requiresFlag).toBe(choice.interaction.options[0].marks![0]);

    const record = q<HTMLButtonElement>('[data-editor-node="p6-option1-op"] .story-editor-flag-reader-record');
    const reader = q('[data-editor-node="second-flag-reader"]');
    expect(record.textContent).toBe(flag);
    expect(record.title).toBe(flag);
    expect(record.classList.contains('story-editor-target-card')).toBe(true);
    record.click(); ctrl.flushUIUpdates();
    expect(flagRow().open).toBe(true);
    expect(center.scrollTop).toBe(80);
    const drag = (source: HTMLElement, target: HTMLElement, status: string, commit: boolean) => {
      const values = new Map<string, string>();
      const data = { setData: (key: string, value: string) => values.set(key, value), getData: (key: string) => values.get(key), get types() { return [...values.keys()]; } };
      const dispatch = (element: HTMLElement, type: string) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: data });
        element.dispatchEvent(event);
      };
      dispatch(source, 'dragstart');
      dispatch(target, 'dragover');
      expect(target.dataset.storyFlagDropStatus).toBe(status);
      if (commit) dispatch(target, 'drop');
      dispatch(source, 'dragend');
      ctrl.flushUIUpdates();
      expect(target.dataset.storyFlagDropStatus).toBeUndefined();
    };
    drag(marks[0], reader, '可绑定', true);
    expect(draft.document.nodes.find(item=>item.id==='second-flag-reader')?.requiresFlag).toBe(flag);
    drag(reader, record, '已绑定', false);
    drag(record, q('[data-editor-node="p6-option2-op"]'), '不可绑定', false);
  });

  it('edits state effects, coerces numeric text, reorders rows by identity and keeps travel fields separate', () => {
    open(); click('new'); click('operation');
    selectBranch(['action'], 'kind', 'state');
    expect(node().action).toEqual({ kind: 'state' });

    const item = [...game.registry.items.keys()][0];
    const spot = [...game.registry.spots.keys()][0];
    const area = [...game.registry.areas.keys()][0];
    expect(item && spot && area).toBeTruthy();
    rowAction('add', ['action', 'effects']);
    selectBranch(['action', 'effects', 0], 'op', 'addItem');
    setProperty(['action', 'effects', 0, 'itemId'], item);
    setProperty(['action', 'effects', 0, 'amount'], '3');
    expect(((node().action as Obj).effects as Obj[])[0]).toMatchObject({ op: 'addItem', itemId: item, amount: '3' });

    rowAction('add', ['action', 'effects']);
    selectBranch(['action', 'effects', 1], 'op', 'setSpotLevel');
    setProperty(['action', 'effects', 1, 'spotId'], spot);
    setProperty(['action', 'effects', 1, 'amount'], '5');
    expect(((node().action as Obj).effects as Obj[])[1]).toMatchObject({ op: 'setSpotLevel', spotId: spot, amount: '5' });

    rowAction('up', ['action', 'effects'], 1);
    expect(((node().action as Obj).effects as Obj[]).map(row => row.op)).toEqual(['setSpotLevel', 'addItem']);
    expect((((node().action as Obj).effects as Obj[])[0])).toMatchObject({ spotId: spot, amount: '5' });

    click('operation');
    selectBranch(['action'], 'kind', 'travel');
    setProperty(['action', 'areaId'], area);
    setProperty(['action', 'notice'], 'false');
    expect(node(1).action).toMatchObject({ notice: false });
    setProperty(['action', 'notice'], '');
    expect(node(1).action).toEqual({ kind: 'travel', areaId: area });

    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect(((stored().nodes as Obj[])[0].action as Obj).effects).toEqual([
      { op: 'setSpotLevel', spotId: spot, amount: 5 },
      { op: 'addItem', itemId: item, amount: 3 },
    ]);
    expect((stored().nodes as Obj[])[1].action).toEqual({ kind: 'travel', areaId: area });
  });

  it('uses one value type control when switching a persistent Flag between a literal and an expression', () => {
    open(); click('new'); click('operation');
    selectBranch(['action'], 'kind', 'state');
    rowAction('add', ['action', 'effects']);
    const effect = ['action', 'effects', 0];
    const value = [...effect, 'value'];
    selectBranch(effect, 'op', 'setFlag');
    const switchKind = (kind: string) => {
      const field = q<HTMLSelectElement>('[data-story-literal-kind-path]');
      field.value = kind;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      ctrl.flushUIUpdates();
    };
    switchKind('number');
    setProperty(value, '5');
    expect(root.querySelectorAll(`[data-value-path='${json(value)}']`)).toHaveLength(0);
    switchKind('const');
    expect(node().action).toMatchObject({ effects: [{ value: { type: 'const', value: 0 } }] });
    expect(root.querySelectorAll(`[data-value-type][data-value-path='${json(value)}']`)).toHaveLength(0);
    expect(hasProperty(value)).toBe(false);
    switchKind('boolean');
    setProperty(value, 'true');
    expect(node().action).toMatchObject({ effects: [{ value: true }] });
  });

  it('authors map collection and scoped information grants with catalog-backed targets', () => {
    const mapId = 'test:area-map:story-editor';
    game.registry.applyAreaMapMutation({ operation: 'create', ownerModName: 'test', areaMap: {
      id: mapId, name: '编辑器地图', nodes: [{ id: 'landmark', name: '地标', position: { x: 0, y: 0 } }], edges: [],
    } });
    const map = game.registry.areaMaps.get(mapId)!;
    const mapNode = map.nodes[0]!;
    open(); click('new'); click('operation');
    selectBranch(['action'], 'kind', 'state');
    rowAction('add', ['action', 'effects']);
    selectBranch(['action', 'effects', 0], 'op', 'acquireAreaMap');
    setProperty(['action', 'effects', 0, 'mapId'], map.id);
    rowAction('add', ['action', 'effects']);
    selectBranch(['action', 'effects', 1], 'op', 'revealInformation');
    selectBranch(['action', 'effects', 1, 'target'], 'entityKind', 'areaMapNode');
    setProperty(['action', 'effects', 1, 'target', 'mapId'], map.id);
    setProperty(['action', 'effects', 1, 'target', 'nodeId'], mapNode.id);
    setProperty(['action', 'effects', 1, 'target', 'target'], 'utility');

    expect(((node().action as Obj).effects as Obj[])).toEqual([
      { op: 'acquireAreaMap', mapId: map.id },
      { op: 'revealInformation', target: { entityKind: 'areaMapNode', mapId: map.id, nodeId: mapNode.id, target: 'utility' } },
    ]);
  });

  it('switches theme scope without leaking entity keys and gates presentation options on a chosen target', () => {
    // The product datapack is the one that carries entity presentation definitions.
    ctrl.destroy();
    game.stop();
    game = new GameInstance();
    game.init([defaultDatapack]);
    ctrl = new UIController(game, root);
    open(); click('new'); click('operation');
    selectBranch(['action'], 'kind', 'presentation');
    selectBranch(['action', 'command'], 'command', 'theme');

    const area = [...game.registry.areas.keys()][0];
    const colorGroup = [...game.registry.colorGroups.keys()][0];
    expect(area && colorGroup).toBeTruthy();
    const theme = () => ((node().action as Obj).command as Obj).value as Obj;

    selectThemeScope(['action', 'command', 'value'], 'area');
    setProperty(['action', 'command', 'value', 'entityKey'], `area:${area}`);
    setProperty(['action', 'command', 'value', 'colorGroupId'], colorGroup);
    expect(theme()).toEqual({ scope: 'area', entityKey: `area:${area}`, colorGroupId: colorGroup });

    selectThemeScope(['action', 'command', 'value'], 'ephemeral');
    expect(theme()).toEqual({ scope: 'ephemeral', colorGroupId: colorGroup });
    selectThemeScope(['action', 'command', 'value'], 'student');
    expect(theme()).toEqual({ scope: 'student', colorGroupId: colorGroup });
    selectThemeScope(['action', 'command', 'value'], 'area');
    expect(theme()).toEqual({ scope: 'area', entityKey: `area:${area}`, colorGroupId: colorGroup });

    selectBranch(['action', 'command'], 'command', 'setEntityPresentation');
    expect(root.textContent).toContain('先选择表现目标');
    expect(hasProperty(['action', 'command', 'optionId'])).toBe(false);
    const targets = [...property<HTMLSelectElement>(['action', 'command', 'target']).options].filter(option => option.value);
    expect(targets.length).toBeGreaterThan(0);
    setProperty(['action', 'command', 'target'], targets[0].value);
    expect(property(['action', 'command', 'optionId'])).toBeTruthy();

    selectBranch(['action', 'command'], 'command', 'clearEntityPresentation');
    // Each command branch keeps its own cache, so clear starts without the set-command target.
    expect((node().action as Obj).command).toEqual({ command: 'clearEntityPresentation' });
    setProperty(['action', 'command', 'target'], targets[0].value);
    expect((node().action as Obj).command).toEqual({ command: 'clearEntityPresentation', target: targets[0].value });
    expect((node().action as Obj).command).not.toHaveProperty('optionId');
    expect((node().action as Obj).command).not.toHaveProperty('lifetime');
  });

  it('edits theme values through semantic fields and keeps defaults as inherited values', () => {
    open(); click('new'); click('operation');
    const node=currentDraft(ctrl.storyEditor.state)!.document.nodes[0]!;
    const colorGroup=[...game.registry.colorGroups.values()][0]!;
    editProperty(draft(),node.id,['action'],{kind:'presentation',command:{command:'theme',value:{colorGroupId:colorGroup.id}}});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(root.textContent).toContain('有序色板（最多六色）');
    expect(root.textContent).toContain('主色');
    expect(root.textContent).toContain('语义颜色');
    expect(root.textContent).toContain('背景图层');
    const add=[...root.querySelectorAll<HTMLButtonElement>('[data-story-theme-add]')].find(button=>button.dataset.storyThemeAdd===json(['action','command','value','tokens','primary']))!;
    expect(add).toBeTruthy();add.click();ctrl.flushUIUpdates();
    const theme=((((node as unknown as Obj).action as Obj).command as Obj).value as Obj);
    expect(theme.tokens).toMatchObject({primary:game.colorSystem.describeGroup(colorGroup).tokens.find(token=>token.key==='primary')?.value});
    setProperty(['action','command','value','tokens','primary'],'#345678');
    expect(theme.tokens).toMatchObject({primary:'#345678'});
    const remove=[...root.querySelectorAll<HTMLButtonElement>('[data-story-theme-remove]')].find(button=>button.dataset.storyThemeRemove===json(['action','command','value','tokens','primary']))!;
    remove.click();ctrl.flushUIUpdates();expect(theme.tokens).toEqual({});
  });

  it('previews overlay content at its authored coordinates and explains the difference between flow clears', () => {
    open();click('new');click('operation');
    const selected=currentDraft(ctrl.storyEditor.state)!.document.nodes[0]!;
    editProperty(draft(),selected.id,['action'],{kind:'overlay',command:{command:'show',id:'banner',x:.35,y:.42,align:'center',content:{kind:'text',template:'title',text:'标题'}}});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(root.querySelector('[data-story-overlay-canvas]')).toBeNull();
    q<HTMLButtonElement>('[data-story-performance-toggle]').click();ctrl.flushUIUpdates();
    let overlay=q<HTMLElement>('.story-editor-overlay-canvas [data-chat-text="banner"]');
    expect(overlay.style.getPropertyValue('--story-overlay-x')).toBe('35%');expect(overlay.style.getPropertyValue('--story-overlay-y')).toBe('42%');
    expect(root.textContent).toContain('同 ID 后写内容替换旧覆盖层');
    expect(hasProperty(['action','command','x'])).toBe(true);expect(hasProperty(['action','command','y'])).toBe(true);
    q<HTMLButtonElement>('[data-story-overlay-preset="bottom-right"]').click();ctrl.flushUIUpdates();
    expect((node().action as Obj).command).toMatchObject({x:.92,y:.1,align:'right'});
    overlay=q<HTMLElement>('.story-editor-overlay-canvas [data-chat-text="banner"]');
    const canvas=overlay.closest<HTMLElement>('[data-story-overlay-canvas]')!;
    vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,right:200,top:0,bottom:100,width:200,height:100,x:0,y:0,toJSON:()=>({})} as DOMRect);
    canvas.setPointerCapture=()=>{};
    const pointer=(target:HTMLElement,type:string,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:7});target.dispatchEvent(event);};
    pointer(overlay,'pointerdown',184,90);pointer(canvas,'pointermove',140,20);pointer(canvas,'pointerup',140,20);ctrl.flushUIUpdates();
    expect((node().action as Obj).command).toMatchObject({x:.7,y:.8});
    editProperty(draft(),selected.id,['action','command'],{command:'clearAllTexts'});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();expect(root.textContent).toContain('保留聊天历史与剧情进度');
    editProperty(draft(),selected.id,['action','command'],{command:'clearFlow'});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();expect(root.textContent).toContain('不回退已执行动作或剧情进度');
  });

  it('toggles independent node performances outside the flow and drags the owner while another node is selected', () => {
    open();click('new');composer('[data-editor-composer-text]','演出正文');click('send');click('click');
    const story=draft(),first=story.document.nodes[0]!,second=story.document.nodes[1]!;
    editProperty(story,first.id,['performance'],{layout:{mode:'positioned',x:.2,y:.3,align:'left'}});
    editProperty(story,second.id,['performance'],{layout:{mode:'positioned',x:.7,y:.6,align:'right'}});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    const flow=q<HTMLElement>('.story-editor-flow'),body=q<HTMLElement>('.story-editor-center .workspace-column__body');
    const firstNode=q<HTMLElement>(`[data-editor-node="${first.id}"]`);
    const firstButton=q<HTMLButtonElement>(`[data-story-performance-toggle="${first.id}"]`);
    const secondButton=q<HTMLButtonElement>(`[data-story-performance-toggle="${second.id}"]`);
    const toggle=(button:HTMLButtonElement)=>{button.click();ctrl.flushUIUpdates();};
    const preview=(id:string)=>q<HTMLElement>(`[data-story-overlay-node="${id}"]`);
    const before=structuredClone(story.document);
    click('info');
    expect(ctrl.storyEditor.state.inspectorView).toBe('story');
    expect(root.querySelector('.story-editor-position-tools')).toBeNull();
    body.scrollTop=97;
    expect(root.querySelector('[data-story-overlay-canvas]')).toBeNull();
    toggle(firstButton);
    expect(ctrl.storyEditor.state.inspectorView).toBe('node');
    expect(ctrl.storyEditor.state.selectedNodeId).toBe(first.id);
    expect(q<HTMLElement>('[data-story-designer-page="performance"]').hidden).toBe(false);
    expect(property<HTMLInputElement>(['performance','layout','x']).value).toBe('0.2');
    const canvas=preview(first.id),overlay=canvas.querySelector<HTMLElement>('[data-chat-text]')!;
    toggle(secondButton);
    expect(ctrl.storyEditor.state.selectedNodeId).toBe(second.id);
    expect(root.querySelectorAll('.story-editor-position-tools')).toHaveLength(1);
    expect(body.parentElement?.querySelector('.story-editor-position-tools')).not.toBeNull();
    expect(firstButton.getAttribute('aria-pressed')).toBe('true');
    expect(secondButton.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelectorAll('[data-story-overlay-canvas]')).toHaveLength(2);
    expect(story.document).toEqual(before);expect(body.scrollTop).toBe(97);
    expect(q('.story-editor-flow')).toBe(flow);expect(q(`[data-editor-node="${first.id}"]`)).toBe(firstNode);
    expect(body.contains(canvas)).toBe(false);
    expect(canvas.closest('.workspace-column__viewport')).toBe(body.parentElement);
    expect(firstNode.textContent).toContain('演出正文');expect(overlay.textContent).toContain('演出正文');
    expect(preview(first.id)).toBe(canvas);
    const inspectorX=property<HTMLInputElement>(['performance','layout','x']);
    canvas.setPointerCapture=vi.fn();
    vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,right:200,top:0,bottom:100,width:200,height:100,x:0,y:0,toJSON:()=>({})});
    const pointer=(type:string,target:HTMLElement,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:7});target.dispatchEvent(event);};
    // Grab away from the anchor; preserve the offset and the other node's form values.
    pointer('pointerdown',overlay,50,65);pointer('pointermove',canvas,110,45);
    expect(inspectorX.value).toBe('0.7');
    pointer('pointerup',canvas,110,45);ctrl.flushUIUpdates();
    expect(first).toMatchObject({performance:{layout:{x:.5,y:.5}}});
    expect(second).toMatchObject({performance:{layout:{x:.7,y:.6}}});
    pointer('pointerdown',overlay,100,50);pointer('pointermove',canvas,180,90);pointer('pointercancel',canvas,180,90);ctrl.flushUIUpdates();
    expect(first).toMatchObject({performance:{layout:{x:.5,y:.5}}});
    expect(overlay.style.getPropertyValue('--story-overlay-x')).toBe('50%');expect(overlay.style.getPropertyValue('--story-overlay-y')).toBe('50%');
    toggle(q<HTMLButtonElement>('[data-story-position-y="top"]'));
    expect(first).toMatchObject({performance:{layout:{x:.5,y:.5}}});
    expect(second).toMatchObject({performance:{layout:{y:0,anchor:{x:'right',y:'top'}}}});
    expect(Number(property<HTMLInputElement>(['performance','layout','x']).value)).toBeCloseTo(-.3);
    const secondCanvas=preview(second.id);
    toggle(firstButton);
    expect(ctrl.storyEditor.state.selectedNodeId).toBe(second.id);
    expect(firstButton.getAttribute('aria-pressed')).toBe('false');expect(canvas.isConnected).toBe(false);
    expect(preview(second.id)).toBe(secondCanvas);expect(firstNode.isConnected).toBe(true);
    expect(renameStoryNodeId(ctrl.storyEditor.state,second.id,'editing-renamed')).toBe(true);
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(preview('editing-renamed')).toBeTruthy();
    expect(q<HTMLButtonElement>('[data-story-performance-toggle="editing-renamed"]').getAttribute('aria-pressed')).toBe('true');
    editProperty(story,'editing-renamed',['performance','layout'],{mode:'flow'});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(root.querySelector('[data-story-overlay-canvas]')).toBeNull();
    expect(root.querySelector('[data-story-performance-toggle="editing-renamed"]')).toBeNull();
  });

  it('edits referenced ColorGroup through the editing-pack content service', () => {
    ctrl.destroy();game.stop();
    const runtime=new AronaClickerRuntime();game=runtime;runtime.init([baseDatapack]);ctrl=new UIController(runtime,root);
    const source=runtime.packManager.listPacks().find(pack=>pack.manifest.modName==='base')!;
    const editing=runtime.packManager.cloneAsEditing(source.id).pack;
    runtime.setPackSelection(`base@${source.manifest.version}`, 'editing');
    expect(runtime.applyPackSelection().ok).toBe(true);
    open();click('new');click('operation');
    const selected=currentDraft(ctrl.storyEditor.state)!.document.nodes[0]!;const group=[...runtime.registry.colorGroups.values()][0]!;
    ctrl.storyEditor.state.targetPackId=editing.id;
    editProperty(draft(),selected.id,['action'],{kind:'presentation',command:{command:'theme',value:{colorGroupId:group.id}}});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    q<HTMLButtonElement>('[data-story-theme-content-open="color-group"]').click();ctrl.flushUIUpdates();
    const color=[...root.querySelectorAll<HTMLInputElement>('[data-theme-content-path]')].find(input=>input.dataset.themeContentPath===json(['slots',0,'color']))!;
    expect(color).toBeTruthy();color.value='#456789';color.dispatchEvent(new Event('input',{bubbles:true}));ctrl.flushUIUpdates();
    q<HTMLButtonElement>('[data-theme-content-action="preview"]').click();ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.themeContentEdit?.previewing).toBe(true);
    q<HTMLButtonElement>('[data-theme-content-action="save"]').click();ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.themeContentEdit).toBeUndefined();
    expect(runtime.packManager.getPack(editing.id)?.datapack.colorGroups?.find(item=>item.id===group.id)?.slots[0]?.color).toBe('#456789');
  });

  it('keeps invalid numeric text in the draft, blocks the whole submit and locates the failing field', () => {
    open(); click('new'); click('click');
    setProperty(['interaction', 'text'], '按一下');
    setProperty(['interaction', 'press', 'base'], '-');

    click('save');
    expect(draft().persisted).toBe(true);
    submit();
    expect(ctrl.storyEditor.state.error).toContain('press.base');
    expect(game.registry.stories.has(draft().document.id)).toBe(false);
    expect(document.activeElement).toBe(property(['interaction', 'press', 'base']));

    setProperty(['interaction', 'press', 'base'], '3');
    setProperty(['interaction', 'press', 'rand'], '2');
    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect(((stored().nodes as Obj[])[0].interaction as Obj).press).toEqual({ base: 3, rand: 2 });
  });

  it('edits press work directly, preserves zero and invalid drafts, and clears back to a single press', () => {
    open(); click('new'); click('click');
    setProperty(['interaction','text'],'按击');
    const region = q<HTMLElement>('[data-story-basic-properties]');
    const base = property<HTMLInputElement>(['interaction', 'press', 'base']);
    const rand = property<HTMLInputElement>(['interaction', 'press', 'rand']);
    expect(base.closest('.story-editor-optional')).toBeNull();
    expect(rand.closest('.story-editor-optional')).toBeNull();
    expect(region.querySelector('[data-story-init-value="press"]')).toBeNull();
    const left = q<HTMLElement>('.story-editor-left .workspace-column__body');
    const right = q<HTMLElement>('.story-editor-right .workspace-column__body');
    left.scrollTop = 51; right.scrollTop = 96;
    base.focus(); base.value = '12'; base.setSelectionRange(1, 1);
    base.dispatchEvent(new Event('input', { bubbles: true })); ctrl.flushUIUpdates();
    expect(property(['interaction', 'press', 'base'])).toBe(base);
    expect(document.activeElement).toBe(base);
    expect(base.selectionStart).toBe(1);
    expect(q('[data-story-basic-properties]')).toBe(region);
    expect(left.scrollTop).toBe(51); expect(right.scrollTop).toBe(96);
    setProperty(['interaction', 'press', 'rand'], '0'); submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect(((stored().nodes as Obj[])[0].interaction as Obj).press).toEqual({ base: 12, rand: 0 });
    setProperty(['interaction', 'press', 'base'], ''); submit();
    expect(ctrl.storyEditor.state.error).toContain('press.base');
    expect((node().interaction as Obj).press).toEqual({ rand: '0' });
    setProperty(['interaction', 'press', 'rand'], ''); submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((node().interaction as Obj)).not.toHaveProperty('press');
    expect(((stored().nodes as Obj[])[0].interaction as Obj)).not.toHaveProperty('press');
  });

  it('restores pacing from the right side to defaults, keeps explicit zero, and omits cleared fields', () => {
    open(); click('new'); composer('[data-editor-composer-text]', '节奏'); click('send');
    selectBranch(['content'], 'kind', 'talk');
    setProperty(['performance', 'pacing', 'typing'], '0');
    setProperty(['performance', 'pacing', 'thinking'], '-');
    selectBranch(['content'], 'kind', 'narration'); submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    selectBranch(['content'], 'kind', 'talk');
    expect(property<HTMLInputElement>(['performance', 'pacing', 'thinking']).value).toBe('-');
    setProperty(['appearance', 'presentation', 'side'], 'right');
    expect(hasProperty(['performance', 'pacing', 'typing'])).toBe(false);
    setProperty(['appearance', 'presentation', 'side'], '');
    expect((node().performance as Obj).pacing).toEqual({ typing: '0', thinking: '-' });
    submit(); expect(ctrl.storyEditor.state.error).toContain('pacing.thinking');
    setProperty(['performance', 'pacing', 'thinking'], ''); submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0].performance).toEqual({ pacing: { typing: 0 } });
    setProperty(['performance', 'pacing', 'typing'], ''); submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect(node().performance).not.toHaveProperty('pacing');
    expect((stored().nodes as Obj[])[0]).not.toHaveProperty('performance');
  });

  it('keeps temporary names when changing roles and can return optional content to omission', () => {
    open(); click('new'); composer('[data-editor-composer-text]', '正文'); click('send');
    selectBranch(['content'], 'kind', 'talk');
    setProperty(['content', 'displayName'], '别名');
    const sender = q<HTMLSelectElement>('[data-editor-field="sender"]');
    sender.value = `character:${[...game.registry.characters.keys()][0]}`;
    sender.dispatchEvent(new Event('change', { bubbles: true })); ctrl.flushUIUpdates();
    expect((node().content as Obj).displayName).toBe('别名');
    setProperty(['content', 'image'], 'image.png'); setProperty(['content', 'image'], '');
    setProperty(['appearance', 'presentation', 'avatar'], 'avatar.png'); setProperty(['appearance', 'presentation', 'avatar'], '');
    sender.value = 'anonymous'; sender.dispatchEvent(new Event('change', { bubbles: true })); ctrl.flushUIUpdates();
    expect((node().content as Obj)).not.toHaveProperty('characterId');
    expect((node().content as Obj)).not.toHaveProperty('speaker');
    expect((node().content as Obj)).not.toHaveProperty('image');
    expect(((node().appearance as Obj).presentation as Obj)).not.toHaveProperty('avatar');
    submit(); expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0].content).toEqual({ kind: 'talk', text: '正文', displayName: '别名' });
  });

  it('restores EntryCard continuation and Choice conditions with one action, including after reload', () => {
    open(); click('new'); click('click');
    selectBranch(['interaction'],'kind','entryCard');
    const entry=[...game.registry.storyEntries.values()].find(item=>storyEntryType(item)==='active')!;
    const area=[...game.registry.areas.keys()][0];
    const owner=[...game.registry.characters.keys()][0];
    setProperty(['interaction','card','request','entryId'],entry.id);
    setProperty(['interaction','card','request','owner'],owner);
    setProperty(['interaction','card','title'],'临时标题');
    setProperty(['interaction','card','align'],'right');
    q<HTMLButtonElement>('[data-story-init-object]').click(); ctrl.flushUIUpdates();
    setProperty(['interaction','card','continuation','areaId'],area);
    const returnFlags = ['interaction','card','continuation','returnFlags'];
    rowAction('add',returnFlags);
    setProperty([...returnFlags,0],'route-a');
    rowAction('add',returnFlags);
    setProperty([...returnFlags,1],'extra-flag');
    rowAction('remove',returnFlags,1);
    toggleOptional(['interaction','card','continuation'],false);
    q<HTMLButtonElement>('[data-story-init-object]').click(); ctrl.flushUIUpdates();
    expect((node().interaction as Obj).card).toMatchObject({continuation:{areaId:area,returnFlags:['route-a']}});
    setProperty(['interaction','card','title'],'');
    setProperty(['interaction','card','align'],'');
    setProperty(['interaction','card','request','owner'],'__global__');
    expect((node().interaction as Obj).card).not.toHaveProperty('title');
    expect((node().interaction as Obj).card).not.toHaveProperty('align');
    submit(); expect(ctrl.storyEditor.state.error).toBeNull();
    selectBranch(['interaction'],'kind','choice');
    const conditionPath=['interaction','options',0,'showWhen'];
    q<HTMLButtonElement>('[data-story-init-condition]').click(); ctrl.flushUIUpdates();
    editProperty(draft(),String(node().id),conditionPath,{type:'OR',conditions:[{target:'alwaysTrue',key:'',comparator:'==',value:1}]});
    toggleOptional(conditionPath,false);
    click('save');
    ctrl.destroy(); ctrl=new UIController(game,root); ctrl.storyEditor.open();
    q('[data-editor-node]').click(); ctrl.flushUIUpdates();
    q<HTMLButtonElement>('[data-story-init-condition]').click(); ctrl.flushUIUpdates();
    expect(((node().interaction as Obj).options as Obj[])[0].showWhen).toEqual({type:'OR',conditions:[{target:'alwaysTrue',key:'',comparator:'==',value:1}]});
    selectBranch(['interaction'],'kind','entryCard');
    expect((node().interaction as Obj).card).toMatchObject({request:{entryId:entry.id,owner:null},continuation:{areaId:area,returnFlags:['route-a']}});
    submit(); expect(ctrl.storyEditor.state.error).toBeNull();
  });

  it('removes an optional enum value instead of writing a placeholder and surfaces unknown source fields as diagnostics', () => {
    open(); click('new');
    click('choose-sender');
    q<HTMLButtonElement>('[data-editor-sender="teacher"]').click(); ctrl.flushUIUpdates();
    composer('[data-editor-composer-text]', '老师发言'); click('send');

    setProperty(['appearance', 'presentation', 'align'], 'center');
    expect((node().appearance as Obj).presentation).toMatchObject({ side: 'right', align: 'center' });
    // Choosing the empty enumeration option removes the field instead of writing a placeholder.
    setProperty(['appearance', 'presentation', 'align'], '');
    expect((node().appearance as Obj).presentation).toEqual({ side: 'right' });

    ((node().appearance as Obj).presentation as Obj).legacyFlag = true;
    draft().dirty = true;
    submit();
    expect(ctrl.storyEditor.state.error).toContain('presentation.legacyFlag');
    expect(root.textContent).toContain('未知字段');
    const clear = [...root.querySelectorAll<HTMLButtonElement>('[data-story-remove-readonly]')]
      .find(button => button.dataset.storyOptionalPath === json(['appearance', 'presentation', 'legacyFlag']));
    expect(clear).toBeTruthy();
    clear!.click(); ctrl.flushUIUpdates();
    expect((node().appearance as Obj).presentation).not.toHaveProperty('legacyFlag');
    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
  });

  it('keeps local flag input the only value source while the dedicated form and the panel share one draft', () => {
    open(); click('new'); click('operation');
    selectBranch(['action'], 'kind', 'localFlag');
    const flagFields = root.querySelector<HTMLElement>('[data-editor-key="local-flag-fields"]');
    expect(flagFields?.closest('.story-editor-property-group')).toBeNull();
    const actionGroup = flagFields?.parentElement;
    expect(actionGroup?.querySelector('[data-story-branch-field="kind"]')?.closest('label')?.textContent).toContain('行为类型');
    expect(flagFields?.querySelector('[data-editor-field="local-flag-op"]')).not.toBeNull();
    selectBranch(['action'], 'kind', 'travel');
    expect(root.querySelector('[data-editor-field="local-flag-op"]')).toBeNull();
    selectBranch(['action'], 'kind', 'localFlag');
    expect(root.querySelector('[data-editor-field="local-flag-op"]')).not.toBeNull();
  });
  it.each(['narration','talk'] as const)('saves positioned %s performance without requiring a character identity',kind=>{
    open();click('new');composer('[data-editor-composer-text]','无角色演出');click('send');
    if(kind==='talk') selectBranch(['content'],'kind','talk');
    q<HTMLButtonElement>('[data-column-action="story-editor-designer:performance"]').click();ctrl.flushUIUpdates();
    selectBranch(['performance','layout'],'mode','positioned');
    setProperty(['appearance','template'],'title');setProperty(['appearance','style','fontSize'],'2rem');
    q<HTMLButtonElement>('[data-story-performance-toggle]').click();ctrl.flushUIUpdates();
    q<HTMLButtonElement>('[data-story-position-y="top"]').click();ctrl.flushUIUpdates();
    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    const saved=(stored().nodes as Obj[])[0];
    expect(saved).toMatchObject({type:'talklet',content:{kind,text:'无角色演出'},performance:{layout:{mode:'positioned',x:0,y:0,anchor:{x:'center',y:'top'}}},appearance:{template:'title',style:{fontSize:'2rem'}}});
    expect(saved).not.toHaveProperty('characterId');expect(saved.content).not.toHaveProperty('characterId');
    const restored:StoryEditorState={...ctrl.storyEditor.state,drafts:[]};
    new StoryDraftPersistence().load(restored);
    expect(restored.drafts.find(item=>item.draftId===draft().draftId)?.document.nodes[0]).toMatchObject(saved);
  });

  it('rejects an incomplete third move-to-Chara node while editing Talklet performance and keeps runtime content intact',()=>{
    open();click('new');composer('[data-editor-composer-text]','演出正文');click('send');click('click');
    setProperty(['interaction','text'],'继续');
    const talk=draft().document.nodes[0]!;
    editProperty(draft(),talk.id,['performance'],{template:'title',layout:{mode:'positioned',x:.4,y:.6,align:'center'}});
    submit();expect(ctrl.storyEditor.state.error).toBeNull();
    const previous=structuredClone(stored());
    click('moveToCharaspace');
    const movement=draft().document.nodes[2]!;
    ctrl.storyEditor.state.selectedNodeId=talk.id;ctrl.storyEditor.state.nodeDesignerTab='performance';
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    const write=vi.spyOn(ctrl.commands,'saveStoryDefinition');
    submit();
    expect(ctrl.storyEditor.state.error).toBe('nodes[2].characterId：必须是非空字符串');
    expect(ctrl.storyEditor.state.selectedNodeId).toBe(movement.id);
    expect(property<HTMLSelectElement>(['characterId']).value).toBe('');
    expect(write).not.toHaveBeenCalled();expect(stored()).toEqual(previous);
    expect(ctrl.storyEditor.save()).toBe(true);
    const target=[...game.registry.characterVariants.keys()][0];expect(target).toBeTruthy();
    setProperty(['characterId'],target);submit();
    expect(ctrl.storyEditor.state.error).toBeNull();expect(write).toHaveBeenCalledOnce();
    expect((stored().nodes as Obj[])[2]).toMatchObject({id:movement.id,type:'moveToCharaspace',characterId:target});
    expect((stored().nodes as Obj[])[0]).toMatchObject((previous.nodes as Obj[])[0]);
  });

  it('keeps signed offsets when changing the anchor, dragging and switching coordinate units',()=>{
    open();click('new');composer('[data-editor-composer-text]','像素定位');click('send');
    q<HTMLButtonElement>('[data-column-action="story-editor-designer:performance"]').click();ctrl.flushUIUpdates();
    selectBranch(['performance','layout'],'mode','positioned');
    const rect={left:300,right:700,top:100,bottom:340,width:400,height:240,x:300,y:100,toJSON:()=>({})};
    vi.spyOn(q('.story-editor-center .workspace-column__viewport'),'getBoundingClientRect').mockReturnValue(rect);
    const tool=(selector:string)=>{q<HTMLButtonElement>(selector).click();ctrl.flushUIUpdates();};
    expect(root.querySelector('.story-editor-position-tools')).toBeNull();
    tool('[data-story-performance-toggle]');
    tool('[data-story-position-unit="px"]');
    expect(node().performance).toMatchObject({layout:{unit:'px',x:0,y:0}});
    setProperty(['performance','layout','x'],'-24');setProperty(['performance','layout','y'],'-16');
    tool('[data-story-position-x="right"]');
    tool('[data-story-position-y="top"]');
    expect(node().performance).toMatchObject({layout:{x:'-24',y:'-16',anchor:{x:'right',y:'top'}}});
    const canvas=q<HTMLElement>('[data-story-overlay-canvas]');
    const overlay=canvas.querySelector<HTMLElement>('[data-chat-text]')!;
    expect(overlay.style.getPropertyValue('--story-overlay-x')).toBe('-24px');
    expect(overlay.style.getPropertyValue('--story-overlay-base-x')).toBe('100%');
    expect(overlay.style.getPropertyValue('--story-overlay-base-y')).toBe('100%');
    canvas.setPointerCapture=vi.fn();
    vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue(rect);
    const pointer=(target:HTMLElement,type:string,clientX:number,clientY:number)=>{
      const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX,clientY});
      Object.defineProperty(event,'pointerId',{value:7});target.dispatchEvent(event);
    };
    pointer(overlay.firstElementChild as HTMLElement,'pointerdown',656,121);
    pointer(canvas,'pointermove',628,141);pointer(canvas,'pointerup',628,141);ctrl.flushUIUpdates();
    const position=(node().performance as {layout:{x:number;y:number}}).layout;
    expect(position.x).toBeCloseTo(-52);expect(position.y).toBeCloseTo(-36);
    tool('[data-story-position-unit="percent"]');
    expect((node().performance as {layout:Obj}).layout).not.toHaveProperty('unit');
    expect(Number(property<HTMLInputElement>(['performance','layout','x']).value)).toBeCloseTo(-.13);
    tool('[data-story-position-unit="px"]');submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0].performance).toMatchObject({layout:{unit:'px',anchor:{x:'right',y:'top'},x:expect.closeTo(-52),y:expect.closeTo(-36)}});
    const restored:StoryEditorState={...ctrl.storyEditor.state,drafts:[]};
    new StoryDraftPersistence().load(restored);
    expect(restored.drafts.find(item=>item.draftId===draft().draftId)?.document.nodes[0]).toMatchObject((stored().nodes as Obj[])[0]);
  });

  it('keeps designer pages mounted, edits one body, and restores positioned drafts and defaults',()=>{
    open();click('new');composer('[data-editor-composer-text]','唯一正文');click('send');
    const body=property<HTMLTextAreaElement>(['content','text']);
    const before=structuredClone(draft().document);
    const tabs=(page:string)=>{q<HTMLButtonElement>(`[data-column-action="story-editor-designer:${page}"]`).click();ctrl.flushUIUpdates();};
    tabs('performance');
    expect(draft().document).toEqual(before);
    expect(property<HTMLTextAreaElement>(['content','text'])).toBe(body);
    expect(q<HTMLElement>('[data-story-designer-page="basic"]').hidden).toBe(true);
    selectBranch(['performance','layout'],'mode','positioned');
    expect(root.querySelector('[data-story-overlay-canvas]')).toBeNull();
    q<HTMLButtonElement>('[data-story-performance-toggle]').click();ctrl.flushUIUpdates();
    q<HTMLButtonElement>('[data-story-position-y="top"]').click();ctrl.flushUIUpdates();
    q<HTMLButtonElement>('[data-story-position-x="right"]').click();ctrl.flushUIUpdates();
    expect(node().performance).toMatchObject({layout:{mode:'positioned',x:0,y:0,anchor:{x:'right',y:'top'}}});
    setProperty(['appearance','template'],'title');
    setProperty(['appearance','style','color'],'#fedcba');
    setProperty(['appearance','style','fontSize'],'2rem');
    setProperty(['appearance','style','background'],'false');
    const canvas=q<HTMLElement>('[data-story-overlay-canvas]');
    expect(canvas.querySelector('.chat-text-title')?.textContent).toBe('唯一正文');
    expect(canvas.querySelector<HTMLElement>('[data-chat-text]')?.style.getPropertyValue('--story-overlay-x')).toBe('0%');
    canvas.setPointerCapture=vi.fn();
    vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,top:0,right:200,bottom:100,width:200,height:100,x:0,y:0,toJSON:()=>({})});
    const pointer=(type:string,target:HTMLElement,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:7});target.dispatchEvent(event);};
    pointer('pointerdown',canvas.querySelector<HTMLElement>('.chat-text-title')!,200,0);
    pointer('pointermove',canvas,50,75);pointer('pointerup',canvas,50,75);ctrl.flushUIUpdates();
    expect(node().performance).toMatchObject({layout:{x:-.75,y:-.75}});

    setProperty(['performance','layout','x'],'-');
    tabs('basic');submit();
    expect(ctrl.storyEditor.state.nodeDesignerTab).toBe('performance');
    expect(ctrl.storyEditor.state.error).toContain('performance.layout.x');
    expect(property<HTMLInputElement>(['performance','layout','x']).value).toBe('-');
    selectBranch(['performance','layout'],'mode','flow');submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0]).toMatchObject({performance:{layout:{mode:'flow'}},appearance:{template:'title'}});
    selectBranch(['performance','layout'],'mode','positioned');
    expect(property<HTMLInputElement>(['performance','layout','x']).value).toBe('-');
    setProperty(['performance','layout','x'],'0.25');
    click('save');ctrl.destroy();ctrl=new UIController(game,root);ctrl.storyEditor.open();
    q('[data-editor-node]').click();ctrl.flushUIUpdates();tabs('performance');
    expect(property<HTMLInputElement>(['performance','layout','x']).value).toBe('0.25');
    q<HTMLButtonElement>('[data-story-reset-design="performance"]').click();ctrl.flushUIUpdates();
    expect(node()).not.toHaveProperty('performance');
    expect((node().content as Obj).text).toBe('唯一正文');
    selectBranch(['performance','layout'],'mode','positioned');
    expect(node().performance).toEqual({layout:{mode:'positioned',x:0,y:0,anchor:{x:'center',y:'center'}}});
  });

  it('selects real display targets for clear operations and updates the references on node rename',()=>{
    open();click('new');composer('[data-editor-composer-text]','清理目标');click('send');
    const targetId=String(node().id),storyId=draft().document.id;
    click('operation');selectBranch(['action'],'kind','clearNode');
    setProperty(['action','storyId'],storyId);setProperty(['action','nodeId'],targetId);
    selectBranch(['action'],'kind','state');
    expect(renameStoryNodeId(ctrl.storyEditor.state,targetId,'readable-target')).toBe(true);
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    selectBranch(['action'],'kind','clearNode');
    expect(property<HTMLSelectElement>(['action','nodeId']).value).toBe('readable-target');
    submit();expect(ctrl.storyEditor.state.error).toBeNull();
    q<HTMLButtonElement>('[data-story-display-target]').click();ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.selectedNodeId).toBe('readable-target');
    expect(q<HTMLTextAreaElement>('[data-story-body-node]').value).toBe('清理目标');
  });

});
