// ============================================================
// engine/def-factory/talklet.test.ts — Talklet 链式 Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import { talklet, TalkletBuilder } from '../../../src/arona-clicker/content/def-factory';
import { Resource } from '../../../src/arona-clicker/types/ids';
import type { Talklet } from '../../../src/data-services/contracts/story';

const CREDIT = Resource.Credit;

describe('TalkletBuilder', () => {
  test('talklet() 返回 TalkletBuilder 实例', () => {
    expect(talklet('你好')).toBeInstanceOf(TalkletBuilder);
  });

  test('最小 talk（缺省 kind=talk）', () => {
    const def = talklet('你好').build();
    expect(def).toEqual<Talklet>({ text: '你好' });
  });

  test('缺 text 时 build() 抛错', () => {
    expect(() => new TalkletBuilder('').build()).toThrow(/text/);
  });

  test('narration / click / 带回复与效果等价于字面量（schale_welcome 参照）', () => {
    const def = talklet('设备准备完毕，可以开始调度。').speaker('阿罗娜').sendText('设备准备完毕，可以开始调度。').muteReply().build();
    expect(def).toEqual<Talklet>({
      speaker: '阿罗娜',
      text: '设备准备完毕，可以开始调度。',
      sendText: '设备准备完毕，可以开始调度。',
      muteReply: true,
    });

    const narr = talklet('—— 夏莱办公室 · 清晨 ——').narrate('center').build();
    expect(narr).toEqual<Talklet>({ kind: 'narration', align: 'center', text: '—— 夏莱办公室 · 清晨 ——' });

    const click = talklet('Arona检查了一下……。').click(4, 2).build();
    expect(click).toEqual<Talklet>({ kind: 'click', text: 'Arona检查了一下……。', clickWork: { base: 4, rand: 2 } });
  });

  test('choices / choiceJump 与效果', () => {
    const def = talklet('清单确认完毕，可以开始调度了。')
      .speaker('老师')
      .choice('从整理办公室开始', { op: 'setFlag', target: 'welcome_choice', value: 'office' })
      .choiceJump('亲自上手调试', 'base:story:millennium_game_crisis_debug', 'goto', {
        op: 'setFlag', target: 'game_crisis_route', value: 'debug',
      })
      .build();
    expect(def.choices).toEqual([
      { text: '从整理办公室开始', effects: [{ op: 'setFlag', target: 'welcome_choice', value: 'office' }] },
      {
        text: '亲自上手调试',
        effects: [{ op: 'setFlag', target: 'game_crisis_route', value: 'debug' }],
        jumpToStory: 'base:story:millennium_game_crisis_debug',
        jumpMode: 'goto',
      },
    ]);
  });

  test('jump / noAvatar / effects / kizunaCard', () => {
    const jump = talklet('其实姐姐昨天偷偷哭了一场……她压力很大的。').speaker('美依').noAvatar().jump('base:story:millennium_game_crisis_end', 'insert').build();
    expect(jump).toEqual<Talklet>({
      speaker: '美依',
      text: '其实姐姐昨天偷偷哭了一场……她压力很大的。',
      noAvatar: true,
      jumpToStory: 'base:story:millennium_game_crisis_end',
      jumpMode: 'insert',
    });

    const eff = talklet('好的。设备会在每个 Tick 自动结算。').effects(
      { op: 'addResource', target: CREDIT, value: 10 },
      { op: 'addItem', target: 'base:item:energy_drink', value: 1 },
    ).build();
    expect(eff.effects).toHaveLength(2);

    const kiz = talklet('——星野似乎有话想说……——').narrate().build();
    expect(kiz).toEqual<Talklet>({ kind: 'narration', align: 'center', text: '——星野似乎有话想说……——' });
  });

  test('kizunaCard 构造羁绊卡片', () => {
    const def = talklet('羁绊邀请').kizunaCard('base:story:bond_hoshino_1', { title: '午后的堤防', buttonText: '进入羁绊剧情' }).build();
    expect(def.kizuna).toEqual({
      storyId: 'base:story:bond_hoshino_1',
      title: '午后的堤防',
      buttonText: '进入羁绊剧情',
    });
  });

  test('未调用可选 setter 时不输出该字段', () => {
    const def = talklet('x').build();
    expect(def).not.toHaveProperty('speaker');
    expect(def).not.toHaveProperty('kind');
    expect(def).not.toHaveProperty('effects');
    expect(def).not.toHaveProperty('choices');
    expect(def).not.toHaveProperty('sendText');
  });
});
