import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/pics.test.ts — 图片资产存储与索引（PicDef / ImageStore / 解析器）
// ============================================================
import { describe, test, expect, beforeAll } from 'vitest';
import {
  parsePicId,
  buildPicId,
  isPicRef,
  isDirectUrl,
  isZipPicSrc,
  zipPathOf,
} from '../../src/data-services/contracts/pic';
import { ImageStore, resolvePicSrc } from '../../src/data-services';
import { Registry } from '../../src/data-services/registry/registry';
import { RegistryError } from '../../src/data-services/registry/registry-validate';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { } from '../../src/engine/types';

describe('parsePicId / buildPicId / isPicRef', () => {
  test('标准三段式解析', () => {
    const r = parsePicId('base:avatar(pic):hoshino');
    expect(r).toEqual({ mod: 'base', type: 'avatar', id: 'hoshino' });
  });

  test('含连字符/下划线/数字', () => {
    const r = parsePicId('mod-a:background(pic):schale_office_2');
    expect(r).toEqual({ mod: 'mod-a', type: 'background', id: 'schale_office_2' });
  });

  test('buildPicId 可逆', () => {
    const id = buildPicId('base', 'avatar', 'hoshino');
    expect(id).toBe('base:avatar(pic):hoshino');
    expect(parsePicId(id)).toEqual({ mod: 'base', type: 'avatar', id: 'hoshino' });
  });

  test('不含 (pic) 标记 → undefined', () => {
    expect(parsePicId('base:avatar:hoshino')).toBeUndefined();
    expect(parsePicId('base:resource:credit')).toBeUndefined();
  });

  test('非法格式 → undefined', () => {
    expect(parsePicId('')).toBeUndefined();
    expect(parsePicId('base:avatar(pic)')).toBeUndefined(); // 缺 id 段
    expect(parsePicId('base:avatar(pic):')).toBeUndefined();
  });

  test('isPicRef 匹配', () => {
    expect(isPicRef('base:avatar(pic):hoshino')).toBe(true);
    expect(isPicRef('https://example.com/avatar.png')).toBe(false);
    expect(isPicRef('base:resource:credit')).toBe(false);
  });
});

describe('isDirectUrl / isZipPicSrc / zipPathOf', () => {
  test('直连 URL 识别', () => {
    expect(isDirectUrl('https://example.com/x.png')).toBe(true);
    expect(isDirectUrl('http://example.com/x.png')).toBe(true);
    expect(isDirectUrl('data:image/png;base64,abc')).toBe(true);
    expect(isDirectUrl('blob:http://localhost/xxx')).toBe(true);
    expect(isDirectUrl('/absolute/path.png')).toBe(true);
    expect(isDirectUrl('./relative/path.png')).toBe(true);
    expect(isDirectUrl('../relative/path.png')).toBe(true);
    expect(isDirectUrl('base:avatar(pic):hoshino')).toBe(false);
    expect(isDirectUrl('zip:assets/avatar.png')).toBe(false);
  });

  test('zip 来源识别', () => {
    expect(isZipPicSrc('zip:assets/avatar.png')).toBe(true);
    expect(isZipPicSrc('zip:path/to/file.jpg')).toBe(true);
    expect(isZipPicSrc('https://example.com/x.png')).toBe(false);
    expect(isZipPicSrc('base:avatar(pic):hoshino')).toBe(false);
  });

  test('zipPathOf 提取路径', () => {
    expect(zipPathOf('zip:assets/avatar.png')).toBe('assets/avatar.png');
    expect(zipPathOf('zip:path/to/file.jpg')).toBe('path/to/file.jpg');
    expect(zipPathOf('https://example.com/x.png')).toBe('');
  });
});

