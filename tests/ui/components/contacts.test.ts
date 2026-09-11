import type { Datapack } from '../../../src/data-services/contracts/datapack';
// ============================================================
// ui/components/contacts.test.ts — 通讯录 UI（U 组）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime-game-instance';
import type { } from '../../../src/engine/types';
import { and } from '../../../src/engine/types';
import { GachaMode } from '../../../src/data-services/contracts/gacha-pool';
import { Character, CharacterRarity, CharacterSchool } from '../../../src/arona-clicker/types/ids';
import { extra } from '../../../src/engine/extra/index';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/context';
import { renderChatHistory, renderCurrentStory } from '../../../src/ui/components/story';
import { renderSendButton } from '../../../src/ui/components/center-panel';
import { ChatStream } from '../../../src/ui/chat-stream';
import { renderProductionNodes } from '../../../src/ui/components/production';
import {
  renderContactsTab,
  renderConversationBody,
  renderConversationView,
  renderCharacterPanel,
  renderGachaBody,
  renderSpotGachaBody,
} from '../../../src/ui/components/contacts';

function makeDatapack(): Datapack {
  return {
    name: 'test',
    version: '0',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
    passiveStories: [],
    items: [],
    funcletDefs: [],
    characters: [],
    characterVariants: [
      { id: 'Hoshino', proto: Character.Hoshino, name: '星野', displayName: '小鸟游星野', school: CharacterSchool.Abydos, rarity: CharacterRarity.Rare, description: '' },
      { id: 'Serika', proto: Character.Serika, name: '芹香', displayName: '黑见芹香', school: CharacterSchool.Abydos, rarity: CharacterRarity.Common, description: '' },
      { id: 'Yuuka', proto: Character.Yuuka, name: '优香', displayName: '早濑优香', school: CharacterSchool.Millennium, rarity: CharacterRarity.Rare, description: '' },
    ],
    gachaPools: [
      {
        id: 'test:gachapool:pool-1',
        name: '测试池',
        mode: GachaMode.BaClassic,
        currency: 'base:resource:pyroxene',
        costPerPull: 120,
        rates: [{ rarity: CharacterRarity.Rare, weight: 1 }],
        members: ['Hoshino'],
        closeWhen: { target: 'flag', key: 'event_over', comparator: '>=', value: 1 },
      },
    ],
    colorGroups: [
      { id: 'test:colorgroup:color-a', name: '苍蓝', compositionType: 'solid', slots: [{ role: 'primary', color: '#3b82f6' }], unlock: { target: 'flag', key: 'unlock_a', comparator: '>=', value: 1 } },
      { id: 'test:colorgroup:group-a', name: '组A', compositionType: 'solid', slots: [{ role: 'primary', color: '#3b82f6' }] },
    ],
    colorEquipments: [
      {
        id: 'test:colorequipment:equip-a',
        name: '装备A',
        colorGroupId: 'test:colorgroup:group-a',
        effects: [{ op: 'addResource', target: 'credit', value: 1 }],
        unlock: { target: 'flag', key: 'equip_a', comparator: '>=', value: 1 },
      },
    ],
    activeStories: [
      {
        id: 'test:story:bond_hoshino_1',
        storyId: 'test:story:bond_hoshino_1',
        type: 'active',
        triggerCondition: and(),
        availableInits: [],
        owner: 'Hoshino',
      },
    ],
    stories: [
      {
        id: 'test:story:bond_hoshino_1',
        name: '羁绊剧情 · 星野：测试',
        talklets: [
          { kind: 'narration', align: 'center', text: '——测试——' },
          { speaker: '星野', text: '老师……' },
        ],
      },
    ],
  };
}

