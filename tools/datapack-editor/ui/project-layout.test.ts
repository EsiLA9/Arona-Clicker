import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { PassivePoolSystem } from '../../../src/arona-clicker/services/economy/passive-pool-system';
import type { PlayerState } from '../../../src/arona-clicker/types/state';
import type { Registry } from '../../../src/data-services/registry/registry';
import { EventBus } from '../../../src/engine/core/event-bus';
import { ConditionSystem } from '../../../src/engine/expression/condition-system';
import { writeZipArchive, type ArchivePlan } from '../../../src/data-services/archive/archive-writer';
import { parsePack } from '../../../src/data-services/datapack/pack-parser';
import { planProjectLayout, type LayoutRequest } from '../../../src/data-services/datapack/project-layout';
import { PROJECT_LAYOUT_PATH, readProject, type ProjectRead } from '../../../src/data-services/datapack/project-source';
import { FolderPackSource, openZipPackSource, SingleFilePackSource } from '../../../src/data-services/datapack/source';

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const manifest = { name: 'Test Pack', version: '1', modName: 'test', dependencies: [] };
const entry = (path: string, bytes: Uint8Array) => ({ path, read: async () => bytes });
const json = (path: string, value: unknown) => entry(path, encode(value));
const readArchive = async (archive: ArchivePlan) => readProject(await openZipPackSource(await writeZipArchive(archive)));

function archive(read: ProjectRead, request: LayoutRequest): ArchivePlan {
  const plan = planProjectLayout(read, request);
  expect(plan.diagnostics).toEqual([]);
  expect(plan.archive).toBeDefined();
  return plan.archive!;
}