describe('ImageStore', () => {
  test('登记与查询', () => {
    const store = new ImageStore();
    store.register('modA', 'assets/avatar.png', 'data:image/png;base64,abc');
    expect(store.has('modA', 'assets/avatar.png')).toBe(true);
    expect(store.get('modA', 'assets/avatar.png')).toBe('data:image/png;base64,abc');
    expect(store.has('modA', 'nonexistent.png')).toBe(false);
    expect(store.get('modB', 'assets/avatar.png')).toBeUndefined();
  });

  test('批量登记', () => {
    const store = new ImageStore();
    store.registerAll('modA', [
      { path: 'a.png', url: 'data:image/png;base64,a' },
      { path: 'b.png', url: 'data:image/png;base64,b' },
    ]);
    expect(store.size).toBe(2);
    expect(store.get('modA', 'a.png')).toBe('data:image/png;base64,a');
  });

  test('clear', () => {
    const store = new ImageStore();
    store.register('modA', 'x.png', 'data:image/png;base64,abc');
    expect(store.size).toBe(1);
    store.clear();
    expect(store.size).toBe(0);
  });
});

describe('resolvePicSrc', () => {
  const registry = new Registry();
  const store = new ImageStore();

  beforeAll(() => {
    registry.load({
      name: 'test',
      version: '1.0.0',
      inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [],
      stories: [], items: [], funcletDefs: [],
      characters: [], 
      pics: [
        { id: 'base:avatar(pic):hoshino', src: 'zip:avatar/hoshino.png' },
        { id: 'base:avatar(pic):serika', src: 'https://example.com/serika.png' },
        { id: 'base:background(pic):office', src: 'zip:bg/office.webp' },
      ],
    });
    store.register('base', 'avatar/hoshino.png', 'data:image/png;base64,hoshino');
    store.register('base', 'bg/office.webp', 'data:image/webp;base64,office');
  });

  test('非 PicId（直连 URL / 相对路径）→ undefined（def 只持有 PicId）', () => {
    expect(resolvePicSrc(registry.pics, store, 'https://example.com/x.png')).toBeUndefined();
    expect(resolvePicSrc(registry.pics, store, '/assets/x.png')).toBeUndefined();
    expect(resolvePicSrc(registry.pics, store, 'icon-name')).toBeUndefined();
    expect(resolvePicSrc(registry.pics, store, 'shard')).toBeUndefined();
  });

  test('pic ref + zip 来源 → 从 ImageStore 取 URL', () => {
    expect(resolvePicSrc(registry.pics, store, 'base:avatar(pic):hoshino')).toBe('data:image/png;base64,hoshino');
  });

  test('pic ref + 直连 src → 直接返回 src', () => {
    expect(resolvePicSrc(registry.pics, store, 'base:avatar(pic):serika')).toBe('https://example.com/serika.png');
  });

  test('pic ref 但 pics 表无声明 → undefined', () => {
    expect(resolvePicSrc(registry.pics, store, 'base:avatar(pic):nonexistent')).toBeUndefined();
  });

  test('非 pic ref 非直连 URL → undefined（不再透传）', () => {
    expect(resolvePicSrc(registry.pics, store, 'icon-name')).toBeUndefined();
    expect(resolvePicSrc(registry.pics, store, 'shard')).toBeUndefined();
  });

  test('undefined/空 → undefined', () => {
    expect(resolvePicSrc(registry.pics, store, undefined)).toBeUndefined();
    expect(resolvePicSrc(registry.pics, store, '')).toBeUndefined();
  });

  test('zip 来源但 ImageStore 未登记 → undefined', () => {
    expect(resolvePicSrc(registry.pics, store, 'base:background(pic):office')).toBe('data:image/webp;base64,office');
    store.clear();
    expect(resolvePicSrc(registry.pics, store, 'base:avatar(pic):hoshino')).toBeUndefined();
  });
});

