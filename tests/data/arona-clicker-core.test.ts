// ============================================================
// data/arona-clicker-core.test.ts
// 端到端：读取已打包的 datapack/arona-clicker-core.zip，
// 经 zip-loader 合并为 Datapack 后通过 Registry 校验。
// 打包命令：node scripts/pack-arona-clicker-core.mjs
// ============================================================
import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadDatapackFromZipBuffer } from '../../src/data-services/datapack/zip-loader';
import { Registry } from '../../src/data-services/registry/registry';

const ZIP_PATH = fileURLToPath(
  new URL('../../datapack/arona-clicker-core.zip', import.meta.url),
);

describe('AronaClickerCore JSON 数据包（打包读取）', () => {
  let zipBuffer: Buffer;

  beforeAll(() => {
    if (!existsSync(ZIP_PATH)) {
      throw new Error(`缺少打包产物：${ZIP_PATH}。请先运行 node scripts/pack-arona-clicker-core.mjs`);
    }
    zipBuffer = readFileSync(ZIP_PATH);
  });

  test('加载 zip：23 个 json 分片全部合并，无忽略文件', async () => {
    const { datapack, jsonFileCount, ignoredCount } = await loadDatapackFromZipBuffer(zipBuffer);
    expect(jsonFileCount).toBe(23);
    expect(ignoredCount).toBe(0);
    expect(datapack.name).toBe('AronaClickerCore');
    expect(datapack.version).toBe('0.1.0');
  });

  test('各列表字段按分片合并出预期条目数', async () => {
    const { datapack } = await loadDatapackFromZipBuffer(zipBuffer);
    expect(datapack.inits).toHaveLength(2);
    expect(datapack.areas).toHaveLength(2);
    expect(datapack.spots).toHaveLength(5);
    expect(datapack.enhancements).toHaveLength(3);
    expect(datapack.activeStories).toHaveLength(2);
    expect(datapack.passiveStories).toHaveLength(1);
    expect(datapack.stories).toHaveLength(3);
    expect(datapack.items).toHaveLength(4);
    expect(datapack.dropTables).toHaveLength(2);
    expect(datapack.affectorPacks).toHaveLength(2);
    expect(datapack.triggerDefs).toHaveLength(3);
    expect(datapack.characters).toHaveLength(3);
    expect(datapack.resourceDisplays).toHaveLength(2);
    expect(datapack.funcletDefs).toHaveLength(0);
  });

  test('extras 扁平键分片合并', async () => {
    const { datapack } = await loadDatapackFromZipBuffer(zipBuffer);
    expect(datapack.extras).toEqual({
      'meta/author': { t: 'str', v: 'AronaClicker Team' },
      'meta/website': { t: 'str', v: 'https://example.com' },
      'balance/start-credit': { t: 'int', v: 0 },
      'balance/max-credit': { t: 'int', v: 100000 },
      'millennium/featured': { t: 'bool', v: true },
      'millennium/motto': { t: 'str', v: 'Let\'s make it happen.' },
      'millennium/slots': { t: 'int', v: 3 },
      'balance/start-pyroxene': { t: 'int', v: 0 },
      'balance/max-pyroxene': { t: 'int', v: 50000 },
    });
  });

  test('Registry 校验通过：id 唯一、引用完整、extra 合法', async () => {
    const { datapack } = await loadDatapackFromZipBuffer(zipBuffer);
    const reg = new Registry();
    expect(() => reg.load(datapack)).not.toThrow();
    // 建立索引后可查询
    expect(reg.inits.get('base:init:schale_office')).toBeDefined();
    expect(reg.areas.get('base:area:schale_main')).toBeDefined();
    expect(reg.spots.get('base:spot:credit_printer')).toBeDefined();
    expect(reg.areasOfInit('base:init:schale_office')).toContain('base:area:schale_main');
    expect(reg.spotsOfArea('base:area:schale_main')).toContain('base:spot:credit_printer');
    expect(reg.getExtra('balance/max-credit')).toEqual({ t: 'int', v: 100000 });
    // 触发入口注册表：active / passive 分表，入口与演出 1:1 可解析
    expect(reg.activeStories.get('base:activestory:schale_welcome')).toBeDefined();
    expect(reg.activeStories.get('base:activestory:schale_welcome')!.storyId).toBe('base:story:schale_welcome');
    expect(reg.passiveStories.get('base:passivestory:millennium_chat')).toBeDefined();
    const millenniumChat = reg.passiveStories.get('base:passivestory:millennium_chat')!;
    expect(millenniumChat.completionReward).toBeDefined();
    // 合并只读视图：active ∪ passive 统一可按 id 查询
    expect(reg.storyEntries.get('base:activestory:schale_welcome')).toBeDefined();
    expect(reg.storyEntries.get('base:passivestory:millennium_chat')).toBeDefined();
    // 演出本体纯演出：无触发字段
    expect(reg.stories.get('base:story:schale_welcome')!.talklets).toHaveLength(2);
    expect(reg.stories.get('base:story:schale_welcome')!).not.toHaveProperty('triggerCondition');
  });

  test('千年学院世界线：init/area/spot 引用与索引完整', async () => {
    const { datapack } = await loadDatapackFromZipBuffer(zipBuffer);
    const reg = new Registry();
    reg.load(datapack);
    expect(reg.inits.get('base:init:millennium')).toBeDefined();
    expect(reg.areasOfInit('base:init:millennium')).toContain('base:area:millennium_lab');
    for (const spotId of ['base:spot:millennium_printer', 'base:spot:robot_shelter', 'base:spot:dispenser']) {
      expect(reg.spotsOfArea('base:area:millennium_lab')).toContain(spotId);
    }
    // 千年学院 extras 常量
    expect(reg.getExtra('millennium/motto')).toEqual({ t: 'str', v: 'Let\'s make it happen.' });
    expect(reg.getExtra('balance/max-pyroxene')).toEqual({ t: 'int', v: 50000 });
  });
});
