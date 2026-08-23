// ============================================================
// ui/components/contacts.test.ts — 通讯录 UI（U 组）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../../src/engine/game-instance';
import type { Datapack } from '../../../src/engine/types';
import { and, Character, CharacterRarity, CharacterSchool, GachaMode } from '../../../src/engine/types';
import { extra } from '../../../src/engine/extra/index';
import { baseDatapack } from '../../../src/data/index';
import { createUIContext } from '../../../src/ui/context';
import { renderChatHistory } from '../../../src/ui/components/story';
import { ChatStream } from '../../../src/ui/chat-stream';
import { renderProductionNodes } from '../../../src/ui/components/production';
import {
  renderContactsTab,
  renderConversationView,
  renderCharacterPanel,
  renderGachaBody,
  renderSpotGachaBody,
  bondStoriesOf,
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
    characterBonuses: [],
    characterVariants: [
      { id: 'Hoshino', proto: Character.Hoshino, name: '星野', displayName: '小鸟游星野', school: CharacterSchool.Abydos, rarity: CharacterRarity.Rare, description: '' },
      { id: 'Serika', proto: Character.Serika, name: '芹香', displayName: '黑见芹香', school: CharacterSchool.Abydos, rarity: CharacterRarity.Common, description: '' },
      { id: 'Yuuka', proto: Character.Yuuka, name: '优香', displayName: '早濑优香', school: CharacterSchool.Millennium, rarity: CharacterRarity.Rare, description: '' },
    ],
    gachaPools: [
      {
        id: 'pool-1',
        name: '测试池',
        mode: GachaMode.BaClassic,
        currency: 'base:resource:pyroxene',
        costPerPull: 120,
        rates: [{ rarity: CharacterRarity.Rare, weight: 1 }],
        members: ['Hoshino'],
        closeWhen: { target: 'flag', key: 'event_over', comparator: '>=', value: 1 },
      },
    ],
    colors: [
      { id: 'color-a', name: '苍蓝', theme: { primary: '#3b82f6' }, unlock: { target: 'flag', key: 'unlock_a', comparator: '>=', value: 1 } },
    ],
    chatMessages: [
      { id: 'msg-1', owner: 'Hoshino', order: 1, content: '老师，早。' },
      { id: 'msg-2', owner: 'Hoshino', order: 2, content: '今天也要加油哦。' },
      { id: 'msg-locked', owner: 'Hoshino', order: 3, content: '隐藏消息', unlock: { target: 'flag', key: 'never', comparator: '>=', value: 1 } },
      { id: 'msg-other', owner: 'Yuuka', order: 1, content: '优香的消息' },
    ],
    activeStories: [
      {
        id: 'bond:hoshino_1',
        storyId: 'bond:hoshino_1',
        type: 'active',
        triggerCondition: and(),
        availableInits: [],
        replayable: true,
        extra: extra.dict({ owner: extra.str('Hoshino') }),
      },
    ],
    stories: [
      {
        id: 'bond:hoshino_1',
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

    const sendState = game.getSendState();
    const conv = renderConversationView(ctx, 'Hoshino', [], sendState);
    expect(conv).toContain('小鸟游星野'); // 顶部栏标题
    expect(conv).toContain('data-conversation-back'); // App 式返回键
    expect(conv).toContain('羁绊剧情'); // 手动进入按钮
    expect(renderChatHistory([], ctx)).toContain('还没有对话记录'); // 空语境

    // 未选择：占位文案
    expect(renderCharacterPanel(ctx, null)).toContain('未选择学生');
  });

  test('U-02b 羁绊剧情入口：extra.owner 声明归属，手动点击进入', () => {
    // base 数据包为 Hoshino 声明了羁绊剧情
    const bonds = bondStoriesOf(game, 'Hoshino');
    expect(bonds.length).toBeGreaterThan(0);
    // 其他学生没有
    expect(bondStoriesOf(game, 'Yuuka')).toHaveLength(0);
    // 经 startActiveStory 手动进入后，演出走一般 Story 流程
    const started = game.startActiveStory(bonds[0].id);
    expect(started.success).toBe(true);
    const view = game.getView().currentStory!;
    expect(view.storyDefId).toBe(bonds[0].storyId);
  });

  test('U-03 聊天已读标记走 StateMutationService（幂等）', () => {
    let events = 0;
    game.eventBus.on('chatReadChanged', () => events++);
    game.mutations.markChatRead('msg-1');
    expect(events).toBe(1);
    game.mutations.markChatRead('msg-1');
    expect(events).toBe(1); // 幂等
  });

  test('U-04 主题切换：activeColor → token 表输出', () => {
    game.mutations.setFlag('unlock_a', '1');
    // setFlag 经 flagChanged 事件自动 recheck 解锁（行为闭环），手动再解锁为幂等
    expect(game.colorSystem.tryUnlock('color-a')).toBe('already');
    game.mutations.activateTheme('color-a');
    const tokens = game.colorSystem.activeThemeTokens(game.state);
    expect(tokens?.['primary']).toBe('#3b82f6');
    const html = renderContactsTab(createUIContext(game), null);
    expect(html).toContain('data-activate-color="color-a"'); // swatch 可点
    expect(html).toMatch(/theme-swatch active/); // 激活态标记
  });

  test('U-05 池界面可及性：开放池显示成员，关闭池标记并禁抽', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100000);
    let body = renderGachaBody(createUIContext(game));
    expect(body).toContain('测试池');
    expect(body).toContain('data-gacha="pool-1"'); // 单抽按钮（count 为独立属性）

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
        storyId: 'bond:hoshino_1',
        type: 'passive',
        weight: 1,
        triggerCondition: and(),
        availableInits: [],
        block: and({ target: 'flag', key: 'met_at_rooftop', comparator: '>=', value: 1 }),
      };
      (game.registry.passiveStories as Map<string, unknown>).set(BLOCK_ENTRY_ID, entry);
      game.mutations.setStudentBlock('Hoshino', BLOCK_ENTRY_ID);
    });

    test('U-08 阻断态：条件未满足时渲染锁定横幅而非发送按钮', () => {
      const sendState = game.getSendState();
      const html = renderConversationView(createUIContext(game), 'Hoshino', [], sendState);
      expect(html).toContain('conversation-blocked'); // 锁定横幅
      expect(html).toContain('对话空间已锁定'); // 提示文案
      expect(html).toContain('标记「met_at_rooftop」≥1'); // describeCondition 输出
      expect(html).not.toContain('data-send'); // 未渲染发送按钮
    });

    test('U-09 解除：满足 block 条件后横幅消失，恢复发送按钮', () => {
      game.mutations.setFlag('met_at_rooftop', '1');
      const sendState = game.getSendState();
      const html = renderConversationView(createUIContext(game), 'Hoshino', [], sendState);
      expect(html).not.toContain('conversation-blocked'); // 横幅消失
      expect(html).toContain('data-send'); // 发送按钮恢复
    });
  });
});

