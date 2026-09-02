// ============================================================
// engine/def-factory/story.test.ts — StoryDef Builder + 紧凑 talklet 自由函数
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  story,
  StoryBuilder,
  line,
  narrate,
  click,
  talklet,
} from '../../../src/arona-clicker/content/def-factory';
import { Resource } from '../../../src/arona-clicker/types/ids';
import type { StoryDef } from '../../../src/data-services/contracts/story';

const CREDIT = Resource.Credit;

describe('StoryBuilder', () => {
  test('story() 返回 StoryBuilder 实例', () => {
    expect(story('base:story:x', '标题')).toBeInstanceOf(StoryBuilder);
  });

  test('scene() 接受 TalkletBuilder 自动 build（schale_welcome 片段参照）', () => {
    const def = story('base:story:schale_welcome', '欢迎来到夏莱')
      .scene(
        narrate('—— 夏莱办公室 · 清晨 ——', 'center'),
        line('阿罗娜', '欢迎回来，老师。夏莱的设备已经准备好了。', '设备准备完毕，可以开始调度。', { mute: true }),
        line('老师', '那就先把这里运转起来吧。'),
        click('Arona检查了一下......。', 4, 2),
      )
      .build();
    expect(def).toEqual<StoryDef>({
      id: 'base:story:schale_welcome',
      name: '欢迎来到夏莱',
      talklets: [
        { kind: 'narration', align: 'center', text: '—— 夏莱办公室 · 清晨 ——' },
        { speaker: '阿罗娜', text: '欢迎回来，老师。夏莱的设备已经准备好了。', sendText: '设备准备完毕，可以开始调度。', muteReply: true },
        { speaker: '老师', text: '那就先把这里运转起来吧。' },
        { kind: 'click', text: 'Arona检查了一下......。', clickWork: { base: 4, rand: 2 } },
      ],
    });
  });

  test('scene() 可混入已构建的 Talklet，并继续链 choice/effects', () => {
    const built = talklet('已构建页').speaker('星野').build();
    const def = story('s', 't')
      .scene(
        built,
        line('老师', '选项页').choice('选一', { op: 'setFlag', target: 'f', value: '1' }),
        line('阿罗娜', '结算页').effects({ op: 'addResource', target: CREDIT, value: 10 }),
      )
      .build();
    expect(def.talklets).toHaveLength(3);
    expect(def.talklets[0]).toBe(built);
    expect(def.talklets[1].choices).toEqual([{ text: '选一', effects: [{ op: 'setFlag', target: 'f', value: '1' }] }]);
    expect(def.talklets[2].effects).toEqual([{ op: 'addResource', target: CREDIT, value: 10 }]);
  });

  test('line() 的 opts 映射与缺省', () => {
    const b = line('星野', 'hi', undefined, { noAvatar: true });
    expect(b.build()).toEqual({ speaker: '星野', text: 'hi', noAvatar: true });
    const b2 = line('星野', 'hi');
    expect(b2.build()).toEqual({ speaker: '星野', text: 'hi' });
  });

  test('extra 与空 scene', () => {
    const def = story('s', 't').extra({ t: 'dict', v: { tier: { t: 'int', v: 1 } } }).build();
    expect(def.extra).toEqual({ t: 'dict', v: { tier: { t: 'int', v: 1 } } });
    expect(def.talklets).toEqual([]);
  });
});

describe('紧凑自由函数', () => {
  test('narrate 缺省居中，click 缺省 rand', () => {
    expect(narrate('—— 夜间 ——').build()).toEqual({ kind: 'narration', align: 'center', text: '—— 夜间 ——' });
    expect(click('点我', 3).build()).toEqual({ kind: 'click', text: '点我', clickWork: { base: 3 } });
  });
});