describe('通讯录 UI（U 组）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
  });

  test('U-01 通讯录渲染：分组来自持有数据，未获得显示占位', () => {
    const html = renderContactsTab(createUIContext(game), null);
    expect(html).toContain('阿比多斯'); // 学校分组
    expect(html).toContain('小鸟游星野'); // 已获得
    expect(html).not.toContain('黑见芹香'); // 未获得的差分不出现在列表
    expect(html).toMatch(/未获得/); // 占位区
    expect(html).not.toContain('招募补给'); // 招募入口已迁至 Spot
    expect(renderGachaBody(createUIContext(game))).toContain('测试池'); // 通用卡池仍可渲染
  });

  test('U-02 选中联动：对话空间与培养面板按选中差分渲染，全部只读', () => {
    const ctx = createUIContext(game);
    const panel = renderCharacterPanel(ctx, 'Hoshino');
    expect(panel).toContain('Lv.1');
    expect(panel).toContain('累计获得');

    const sendState = game.story.getSendState();
    const conv = renderConversationView(ctx, 'Hoshino', [], [], sendState);
    expect(conv).toContain('小鸟游星野'); // 顶部栏标题
    expect(conv).toContain('conversation-pane panel-body'); // 对话空间遵循统一 Panel 内容契约
    expect(conv).toContain('panel-tabs-region'); // 顶部栏复用统一结构区块（对齐 + 渲染色）
    expect(conv).toContain('data-theme-host-id="centerPanel.tabs"'); // 与聊天/日志顶栏同一宿主
    expect(conv).toContain('data-conversation-back'); // App 式返回键
    expect(conv).toContain('data-send'); // 底部回复按钮（idle 态）
    const embeddedConv = renderConversationBody(ctx, 'Hoshino', [], [], sendState);
    expect(embeddedConv).toContain('ui-cluster ui-cluster--center-chat panel-body character-workspace__conversation');
    expect(embeddedConv).not.toContain('panel-tabs-region'); // Workspace 外层已提供唯一顶栏
    expect(embeddedConv).not.toContain('conversation-heading');
    expect(embeddedConv).toContain('data-send');
    expect(renderChatHistory([], ctx)).toContain('还没有对话记录'); // 空语境

    // 未选择：占位文案
    expect(renderCharacterPanel(ctx, null)).toContain('未选择学生');
  });

  test('U-02b 羁绊剧情入口：ActiveStoryEntry.owner 声明归属，卡片启动 = goto 重开', () => {
    // base 数据包为 Hoshino 声明了羁绊剧情（active entry，owner='Hoshino'）
    const entry = game.registry.activeStories.get('test:story:bond_hoshino_1')!;
    expect(entry).toBeDefined();
    expect(entry.owner).toBe('Hoshino');
    // 经 startCardStory 触发（清游标 + skipConditions 的 goto 语义）
    const started = game.story.startCardStory('test:story:bond_hoshino_1');
    expect(started.success).toBe(true);
    const view = game.getView().currentStory!;
    expect(view.storyDefId).toBe('test:story:bond_hoshino_1');
    // 完成后再次触发 → goto 重开成功（force 跳过 AlreadyCompleted，isReplay=false 分支自由）
    let guard = 0;
    while (game.getView().currentStory && guard++ < 20) {
      const r = game.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.story.advanceStory(0);
    }
    expect(game.getView().currentStory).toBeNull();
    const retry = game.story.startCardStory('test:story:bond_hoshino_1');
    expect(retry.success).toBe(true);
    expect(game.getView().currentStory?.pageIndex).toBe(0);
  });

  test('U-02c 羁绊卡片渲染：kizuna 卡片进流渲染，底部按钮变灰', () => {
    const ctx = createUIContext(game);
    // 构造带 kizuna 页的 StoryView，验证 renderCurrentStory 在流内渲染的 yuzu-kizuna 结构
    const story = {
      storyId: 'test:entry',
      type: 'active' as const,
      storyDefId: 'base:story:bond_hoshino_evening',
      pageIndex: 0,
      totalPages: 1,
      availableChoiceIndexes: [],
      page: {
        kind: 'talk' as const,
        speaker: '星野',
        text: '星野酝酿了一下情绪……',
        kizuna: {
          storyId: 'base:activestory:bond_hoshino_evening',
          title: '傍晚的河堤',
          buttonText: '进入羁绊剧情',
          align: 'right' as const,
        },
      },
    };
    const html = renderCurrentStory(ctx as any, story as any);
    expect(html).toContain('yuzu-kizuna-item');
    expect(html).toContain('yuzu-kizuna-header');
    expect(html).toContain('yuzu-kizuna-heart');
    expect(html).toContain('yuzu-kizuna-footer');
    expect(html).toContain('data-kizuna="base:activestory:bond_hoshino_evening"');
    expect(html).toContain('傍晚的河堤');
    expect(html).toContain('进入羁绊剧情');
    expect(html).toContain('<svg');
    expect(html).toContain('align-right');

    // 底部回复按钮：kizuna 模式下变灰不可点，提示点击卡片
    const kizunaState = {
      mode: 'kizuna' as const,
      storyId: 'test:story',
      pageIndex: 0,
      targetStoryId: 'test:bond',
      title: '测试羁绊',
      buttonText: '进入羁绊剧情',
      align: 'left' as const,
    };
    const btnHtml = renderSendButton(kizunaState);
    expect(btnHtml).toContain('send-button disabled');
    expect(btnHtml).toContain('disabled');
    expect(btnHtml).toContain('请点击羁绊卡片');
  });

  test('U-03 聊天已读标记走 StateMutationService（幂等）', () => {
    let events = 0;
    game.eventBus.on('chatReadChanged', () => events++);
    game.mutations.markChatRead('msg-1');
    expect(events).toBe(1);
    game.mutations.markChatRead('msg-1');
    expect(events).toBe(1); // 幂等
  });

  test('U-04 主题切换：activeTheme → token 表输出', () => {
    game.mutations.setFlag('unlock_a', '1');
    // setFlag 经 flagChanged 事件自动 recheck 解锁（行为闭环），手动再解锁为幂等
    expect(game.colorSystem.tryUnlockGroup('test:colorgroup:color-a')).toBe('already');
    game.mutations.activateTheme('test:colorgroup:color-a');
    const tokens = game.colorSystem.activeThemeTokens(game.state);
    expect(tokens?.['primary']).toBe('#3b82f6');
    const html = renderContactsTab(createUIContext(game), null);
    expect(html).toContain('data-activate-group="test:colorgroup:color-a"'); // swatch 可点
    expect(html).toMatch(/theme-swatch active/); // 激活态标记
  });

  test('U-04b 用户自定义主题作为独立选项显示并保持单一 active', () => {
    game.mutations.setUserTheme({ version: 1, tokens: { primary: '#123456' } }, true);
    const html = renderContactsTab(createUIContext(game), null);
    expect(html).toContain('data-activate-custom-theme="user:theme:default"');
    expect(html).toContain('自定义 · 自定义主题');
    expect(html).toContain('aria-pressed="true"');

    game.mutations.activateTheme(null);
    const systemHtml = renderContactsTab(createUIContext(game), null);
    expect(systemHtml).toContain('data-activate-custom-theme="user:theme:default"');
    expect(systemHtml).toContain('aria-pressed="false"');
  });

  test('U-10 装备面板：收集后渲染装备卡片，装备后头像换为 SVG 圆', () => {
    game.mutations.setFlag('equip_a', '1');
    // setFlag 经 flagChanged 事件自动 recheck 收集（行为闭环）
    expect(game.colorEquipmentSystem.isOwned(game.state, 'test:colorequipment:equip-a')).toBe(true);
    // 收集即级联解锁其引用的 ColorGroup（group-a）
    expect(game.colorSystem.isGroupOwned(game.state, 'test:colorgroup:group-a')).toBe(true);

    const panel = renderCharacterPanel(createUIContext(game), 'Hoshino');
    expect(panel).toContain('data-equip-equipment="test:colorequipment:equip-a"'); // 可装备列表项
    expect(panel).toContain('色彩装备');

    // 装备后：面板渲染已装备卡片（含卸下按钮），通讯录行头像换为 SVG 圆
    expect(game.mutations.equipEquipment('Hoshino', 'test:colorequipment:equip-a').ok).toBe(true);
    const panel2 = renderCharacterPanel(createUIContext(game), 'Hoshino');
    expect(panel2).toContain('data-unequip-equipment');
    const tab = renderContactsTab(createUIContext(game), null);
    expect(tab).toContain('<svg'); // 装备驱动头像
    // 未拥有不可装备
    expect(game.mutations.equipEquipment('Hoshino', 'equip-missing').ok).toBe(false);
  });

  test('U-05 池界面可及性：开放池显示成员，关闭池标记并禁抽', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100000);
    let body = renderGachaBody(createUIContext(game));
    expect(body).toContain('测试池');
    expect(body).toContain('data-gacha="test:gachapool:pool-1"'); // 单抽按钮（count 为独立属性）

    game.mutations.setFlag('event_over', '1');
    game.availabilityService.refreshWorldPool();
    body = renderGachaBody(createUIContext(game));
    expect(body).toMatch(/池已关闭/);
    expect(body).not.toContain('data-gacha='); // 关闭后无抽取按钮
  });

  test('U-06 列表项 IM 化：消息预览 + 未读徽标（预留接口）', () => {
    const chats = [
      { id: 'c1', kind: 'talk', text: '老师，今天也要加油哦。', isPlayer: false, timestamp: 0 },
    ] as any;
    const html = renderContactsTab(createUIContext(game), null, { Hoshino: chats }, () => 3);
    expect(html).toContain('contact-line2'); // 两行式 IM 结构
    expect(html).toContain('老师，今天也要加油哦。'); // 最近消息预览
    expect(html).toContain('contact-unread'); // 未读徽标渲染
    expect(html).toContain('>3<'); // 未读数
  });

  test('U-07 空态卡片：无任何学生时显示美化引导', () => {
    const emptyGame = new GameInstance();
    emptyGame.init([{ ...makeDatapack() }]);
    // 不获得任何角色；清空变体使未获得占位也为空
    (emptyGame.registry.characterVariants as Map<string, unknown>).clear();
    const html = renderContactsTab(createUIContext(emptyGame), null);
    expect(html).toContain('contacts-empty'); // 空态卡片
    expect(html).toContain('还没有获得任何学生');
    expect(html).not.toContain('contact-group'); // 无分组
  });

  describe('对话空间壁垒·阻断横幅（UI 验收）', () => {
    const BLOCK_ENTRY_ID = 'passive:ui_block_demo';

    beforeEach(() => {
      // 注入一条声明 block 条件的 PassiveStoryEntry（阻断条件：flag met_at_rooftop ≥ 1）
      const entry: any = {
        id: BLOCK_ENTRY_ID,
        storyId: 'test:story:bond_hoshino_1',
        type: 'passive',
        weight: 1,
        triggerCondition: and(),
        availableInits: [],
        block: and({ target: 'flag', key: 'met_at_rooftop', comparator: '>=', value: 1 }),
      };
      (game.registry.passiveStories as Map<string, unknown>).set(BLOCK_ENTRY_ID, entry);
      game.mutations.setStudentBlock('Hoshino', BLOCK_ENTRY_ID);
    });

    test('U-08 阻断态：条件未满足时渲染灰色锁定按钮', () => {
      const sendState = game.story.getSendState();
      const html = renderConversationView(createUIContext(game), 'Hoshino', [], [], sendState);
      expect(html).toContain('send-button disabled'); // 灰色锁定按钮
      expect(html).toContain('对话空间已锁定'); // 提示文案
      expect(html).toContain('标记「met_at_rooftop」≥1'); // describeCondition 输出
      expect(html).not.toContain('data-send'); // 未渲染可点发送按钮
    });

    test('U-09 解除：满足 block 条件后锁定消失，恢复发送按钮', () => {
      game.mutations.setFlag('met_at_rooftop', '1');
      const sendState = game.story.getSendState();
      const html = renderConversationView(createUIContext(game), 'Hoshino', [], [], sendState);
      expect(html).not.toContain('send-button disabled'); // 锁定消失
      expect(html).toContain('data-send'); // 发送按钮恢复
    });
  });
});