describe('Registry pics 集成', () => {
  test('load 后 pics 可查询', () => {
    const reg = new Registry();
    reg.load({
      name: 'test', version: '1.0.0',
      inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [],
      stories: [], items: [], funcletDefs: [],
      characters: [], 
      pics: [{ id: 'modA:avatar(pic):x', src: 'zip:avatar.png' }],
    });
    expect(reg.pics.size).toBe(1);
    expect(reg.pics.get('modA:avatar(pic):x')?.src).toBe('zip:avatar.png');
  });

  test('picsOfKind 按 typeName 段索引', () => {
    const reg = new Registry();
    reg.load({
      name: 'test', version: '1.0.0',
      inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [],
      stories: [], items: [], funcletDefs: [],
      characters: [], 
      pics: [
        { id: 'modA:avatar(pic):a', src: 'zip:a.png' },
        { id: 'modA:avatar(pic):b', src: 'zip:b.png' },
        { id: 'modA:background(pic):c', src: 'zip:c.png' },
      ],
    });
    expect(reg.picsOfKind('avatar')).toEqual(['modA:avatar(pic):a', 'modA:avatar(pic):b']);
    expect(reg.picsOfKind('background')).toEqual(['modA:background(pic):c']);
    expect(reg.picsOfKind('sticker')).toEqual([]);
  });

  test('clear 清空 pics 表', () => {
    const reg = new Registry();
    reg.load({
      name: 'test', version: '1.0.0',
      inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [],
      stories: [], items: [], funcletDefs: [],
      characters: [], 
      pics: [{ id: 'modA:avatar(pic):x', src: 'zip:x.png' }],
    });
    expect(reg.pics.size).toBe(1);
    reg.clear();
    expect(reg.pics.size).toBe(0);
  });

  test('验证：非法 id 格式 → RegistryError', () => {
    const reg = new Registry();
    expect(() => reg.load({
      name: 'test', version: '1.0.0',
      inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [],
      stories: [], items: [], funcletDefs: [],
      characters: [], 
      pics: [{ id: 'invalid-id', src: 'x.png' }],
    })).toThrow(RegistryError);
  });

  test('验证：空 src → RegistryError', () => {
    const reg = new Registry();
    expect(() => reg.load({
      name: 'test', version: '1.0.0',
      inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [],
      stories: [], items: [], funcletDefs: [],
      characters: [], 
      pics: [{ id: 'modA:avatar(pic):x', src: '' }],
    })).toThrow(RegistryError);
  });

  test('验证：重复 id → RegistryError', () => {
    const reg = new Registry();
    expect(() => reg.load({
      name: 'test', version: '1.0.0',
      inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [],
      stories: [], items: [], funcletDefs: [],
      characters: [], 
      pics: [
        { id: 'modA:avatar(pic):x', src: 'a.png' },
        { id: 'modA:avatar(pic):x', src: 'b.png' },
      ],
    })).toThrow(RegistryError);
  });
});

describe('GameInstance 图片 API', () => {
  test('getPicUrl / getPicDef / registerImages 端到端', () => {
    const game = new GameInstance();
    const dp: Datapack = {
      name: 'picmod', version: '1.0.0',
      inits: [], areas: [], spots: [],
      enhancements: [], activeStories: [], passiveStories: [],
      stories: [], items: [], funcletDefs: [],
      characters: [], 
      pics: [
        { id: 'picmod:avatar(pic):hoshino', src: 'zip:avatar/hoshino.png' },
        { id: 'picmod:background(pic):office', src: 'https://example.com/office.png' },
      ],
    };
    game.init([dp]);
    game.pics.register('picmod', [
      { path: 'avatar/hoshino.png', url: 'data:image/png;base64,hoshino' },
    ]);

    expect(game.pics.urlOf('picmod:avatar(pic):hoshino')).toBe('data:image/png;base64,hoshino');
    expect(game.pics.urlOf('picmod:background(pic):office')).toBe('https://example.com/office.png');
    expect(game.pics.urlOf('picmod:avatar(pic):missing')).toBeUndefined();
    expect(game.pics.urlOf('https://example.com/x.png')).toBeUndefined();
    expect(game.pics.urlOf(undefined)).toBeUndefined();
    expect(game.pics.defOf('picmod:avatar(pic):hoshino')?.src).toBe('zip:avatar/hoshino.png');
    expect(game.pics.defOf('nope')).toBeUndefined();

    game.imageStore.clear();
    expect(game.pics.urlOf('picmod:avatar(pic):hoshino')).toBeUndefined();
    game.stop();
  });
});
