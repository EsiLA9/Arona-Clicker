import type { Datapack } from '../../data-services/contracts/datapack';

/** Declaration counts describe the incoming batch, before cross-pack overrides and validation. */
export function describeStartupContent(packs: readonly Datapack[]): string {
  const groups = [
    ['inits', '世界线'], ['areas', '区域'], ['spots', '设施'],
    ['stories', '剧情'], ['activeStories', '主动剧情入口'], ['passiveStories', '闲聊入口'],
    ['characters', '角色'], ['characterVariants', '角色差分'], ['maps', '玩法地图'],
    ['items', '物品'], ['shops', '商店'], ['pics', '图片'],
    ['colorGroups', '色组'], ['themeDesigns', '主题'],
  ] as const;
  const counts = groups.flatMap(([key, label]) => {
    const count = packs.reduce((total, pack) => total + (pack[key]?.length ?? 0), 0);
    return count ? [`${label} ${count}`] : [];
  });
  return [
    `启用 ${packs.length} 个数据包（按应用顺序）：`,
    ...packs.map(pack => `${pack.name} · ${pack.modName ?? 'base'} @ ${pack.version}`),
    `本批内容声明：${counts.join(' · ') || '无上述内容'}`,
  ].join('\n');
}
