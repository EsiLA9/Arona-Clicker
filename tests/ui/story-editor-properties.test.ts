// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime/runtime';
import { UIController } from '../../src/ui/controller/controller';
import { currentDraft } from '../../src/ui/story-editor/model';
import { editProperty, rowIdAt } from '../../src/ui/story-editor/property-model';
import { STORY_EDITOR_STORAGE_KEY } from '../../src/ui/story-editor/persistence';
import '../../src/ui/runtime/service-definitions';

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
  const click = (action: string): void => { q<HTMLButtonElement>(`[data-editor-action="${action}"]`).click(); if(action==='new'){const current=currentDraft(ctrl.storyEditor.state);if(current&&!current.document.startContext){current.document={...current.document,startContext:{type:'area',areaId:[...game.registry.areas.keys()][0]??''}};current.dirty=true;ctrl.storyEditor.requestRefresh();}} ctrl.flushUIUpdates(); };
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
  afterEach(() => {
    vi.restoreAllMocks();
    ctrl.modal.close();
    ctrl.destroy();
    game.stop();
    localStorage.clear();
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
    toggleOptional(['pacing'], true);
    setProperty(['pacing', 'typing'], '2');
    expect(node().pacing).toEqual({ typing: '2' });
    expect(root.textContent).toContain('仅非右侧对话可启用');

    click('save');
    expect(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)).toContain('typing');

    selectBranch(['content'], 'kind', 'narration');
    expect(node().content).toEqual({ kind: 'narration', text: '原始旁白' });
    expect(node()).not.toHaveProperty('pacing');
    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0]).toMatchObject({ content: { kind: 'narration', text: '原始旁白' } });
    expect(((stored().nodes as Obj[])[0].content as Obj)).not.toHaveProperty('speaker');
    expect(((stored().nodes as Obj[])[0].content as Obj)).not.toHaveProperty('displayName');

    selectBranch(['content'], 'kind', 'talk');
    expect(node().content).toMatchObject({ displayName: '自定义发出方', image: pic });
    expect(node().pacing).toEqual({ typing: '2' });
  });

  it('shows presentation fields without enabling a group, supports defaults and keeps live controls', () => {
    open(); click('new');
    composer('[data-editor-composer-text]', '旁白'); click('send');
    expect(node()).not.toHaveProperty('presentation');
    const section = q<HTMLElement>('.story-editor-presentation');
    expect(section.querySelector('h3')?.textContent).toBe('呈现');
    expect(section.closest('.story-editor-optional')).toBeNull();
    expect(section.querySelector('.story-editor-property-group, .story-editor-optional-content')).toBeNull();
    for (const [name, title] of [['side', '气泡位置'], ['align', '文字对齐'], ['avatarMode', '头像显示'], ['avatar', '头像引用']]) {
      const label = property(['presentation', name]).closest('label')!;
      expect(label.parentElement).toBe(section);
      expect(label.textContent).toContain(title);
      expect(label.querySelector('.story-editor-hint')?.textContent).toBeTruthy();
    }

    const body = q<HTMLElement>('.story-editor-right .workspace-column__body');
    body.scrollTop = 87;
    const avatar = property<HTMLInputElement>(['presentation', 'avatar']);
    avatar.focus(); avatar.value = 'portrait'; avatar.setSelectionRange(4, 4);
    avatar.dispatchEvent(new Event('input', { bubbles: true })); ctrl.flushUIUpdates();
    expect(property(['presentation', 'avatar'])).toBe(avatar);
    expect(document.activeElement).toBe(avatar);
    expect(avatar.selectionStart).toBe(4);
    setProperty(['presentation', 'avatarMode'], 'hide');
    expect(node().presentation).toEqual({ avatar: 'portrait', avatarMode: 'hide' });
    const mode = property<HTMLSelectElement>(['presentation', 'avatarMode']);
    expect([...mode.options].some(option => option.value === '' && option.textContent === '沿用默认')).toBe(true);
    setProperty(['presentation', 'avatarMode'], '');
    expect(node().presentation).toEqual({ avatar: 'portrait' });
    expect(property(['presentation', 'avatar'])).toBe(avatar);
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
    setProperty(['interaction', 'options', 0, 'text'], '去左边');
    expect(root.textContent).toContain('选项（按顺序）');

    selectBranch(['interaction'], 'kind', 'button');
    expect((node().interaction as Obj).text).toBe('继续调查');
    selectBranch(['interaction'], 'kind', 'choice');
    expect((node().interaction as Obj).options).toEqual([{ id: option.id, text: '去左边' }]);

    selectBranch(['interaction'], 'kind', 'entryCard');
    expect(node().interaction).toEqual({ kind: 'entryCard', card: { buttonText: '继续调查', request: { entryType: 'active', intent: 'card', owner: null } } });
    const entry = [...game.registry.storyEntries].find(([, item]) => item.type === 'active')!;
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

  it('keeps legacy Choice effects visible and removable while new actions stay local flags', () => {
    open(); click('new'); click('click');
    const clickNode=node();
    clickNode.interaction={kind:'choice',sharedActions:[{kind:'travel',areaId:'base:area:schale_main'},{kind:'localFlag',op:'set',name:'kept',value:true}],options:[{id:'legacy',text:'旧选项',condition:{target:'alwaysTrue',comparator:'==',value:1},result:{actions:[{kind:'state',effects:[{op:'setFlag',flagId:'legacy',value:true}]}],transfer:{mode:'goto',storyId:'legacy:target'}}}]};
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(root.textContent).toContain('旧 Choice 动作');
    expect(root.textContent).toContain('base:area:schale_main');
    expect(root.textContent).toContain('旧 Choice 转移');
    expect(hasProperty(['interaction','options',0,'condition','target'])).toBe(true);
    const actionRows=['interaction','sharedActions'] as const;const nodeId=String(clickNode.id);
    const flagRowId=rowIdAt(draft(),nodeId,actionRows,1);
    const flagValueType=[...root.querySelectorAll<HTMLSelectElement>('[data-value-type]')].find(item=>item.dataset.valuePath===json([...actionRows,1,'value']));
    expect(flagValueType).toBeTruthy();flagValueType!.value='number';flagValueType!.dispatchEvent(new Event('change',{bubbles:true}));ctrl.flushUIUpdates();
    const rawNumber=[...root.querySelectorAll<HTMLInputElement>('[data-value-input="number"]')].find(item=>item.dataset.valuePath===json([...actionRows,1,'value']));
    expect(rawNumber).toBeTruthy();rawNumber!.value='-';rawNumber!.dispatchEvent(new Event('input',{bubbles:true}));ctrl.flushUIUpdates();
    const kinds=[...root.querySelectorAll<HTMLSelectElement>('[data-story-branch-path]')].find(item=>item.dataset.storyBranchPath===json(['interaction','sharedActions',1])&&item.dataset.storyBranchField==='kind');
    expect(kinds).toBeTruthy();
    expect([...kinds!.options].map(option=>option.value)).toEqual(['localFlag']);
    rowAction('remove',actionRows);
    expect(rowIdAt(draft(),nodeId,actionRows,0)).toBe(flagRowId);
    expect([...root.querySelectorAll<HTMLInputElement>('[data-value-input="number"]')].find(item=>item.dataset.valuePath===json([...actionRows,0,'value']))?.value).toBe('-');
    expect((node().interaction as Obj).sharedActions).toMatchObject([{kind:'localFlag',op:'set',name:'kept'}]);
    expect(((((node().interaction as Obj).options as Obj[])[0].result) as Obj).transfer).toEqual({mode:'goto',storyId:'legacy:target'});
    click('save');
    const saved=structuredClone(draft().document);
    ctrl.destroy();ctrl=new UIController(game,root);ctrl.storyEditor.open();
    expect(currentDraft(ctrl.storyEditor.state)?.document).toEqual(saved);
    q<HTMLElement>('[data-editor-node]').click();ctrl.flushUIUpdates();
    expect(root.textContent).toContain('旧 Choice 转移');
  });

  it('creates only local flags for Choice and still creates state actions and transfers for Button', () => {
    open();click('new');click('click');selectBranch(['interaction'],'kind','choice');
    rowAction('add',['interaction','sharedActions']);
    expect((node().interaction as Obj).sharedActions).toEqual([{kind:'localFlag',op:'set',name:'',value:true}]);
    rowAction('add',['interaction','options']);
    const addCondition=[...root.querySelectorAll<HTMLButtonElement>('[data-story-init-condition]')].find(button=>button.dataset.storyPath===json(['interaction','options',0,'condition']));
    expect(addCondition).toBeTruthy();addCondition!.click();ctrl.flushUIUpdates();
    rowAction('add',['interaction','options',0,'result','actions']);
    expect(((((node().interaction as Obj).options as Obj[])[0].result as Obj).actions as Obj[])[0]).toMatchObject({kind:'localFlag',op:'set'});
    const optionKind=[...root.querySelectorAll<HTMLSelectElement>('[data-story-branch-path]')].find(item=>item.dataset.storyBranchPath===json(['interaction','options',0,'result','actions',0])&&item.dataset.storyBranchField==='kind');
    expect(optionKind).toBeTruthy();expect([...optionKind!.options].map(option=>option.value)).toEqual(['localFlag']);
    expect(hasProperty(['interaction','options',0,'condition','type'])).toBe(true);

    click('new');click('click');
    const initResult=[...root.querySelectorAll<HTMLButtonElement>('[data-story-init-object]')].find(item=>item.dataset.storyPath===json(['interaction','result']));
    expect(initResult).toBeTruthy();initResult!.click();ctrl.flushUIUpdates();
    toggleOptional(['interaction','result','actions']);rowAction('add',['interaction','result','actions']);
    const actionKind=[...root.querySelectorAll<HTMLSelectElement>('[data-story-branch-path]')].find(item=>item.dataset.storyBranchPath===json(['interaction','result','actions',0])&&item.dataset.storyBranchField==='kind');
    expect(actionKind).toBeTruthy();expect([...actionKind!.options].some(option=>option.value==='state')).toBe(true);
    selectBranch(['interaction','result','actions',0],'kind','state');
    toggleOptional(['interaction','result','transfer']);
    selectBranch(['interaction','result','transfer'],'mode','goto');
    expect(node().interaction).toMatchObject({kind:'button',result:{actions:[{kind:'state'}],transfer:{mode:'goto'}}});
  });

  it('diagnoses malformed legacy Choice result and action values without hiding their source', () => {
    open();click('new');click('click');
    node().interaction={kind:'choice',options:[{id:'null',text:'null result',result:null},{id:'actions',text:'bad actions',result:{actions:'legacy raw value'}},{id:'array',text:'array result',result:[]}]} as unknown as Obj;
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    expect(root.textContent).toContain('旧 Choice 结果结构无效');
    expect(root.textContent).toContain('旧动作字段结构无效');
    expect(root.textContent).toContain('legacy raw value');
    expect(root.textContent).toContain('[]');
    expect(root.querySelectorAll('[data-story-remove-readonly]').length).toBeGreaterThanOrEqual(3);
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
    expect(node(1).action).toEqual({ kind: 'travel', areaId: area });

    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect(((stored().nodes as Obj[])[0].action as Obj).effects).toEqual([
      { op: 'setSpotLevel', spotId: spot, amount: 5 },
      { op: 'addItem', itemId: item, amount: 3 },
    ]);
    expect((stored().nodes as Obj[])[1].action).toEqual({ kind: 'travel', areaId: area });
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
    let overlay=q<HTMLElement>('.story-editor-overlay-canvas [data-chat-text="banner"]');
    expect(overlay.getAttribute('style')).toContain('left: 35%');expect(overlay.getAttribute('style')).toContain('bottom: 42%');
    expect(root.textContent).toContain('同 ID 后写内容替换旧覆盖层');
    expect(hasProperty(['action','command','x'])).toBe(true);expect(hasProperty(['action','command','y'])).toBe(true);
    q<HTMLButtonElement>('[data-story-overlay-preset="bottom-right"]').click();ctrl.flushUIUpdates();
    expect((node().action as Obj).command).toMatchObject({x:.92,y:.1,align:'right'});
    overlay=q<HTMLElement>('.story-editor-overlay-canvas [data-chat-text="banner"]');
    const canvas=overlay.closest<HTMLElement>('[data-story-overlay-canvas]')!;
    vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,right:200,top:0,bottom:100,width:200,height:100,x:0,y:0,toJSON:()=>({})} as DOMRect);
    canvas.setPointerCapture=()=>{};
    const pointer=(target:HTMLElement,type:string,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:7});target.dispatchEvent(event);};
    pointer(overlay,'pointerdown',70,58);pointer(canvas,'pointermove',140,20);pointer(canvas,'pointerup',140,20);ctrl.flushUIUpdates();
    expect((node().action as Obj).command).toMatchObject({x:.7,y:.8});
    editProperty(draft(),selected.id,['action','command'],{command:'clearAllTexts'});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();expect(root.textContent).toContain('保留聊天历史与剧情进度');
    editProperty(draft(),selected.id,['action','command'],{command:'clearFlow'});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();expect(root.textContent).toContain('不回退已执行动作或剧情进度');
  });

  it('edits referenced ColorGroup through the editing-pack content service', () => {
    ctrl.destroy();game.stop();
    const runtime=new AronaClickerRuntime();game=runtime;runtime.init([baseDatapack]);ctrl=new UIController(runtime,root);
    const source=runtime.packManager.listPacks().find(pack=>pack.manifest.modName==='base')!;
    const editing=runtime.packManager.cloneAsEditing(source.id).pack;
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
    q<HTMLButtonElement>('[data-story-init-value="press"]').click(); ctrl.flushUIUpdates();
    setProperty(['interaction', 'press', 'base'], '-');

    click('save');
    expect(draft().persisted).toBe(true);
    submit();
    expect(ctrl.storyEditor.state.error).toContain('press.base');
    expect(game.registry.stories.has(draft().document.id)).toBe(false);
    expect(document.activeElement).toBe(property(['interaction', 'press', 'base']));

    setProperty(['interaction', 'press', 'base'], '3');
    toggleOptional(['interaction', 'press', 'rand'], true);
    setProperty(['interaction', 'press', 'rand'], '2');
    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect(((stored().nodes as Obj[])[0].interaction as Obj).press).toEqual({ base: 3, rand: 2 });
  });

  it('removes an optional enum value instead of writing a placeholder and surfaces unknown source fields as diagnostics', () => {
    open(); click('new');
    click('choose-sender');
    q<HTMLButtonElement>('[data-editor-sender="teacher"]').click(); ctrl.flushUIUpdates();
    composer('[data-editor-composer-text]', '老师发言'); click('send');

    setProperty(['presentation', 'align'], 'center');
    expect(node().presentation).toMatchObject({ side: 'right', align: 'center' });
    // Choosing the empty enumeration option removes the field instead of writing a placeholder.
    setProperty(['presentation', 'align'], '');
    expect(node().presentation).toEqual({ side: 'right' });

    (node().presentation as Obj).legacyFlag = true;
    draft().dirty = true;
    submit();
    expect(ctrl.storyEditor.state.error).toContain('presentation.legacyFlag');
    expect(root.textContent).toContain('未知字段');
    const clear = [...root.querySelectorAll<HTMLButtonElement>('[data-story-remove-readonly]')]
      .find(button => button.dataset.storyOptionalPath === json(['presentation', 'legacyFlag']));
    expect(clear).toBeTruthy();
    clear!.click(); ctrl.flushUIUpdates();
    expect(node().presentation).not.toHaveProperty('legacyFlag');
    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
  });

  it('keeps local flag input the only value source while the dedicated form and the panel share one draft', () => {
    open(); click('new'); click('operation');
    selectBranch(['action'], 'kind', 'localFlag');
    const flagFields = root.querySelector<HTMLElement>('[data-editor-key="local-flag-fields"]');
    const actionGroup = flagFields?.closest('.story-editor-property-group');
    expect(actionGroup?.querySelector('[data-story-branch-field="kind"]')?.closest('label')?.textContent).toContain('行为类型');
    expect(flagFields?.querySelector('[data-editor-field="local-flag-op"]')).not.toBeNull();
    selectBranch(['action'], 'kind', 'travel');
    expect(root.querySelector('[data-editor-field="local-flag-op"]')).toBeNull();
    selectBranch(['action'], 'kind', 'localFlag');
    expect(root.querySelector('[data-editor-field="local-flag-op"]')).not.toBeNull();
  });
});
