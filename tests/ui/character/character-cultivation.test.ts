// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { UIController } from '../../../src/ui/controller/controller';

describe('Contacts 简易培养', () => {
  let game: GameInstance;
  let controller: UIController;
  let root: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    controller = new UIController(game, root);
    controller.started = true;
    controller.bindEvents();
  });

  afterEach(() => {
    controller.destroy();
    game.stop();
    localStorage.clear();
  });

  function openHoshinoContacts(): void {
    controller.openContactsWorkspace('Hoshino');
    controller.render();
    expect(root.querySelector('[data-character-cultivation="Hoshino"]')).not.toBeNull();
  }

  function cultivationField(name: string): HTMLElement {
    const field = root.querySelector<HTMLElement>(`[data-character-cultivation="Hoshino"] [data-cultivation-field="${name}"]`);
    if (!field) throw new Error(`培养字段不存在：${name}`);
    return field;
  }

  it('训练走真实命令并只更新目标角色，旧战备快照冻结而新预览读取最新培养', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'story');
    const otherBefore = { ...game.rosterSystem.getOwned(game.state, 'HoshinoSwimsuit')! };
    const normalBefore = game.variantTraining.preview('normal');
    const ownedBefore = game.variantTraining.preview('owned');
    expect(normalBefore.status).toBe('ready');
    expect(ownedBefore.status).toBe('ready');
    if (normalBefore.status !== 'ready' || ownedBefore.status !== 'ready') throw new Error('训练来源预览未就绪');
    const normalValue = normalBefore.members[0].input.attributes[0].value;
    const entered = game.variantTraining.start(ownedBefore.token);
    expect(entered.translation?.members[0].progression).toEqual({ level: 1, stars: 0, affectionLevel: 1 });

    openHoshinoContacts();
    const frame = root.querySelector('[data-workspace-frame="contacts"]');
    const row = root.querySelector('[data-select-variant="Hoshino"]');
    const right = root.querySelector<HTMLElement>('[data-theme-host-id="rightPanel.service.contacts.inspector"]')!;
    const scrollOwner = right.querySelector<HTMLElement>('[data-scroll-owner="content-region"]')!;
    const cultivation = right.querySelector<HTMLElement>('[data-character-cultivation="Hoshino"]')!;
    const train = cultivation.querySelector<HTMLButtonElement>('[data-add-exp]')!;
    const otherRow = root.querySelector('[data-select-variant="HoshinoSwimsuit"]');
    const before = controller.getRefreshStats();
    vi.spyOn(controller.commands, 'addExp');
    scrollOwner.scrollTop = 83;
    train.focus();
    train.click();

    expect(controller.commands.addExp).toHaveBeenCalledWith('Hoshino', 1000);
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ level: 5, exp: 0 });
    expect(game.rosterSystem.getOwned(game.state, 'HoshinoSwimsuit')).toEqual(otherBefore);
    expect(cultivationField('level').textContent).toBe('Lv.5 / 30');
    expect(root.querySelector('[data-contact-level="Hoshino"]')?.textContent).toBe('Lv.5');
    expect(root.querySelector('[data-contact-level="HoshinoSwimsuit"]')?.textContent).toBe('Lv.1');

    const ownedAfter = game.variantTraining.preview('owned');
    const normalAfter = game.variantTraining.preview('normal');
    expect(ownedAfter.status).toBe('ready');
    expect(normalAfter.status).toBe('ready');
    if (ownedAfter.status !== 'ready' || normalAfter.status !== 'ready') throw new Error('训练后来源预览未就绪');
    expect(ownedAfter.members[0].progression).toEqual({ level: 5, stars: 0, affectionLevel: 1 });
    expect(ownedAfter.members[0].input.attributes[0].value).toBe(28);
    expect(normalAfter.members[0].input.attributes[0].value).toBe(normalValue);
    expect(game.variantTraining.getView().translation?.members[0].progression).toEqual({ level: 1, stars: 0, affectionLevel: 1 });

    expect(controller.getRefreshStats().fullRenders).toBe(before.fullRenders);
    expect(root.querySelector('[data-workspace-frame="contacts"]')).toBe(frame);
    expect(root.querySelector('[data-select-variant="Hoshino"]')).toBe(row);
    expect(root.querySelector('[data-select-variant="HoshinoSwimsuit"]')).toBe(otherRow);
    expect(root.querySelector('[data-theme-host-id="rightPanel.service.contacts.inspector"] [data-character-cultivation="Hoshino"]')).toBe(cultivation);
    expect(cultivation.querySelector('[data-add-exp]')).toBe(train);
    expect(document.activeElement).toBe(train);
    expect(scrollOwner.scrollTop).toBe(83);
  });

  it('反复训练按固定经验累计升级，并在角色等级上限禁用训练', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    openHoshinoContacts();
    const train = root.querySelector<HTMLButtonElement>('[data-add-exp="Hoshino"]')!;
    const addExp = vi.spyOn(controller.commands, 'addExp');

    train.click();
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ level: 5, exp: 0 });
    train.click();
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ level: 6, exp: 500 });
    train.click();
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ level: 8, exp: 200 });
    expect(addExp).toHaveBeenCalledTimes(3);
    expect(addExp).toHaveBeenCalledWith('Hoshino', 1000);

    for (let count = 0; count < 60 && game.rosterSystem.getOwned(game.state, 'Hoshino')!.level < 30; count += 1) train.click();
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ level: 30, exp: 0 });
    expect(train.disabled).toBe(true);
    expect(cultivationField('exp').textContent).toBe('已达当前等级上限');
    const callsAtCap = addExp.mock.calls.length;
    train.click();
    expect(addExp).toHaveBeenCalledTimes(callsAtCap);
  });

  it('交流每次固定增加15好感经验并能连续升好感等级', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    openHoshinoContacts();
    const interact = root.querySelector<HTMLButtonElement>('[data-add-affection="Hoshino"]')!;
    const addAffection = vi.spyOn(controller.commands, 'addAffectionExp');

    interact.click();
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ affectionLevel: 2, affectionExp: 0 });
    interact.click();
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ affectionLevel: 2, affectionExp: 15 });
    interact.click();
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ affectionLevel: 3, affectionExp: 0 });
    expect(addAffection).toHaveBeenCalledTimes(3);
    expect(addAffection).toHaveBeenCalledWith('Hoshino', 15);
    expect(cultivationField('affection').textContent).toBe('Lv.3 / 20');
  });

  it('交流跨好感等级时通过真实EventBus订阅立即刷新当前Hoshino聊天奖励行', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    openHoshinoContacts();
    const stream = root.querySelector<HTMLElement>('[data-workspace-frame="contacts"] .conversation-stream')!;
    expect(stream.textContent).not.toContain('与 小鸟游星野 的羁绊提升至 Lv.2');

    root.querySelector<HTMLButtonElement>('[data-add-affection="Hoshino"]')!.click();

    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ affectionLevel: 2, affectionExp: 0 });
    expect(controller.panelState.studentChats.Hoshino?.some(entry => entry.text === '与 小鸟游星野 的羁绊提升至 Lv.2')).toBe(true);
    expect(root.querySelector('[data-workspace-frame="contacts"] .conversation-stream')?.textContent)
      .toContain('与 小鸟游星野 的羁绊提升至 Lv.2');
  });

  it('外部真实好感写入后立即同步通讯录培养读数，并保留培养按钮节点', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    openHoshinoContacts();
    const frame = root.querySelector('[data-workspace-frame="contacts"]');
    const row = root.querySelector('[data-select-variant="Hoshino"]');
    const cultivation = root.querySelector<HTMLElement>('[data-character-cultivation="Hoshino"]')!;
    const interact = cultivation.querySelector<HTMLButtonElement>('[data-add-affection]')!;
    expect(cultivationField('affection').textContent).toBe('Lv.1 / 20');

    game.mutations.addAffectionExp('Hoshino', 15);

    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')).toMatchObject({ affectionLevel: 2, affectionExp: 0 });
    expect(cultivationField('affection').textContent).toBe('Lv.2 / 20');
    expect(root.querySelector('[data-workspace-frame="contacts"]')).toBe(frame);
    expect(root.querySelector('[data-select-variant="Hoshino"]')).toBe(row);
    expect(root.querySelector('[data-character-cultivation="Hoshino"] [data-add-affection]')).toBe(interact);
  });

  it('突破在碎片不足时禁用，足额后只消耗本角色碎片并刷新星级', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'story');
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'story');
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'story');
    openHoshinoContacts();
    let breakthrough = root.querySelector<HTMLButtonElement>('[data-breakthrough="Hoshino"]')!;
    const otherBefore = { ...game.rosterSystem.getOwned(game.state, 'HoshinoSwimsuit')! };
    expect(game.rosterSystem.shardsOf(game.state, 'HoshinoSwimsuit')).toBe(2);
    expect(breakthrough.disabled).toBe(true);
    expect(cultivationField('breakthrough').textContent).toContain('0 / 1');

    controller.refreshPanels(['right']);
    breakthrough = root.querySelector<HTMLButtonElement>('[data-breakthrough="Hoshino"]')!;
    expect(breakthrough.disabled).toBe(true);
    expect(cultivationField('breakthrough').textContent).toContain('0 / 1');

    game.mutations.acquireCharacter('Hoshino', 'story');
    controller.refreshPanels(['right']);
    breakthrough = root.querySelector<HTMLButtonElement>('[data-breakthrough="Hoshino"]')!;
    expect(breakthrough.disabled).toBe(false);
    expect(cultivationField('breakthrough').textContent).toContain('1 / 1');
    vi.spyOn(controller.commands, 'breakthroughStar');
    breakthrough.click();

    expect(controller.commands.breakthroughStar).toHaveBeenCalledWith('Hoshino');
    expect(game.rosterSystem.getOwned(game.state, 'Hoshino')?.stars).toBe(1);
    expect(game.rosterSystem.shardsOf(game.state, 'Hoshino')).toBe(0);
    expect(game.rosterSystem.getOwned(game.state, 'HoshinoSwimsuit')).toEqual(otherBefore);
    expect(cultivationField('stars').textContent).toBe('★');
  });
});