describe('对话空间流壁垒（ChatStream 隔离外部故事）', () => {
  let game: GameInstance;
  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame('base:init:schale_office');
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const r = game.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.advanceStory(0);
    }
  });

  function panel(conv: string | null) {
    return { conversationVariantId: conv, studentChats: {} as Record<string, any[]>, chatEntries: [] as any[] } as any;
  }

  test('外部故事进行中，打开角色空间不把其页同步进角色流（不意外继续外部内容）', () => {
    // 在一般聊天触发一个无 owner 的外部被动闲聊（作为进行中故事）
    const r = game.triggerPassiveStory('base:init:schale_office'); // owner=null → 全局
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
    game.startNewGame('base:init:schale_office');
    let guard = 0;
    while (game.getView().currentStory && guard++ < 50) {
      const r = game.advanceStory();
      if (!r.success && 'error' in r && r.error === 'ChoiceRequired') game.advanceStory(0);
    }
  });

  test('信用点制造机渲染"招募"按钮（gacha 功能）', () => {
    const html = renderProductionNodes(createUIContext(game));
    expect(html).toContain('data-open-spot-gacha="base:spot:credit_printer"');
    expect(html).toContain('招募');
    // 弹窗体默认开放通用卡池（无专有池声明）
    const body = renderSpotGachaBody(createUIContext(game), 'base:spot:credit_printer');
    expect(body).toContain('data-scope="global"');
    expect(body).toContain('常规招募'); // 全局卡池 base:pool:regular
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