describe('对话空间流壁垒（ChatStream 隔离外部故事）', () => {
  let game: GameInstance;
  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const r = game.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.story.advanceStory(0);
    }
  });

  function panel(conv: string | null) {
    return { conversationVariantId: conv, studentChats: {} as Record<string, any[]>, chatEntries: [] as any[] } as any;
  }

  test('外部故事进行中，打开角色空间不把其页同步进角色流（不意外继续外部内容）', () => {
    // 在一般聊天触发一个无 owner 的外部被动闲聊（作为进行中故事）
    const r = game.story.triggerPassiveStory('base:init:schale_office'); // owner=null → 全局
    expect(r.success).toBe(true);
    expect(game.getView().currentStory).toBeTruthy();

    const chat = new ChatStream();
    const conv = panel('Hoshino');
    chat.syncCurrentStory(conv, game);
    // 外部故事不得被同步进星野对话空间流
    expect(conv.studentChats['Hoshino'] ?? []).toHaveLength(0);
  });
});

describe('夏莱办公室 gacha Spot（生产面板招募入口）', () => {
  let game: GameInstance;
  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const r = game.story.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.story.advanceStory(0);
    }
  });

  test('信用点制造机渲染"招募"按钮（gacha 功能）', () => {
    const html = renderProductionNodes(createUIContext(game));
    expect(html).toContain('data-open-spot-gacha="base:spot:credit_printer"');
    expect(html).toContain('招募');
    // 弹窗体默认开放通用卡池（无专有池声明）
    const body = renderSpotGachaBody(createUIContext(game), 'base:spot:credit_printer');
    expect(body).toContain('data-scope="global"');
    expect(body).toContain('常规招募'); // 全局卡池 base:gachapool:regular
  });

  // 需求2：离开对话空间后 selectedVariantId=null → 通讯录无 active 高亮（渲染层验证）
  test('通讯录：selectedVariantId=null 时无 active 高亮；选中该学生时高亮', () => {
    // 确保 Hoshino 已被拥有，通讯录会渲染其条目
    game.mutations.acquireCharacter('Hoshino', 'story');
    const ctx = createUIContext(game);
    const idle = renderContactsTab(ctx, null);
    expect(idle).not.toContain('contact-row active');
    const selected = renderContactsTab(ctx, 'Hoshino');
    expect(selected).toContain('contact-row active');
  });
});
