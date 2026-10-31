// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { UIController } from '../../src/ui/controller/controller';
import { currentDraft } from '../../src/ui/story-editor/model';
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
  const click = (action: string): void => { q<HTMLButtonElement>(`[data-editor-action="${action}"]`).click(); ctrl.flushUIUpdates(); };
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
    setProperty(['content', 'speaker'], '自定义发出方');
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

    selectBranch(['content'], 'kind', 'talk');
    expect(node().content).toMatchObject({ speaker: '自定义发出方', image: pic });
    expect(node().pacing).toEqual({ typing: '2' });
  });

  it('switches button, choice and entry card without leaking fields, inventing a stage advance or losing the draft on reload', () => {
    open(); click('new'); click('click');
    const stageId = node().stageId as string;
    expect(draft().document.stages[stageId].advance).toBe('input');
    setProperty(['interaction', 'text'], '继续调查');

    selectBranch(['interaction'], 'kind', 'choice');
    expect(node().interaction).toEqual({ kind: 'choice' });
    rowAction('add', ['interaction', 'options']);
    const option = ((node().interaction as Obj).options as Obj[])[0];
    expect(String(option.id)).toMatch(/^option_[A-Za-z0-9]+$/);
    setProperty(['interaction', 'options', 0, 'text'], '去左边');
    expect(root.textContent).toContain('选项（按顺序）');

    selectBranch(['interaction'], 'kind', 'button');
    expect((node().interaction as Obj).text).toBe('继续调查');
    selectBranch(['interaction'], 'kind', 'choice');
    expect((node().interaction as Obj).options).toEqual([{ id: option.id, text: '去左边' }]);

    selectBranch(['interaction'], 'kind', 'entryCard');
    expect(node().interaction).toEqual({ kind: 'entryCard', card: { request: { entryType: 'active', intent: 'card', owner: null } } });
    const entry = [...game.registry.storyEntries].find(([, item]) => item.type === 'active')!;
    expect(entry).toBeTruthy();
    setProperty(['interaction', 'card', 'request', 'entryId'], entry[0]);

    submit();
    expect(ctrl.storyEditor.state.error).toBeNull();
    expect((stored().nodes as Obj[])[0]).toMatchObject({
      stageId, interaction: { kind: 'entryCard', card: { request: { entryId: entry[0], entryType: 'active', intent: 'card', owner: null } } },
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