describe('Datapack 作者文件来源与布局', () => {
  test('从合并结果区分来源和身份，坏文件只允许查看可读部分', async () => {
    const folder = new FolderPackSource([
      json('datapack.json', manifest),
      json('world/observatory/definitions.json', { name: manifest.name, version: manifest.version, spots: [{ id: 'test:spot:scanner' }], areas: [{ id: 'test:area:observatory' }] }),
    ]);
    const complete = await readProject(folder);
    expect(complete).toMatchObject({ status: 'complete', datapack: (await parsePack(folder)).datapack });
    expect(complete.definitions[0]).toMatchObject({
      value: { id: 'test:spot:scanner' }, source: { path: 'world/observatory/definitions.json', documentPointer: '/spots/0' },
    });
    const broken = new FolderPackSource([...await folder.list(), entry('bad.json', new Uint8Array([123]))]);
    const partial = await readProject(broken);
    expect(partial).toMatchObject({ status: 'incomplete', diagnostics: [{ path: 'bad.json' }] });
    expect(partial.definitions.map(row => row.occurrenceId)).toEqual(complete.definitions.map(row => row.occurrenceId));
    expect(partial).not.toHaveProperty('datapack');
    expect(planProjectLayout(partial, { kind: 'merge' }).archive).toBeUndefined();
    await expect(parsePack(broken)).rejects.toThrow('bad.json');
  });

  test('真实 addition-test 拆表、拆实体、分组、选合与全合可以逐次重开', async () => {
    const root = path.resolve('datapack-dev/addition_test');
    const files: ReturnType<typeof entry>[] = [];
    async function walk(directory: string): Promise<void> {
      for (const item of await readdir(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, item.name);
        if (item.isDirectory()) await walk(absolute);
        else files.push(entry(path.relative(root, absolute).split(path.sep).join('/'), await readFile(absolute)));
      }
    }
    await walk(root);
    const original = await readProject(new FolderPackSource(files));
    expect(original.status).toBe('complete');
    let current = original;
    for (const request of [
      { kind: 'split', by: 'table' }, { kind: 'split', by: 'entity' }, { kind: 'group', by: 'init' },
    ] satisfies LayoutRequest[]) {
      current = await readArchive(archive(current, request));
      expect(current.status).toBe('complete');
    }
    const selected = current.definitions.find(row => row.table === 'spots')!;
    const untouched = current.files.find(file => file.path === 'datapack.json')!;
    current = await readArchive(archive(current, { kind: 'merge', occurrences: [selected.occurrenceId], target: 'chosen.json' }));
    expect(current.definitions.some(row => row.source.path === 'chosen.json' && row.table === 'spots')).toBe(true);
    expect(current.files.find(file => file.path === untouched.path)?.bytes).toEqual(untouched.bytes);
    current = await readArchive(archive(current, { kind: 'merge', compatible: true }));
    expect(current).toMatchObject({ status: 'complete', datapack: original.status === 'complete' && original.datapack });
    expect(current.files.find(file => file.path === 'assets/addition-test.svg')?.bytes)
      .toEqual(original.files.find(file => file.path === 'assets/addition-test.svg')?.bytes);
    expect(current.files.find(file => file.path === 'assets/addition-test.svg')?.role).toBe('asset');
  });

  test('交错分片保留被动条目顺序，旧发行投影合一后可直接读取', async () => {
    const source = await readProject(new FolderPackSource([
      json('datapack.json', manifest),
      json('source.json', { name: manifest.name, version: manifest.version, passiveStories: ['a', 'b', 'c'].map(id => ({
        id, activation: { kind: 'random', weight: 1 },
      })) }),
    ]));
    const moved = archive(source, {
      kind: 'group', by: 'custom', rules: ['a', 'b', 'c'].map(key => ({
        key, path: key === 'b' ? 'world/other.json' : 'pack/group.json',
      })),
    });
    expect(moved.entries.some(file => file.path === PROJECT_LAYOUT_PATH)).toBe(true);
    const movedSource = await openZipPackSource(await writeZipArchive(moved));
    await expect(parsePack(movedSource)).rejects.toThrow('作者布局副本');
    const reread = await readProject(movedSource);
    expect(reread).toMatchObject({ status: 'complete', datapack: source.status === 'complete' && source.datapack });
    const compatible = archive(reread, { kind: 'merge', compatible: true });
    const runtime = await parsePack(await openZipPackSource(await writeZipArchive(compatible)));
    expect(runtime.datapack.passiveStories.map(row => row.id)).toEqual(['a', 'b', 'c']);
    const system = new PassivePoolSystem({
      passivePools: new Map(), passiveStories: new Map(runtime.datapack.passiveStories.map(row => [row.id, row])),
    } as unknown as Registry, new ConditionSystem(), new EventBus());
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try { expect(system.pick({ totalFrames: 0 } as PlayerState, () => true)).toBe('b'); }
    finally { random.mockRestore(); }
    const corrupt = await readProject(new FolderPackSource([
      ...(await movedSource.list()).filter(file => file.path !== PROJECT_LAYOUT_PATH),
      json(PROJECT_LAYOUT_PATH, { order: { passiveStories: [] } }),
    ]));
    expect(corrupt).toMatchObject({ status: 'incomplete', diagnostics: [{ path: PROJECT_LAYOUT_PATH }] });
  });

  test('单 JSON 反复转换且保留未知字段，碰撞不给输出计划', async () => {
    const original = await readProject(new SingleFilePackSource(json('datapack.json', {
      name: 'Single', version: '1', stories: [{ id: 'a' }, { id: 'b' }], extension: { custom: true },
    })));
    const split = await readArchive(archive(original, { kind: 'split', by: 'entity' }));
    expect(split.status).toBe('complete');
    const full = await readArchive(archive(split, { kind: 'merge' }));
    expect(full.files.some(file => file.raw?.extension !== undefined)).toBe(true);
    const conflict = planProjectLayout(original, { kind: 'split', by: 'entity', overrides: { 'datapack.json': 'datapack.json' } });
    expect(conflict.archive).toBeUndefined();
  });

  test('把声明加入已有定义分片，保留其中的残余字段和未选声明', async () => {
    const extension = { custom: [1, { keep: true }] };
    const original = await readProject(new FolderPackSource([
      json('datapack.json', manifest),
      json('target.json', { name: manifest.name, version: manifest.version, extension, spots: [{ id: 'original' }] }),
      json('incoming.json', { spots: [{ id: 'incoming' }] }),
      json('settings.json', { layoutPreference: true }),
    ]));
    const incoming = original.definitions.find(row => row.source.path === 'incoming.json')!;
    for (const request of [
      { kind: 'group', by: 'custom', rules: [{ key: 'incoming', path: 'target.json' }] },
      { kind: 'merge', occurrences: [incoming.occurrenceId], target: 'target.json' },
    ] satisfies LayoutRequest[]) {
      const reread = await readArchive(archive(original, request));
      expect(reread).toMatchObject({ status: 'complete' });
      expect(reread.files.find(file => file.path === 'target.json')).toMatchObject({ role: 'definition', raw: { extension } });
      expect(reread.definitions.some(row => row.source.path === 'target.json' && row.value
        && (row.value as { id: string }).id === 'incoming')).toBe(true);
      if (request.kind === 'merge') expect(reread.files.find(file => file.path === 'target.json')?.raw?.spots)
        .toEqual([{ id: 'original' }, { id: 'incoming' }]);
    }
    const conflict = planProjectLayout(original, { kind: 'merge', occurrences: [incoming.occurrenceId], target: 'settings.json' });
    expect(conflict.archive).toBeUndefined();
    expect(conflict.diagnostics.some(item => item.path === 'settings.json' && item.message.includes('冲突'))).toBe(true);
  });

  test('分片的未知扩展字段随全合和兼容发行保留，独立配置仍按附属文件处理', async () => {
    const extension = { custom: [1, { keep: true }] };
    const original = await readProject(new FolderPackSource([
      json('datapack.json', manifest),
      json('metadata.json', { name: manifest.name, version: manifest.version }),
      json('definitions.json', { extension, spots: [{ id: 'spot', extension }] }),
      json('settings.json', { other: true }),
    ]));
    const split = await readArchive(archive(original, { kind: 'split', by: 'entity' }));
    expect(split.files.find(file => file.path === 'definitions.json')).toMatchObject({ role: 'definition', raw: { extension } });
    expect(split.files.find(file => file.path === 'settings.json')).toMatchObject({ role: 'other' });
    const full = await readArchive(archive(split, { kind: 'merge' }));
    expect(full.files.find(file => file.path === 'content.json')?.raw).toMatchObject({ extension, spots: [{ extension }] });
    expect(full.files.some(file => file.path === 'settings.json')).toBe(true);
    const compatible = planProjectLayout(full, { kind: 'merge', compatible: true });
    expect(compatible.omitted).toEqual(['settings.json']);
    expect(compatible.requiresLayoutReader).toBe(false);
    const source = await openZipPackSource(await writeZipArchive(compatible.archive!));
    expect((await readProject(source)).files.find(file => file.path === 'content.json')?.raw).toMatchObject({ extension });
    expect((await parsePack(source)).datapack.spots[0]).toMatchObject({ id: 'spot', extension });
  });

  test('交错顺序校验重复键和缺键，拒绝手改后的歧义位置', async () => {
    const records = [{ id: 'same', name: 'First' }, { id: 'unique', name: 'Middle' }, { id: 'same', name: 'Last' }, { name: 'No ID' }];
    const original = await readProject(new FolderPackSource([
      json('datapack.json', manifest),
      json('content.json', { name: manifest.name, version: manifest.version, spots: records }),
    ]));
    const moved = archive(original, {
      kind: 'group', by: 'custom', rules: [{ key: 'same', path: 'a.json' }, { key: 'unique', path: 'm.json' }],
      overrides: { [original.definitions[3].occurrenceId]: 'z.json' },
    });
    const layoutText = moved.entries.find(file => file.path === PROJECT_LAYOUT_PATH)!.content;
    expect(typeof layoutText).toBe('string');
    const positions = JSON.parse(String(layoutText)).order.spots;
    expect(positions.map((position: { fingerprint?: string }) => Boolean(position.fingerprint))).toEqual([true, false, true, true]);
    expect(await readArchive(moved)).toMatchObject({ status: 'complete', datapack: { spots: records } });
    const edit = (path: string, content: string) => readArchive({
      entries: moved.entries.map(file => file.path === path ? { path, content } : file),
    });
    const swapped = await edit('a.json', JSON.stringify({ spots: [records[2], records[0]] }));
    const replacingMissing = await edit('z.json', JSON.stringify({ spots: [{ name: 'Replacement' }] }));
    for (const invalid of [swapped, replacingMissing]) {
      expect(invalid).toMatchObject({ status: 'incomplete' });
      expect(invalid.diagnostics[0].message).toContain('无法确认原声明');
    }
    expect(await edit('a.json', '{ "spots": [{ "name": "First", "id": "same" }, {"name":"Last", "id":"same"}] }'))
      .toMatchObject({ status: 'complete' });
    expect(await edit('m.json', '{"spots":[{"id":"unique","name":"Edited"}]}')).toMatchObject({ status: 'complete' });
    expect(await edit('m.json', '{"spots":[{"id":"renamed","name":"Edited"}]}'))
      .toMatchObject({ status: 'incomplete', diagnostics: [{ path: PROJECT_LAYOUT_PATH, message: expect.stringContaining('m.json#/spots/0') }] });
    delete positions[3].fingerprint;
    expect(await edit(PROJECT_LAYOUT_PATH, JSON.stringify({ order: { spots: positions } }))).toMatchObject({ status: 'incomplete' });
  });

  test('缺失本地 Pic 资产只能浏览和定位，培养曲线可按键重组', async () => {
    const missing = await readProject(new SingleFilePackSource(json('content.json', {
      pics: [{ id: 'pic', src: 'zip:assets/absent.png' }],
    })));
    expect(missing).toMatchObject({ status: 'incomplete', diagnostics: [{ path: 'content.json', documentPointer: '/pics/0' }] });
    const source = await readProject(new FolderPackSource([
      json('datapack.json', manifest),
      json('content.json', { name: manifest.name, version: manifest.version, cultivateCurves: [{ id: 'z' }, { id: 'a' }] }),
    ]));
    const moved = archive(source, { kind: 'split', by: 'entity' });
    expect(moved.entries.some(file => file.path === PROJECT_LAYOUT_PATH)).toBe(false);
    expect((await readArchive(moved)).definitions.filter(row => row.table === 'cultivateCurves').map(row => row.value))
      .toEqual([{ id: 'a' }, { id: 'z' }]);
  });
});
