// ============================================================
// ui/components/chat-image.test.ts — 聊天流图片与头像（pic 系统集成）
// 覆盖：base 数据包图片索引解析 / 聊天流条目图片渲染 / 未解析索引降级
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../../src/engine/game-instance';
import { baseDatapack } from '../../../src/data/index';
import { createUIContext } from '../../../src/ui/context';
import { renderChatHistory, type ChatEntry } from '../../../src/ui/components/story';

describe('聊天流图片与头像（pic 系统集成）', () => {
  let ctx: ReturnType<typeof createUIContext>;

  beforeEach(() => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.stop();
    ctx = createUIContext(game);
  });

  const talkEntry = (overrides: Partial<ChatEntry> = {}): ChatEntry[] => [
    {
      id: 1,
      kind: 'talk',
      speaker: '小鸟游星野',
      text: '看我拍的照片！',
      avatar: 'base:avatar(pic):hoshino',
      image: 'base:sticker(pic):hoshino_selfie',
      timestamp: 0,
      ...overrides,
    },
  ];

  test('base 数据包图片索引解析为可显示 URL', () => {
    expect(ctx.game.pics.urlOf('base:avatar(pic):hoshino')).toBeTruthy();
    expect(ctx.game.pics.urlOf('base:sticker(pic):hoshino_selfie')).toBeTruthy();
    // 未声明的索引返回 undefined
    expect(ctx.game.pics.urlOf('base:sticker(pic):missing')).toBeUndefined();
  });

  test('星野默认差分 avatar 已接线到 pics 表', () => {
    const variant = ctx.game.registry.characterVariants.get('Hoshino');
    expect(variant?.avatar).toBe('base:avatar(pic):hoshino');
  });

  test('聊天流条目：pic 索引解析后渲染为 <img class="chat-image">（含头像）', () => {
    const html = renderChatHistory(talkEntry(), ctx);
    expect(html).toContain('chat-image');
    expect(html).toContain('src="');
    expect(html).toContain('看我拍的照片！');
    // 头像也经 getPicUrl 解析成真实 src，而非原样 pic 索引
    expect(html).not.toContain('src="base:avatar(pic):hoshino"');
  });

  test('未解析的图片索引不渲染 <img>（降级为纯文本气泡）', () => {
    const html = renderChatHistory(
      talkEntry({ image: 'mod:sticker(pic):missing' }),
      ctx,
    );
    expect(html).not.toContain('chat-image');
    expect(html).toContain('看我拍的照片！');
  });

  test('无图片条目不渲染 <img>', () => {
    const html = renderChatHistory(talkEntry({ image: undefined }), ctx);
    expect(html).not.toContain('chat-image');
  });

  test('无图片角色（阿罗娜）说话：回退渲染 ColorGroup 抽象头像 SVG', () => {
    const arona = ctx.game.registry.characterVariants.get('Arona');
    expect(arona?.colorGroupId).toBe('base:colorgroup:schale-solid'); // 数据已接线
    expect(arona?.avatar).toBeUndefined();
    const html = renderChatHistory(
      [{ id: 1, kind: 'talk', speaker: '阿罗娜', text: '你好，老师！', timestamp: 0 }],
      ctx,
    );
    // 渲染 SVG 抽象头像，而非 <img> 或首字母占位
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('chat-avatar-fallback');
  });

  test('说话人 displayName / 角色 id 均可匹配到 ColorGroup 头像', () => {
    // id 匹配（如聊天流 ChatMessageDef.owner 使用 Character id）
    const byId = renderChatHistory(
      [{ id: 1, kind: 'talk', speaker: 'Yuuka', text: '预算请省着点用。', timestamp: 0 }],
      ctx,
    );
    expect(byId).toContain('<svg');
    // displayName 匹配（如 talklet.speaker 使用中文显示名）
    const byDisplay = renderChatHistory(
      [{ id: 1, kind: 'talk', speaker: '早濑优香', text: '预算请省着点用。', timestamp: 0 }],
      ctx,
    );
    expect(byDisplay).toContain('<svg');
  });

  test('星野自拍 story 的 talklet 携带 avatar + image', () => {
    const story = ctx.game.registry.stories.get('base:story:hoshino_selfie');
    expect(story).toBeDefined();
    expect(story!.talklets[0].avatar).toBe('base:avatar(pic):hoshino');
    expect(story!.talklets[0].image).toBe('base:sticker(pic):hoshino_selfie');
  });
});
