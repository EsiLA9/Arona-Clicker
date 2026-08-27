// ============================================================
// data/base/story-hierarchy.ts — 故事栏内容表（正式内容包装层）
// ============================================================
// 故事栏的「内容消费层」：分类 → 篇 → 章 → 内容项。
// 每个内容项是独立于 StoryEntry 的展示单元，通过 entryId 引用剧情入口，
// 因此一个 entry 可被多个内容项（或聊天流 kizuna 卡片）复用。
// 重阅读策略由内容项 replayable 与 entry.replayable 共同决定。
// 由 UI 层（rail.ts）读取，不侵入引擎类型。
// ============================================================

export interface StoryContentTable {
  categories: StoryContentCategoryDef[];
}

export interface StoryContentCategoryDef {
  id: string;
  name: string;
  parts: StoryContentPartDef[];
}

export interface StoryContentPartDef {
  id: string;
  name: string;
  chapters?: StoryContentChapterDef[];
  /** 直接归属该篇的内容项（无章层级时使用）。 */
  items?: StoryContentItem[];
}

export interface StoryContentChapterDef {
  id: string;
  name: string;
  items: StoryContentItem[];
}

/** 故事栏内容项：展示单元，指向一个 StoryEntry。 */
export interface StoryContentItem {
  /** 内容项 ID（用于 rail 导航/渲染键）。 */
  id: string;
  /** 展示名称（缺省回退到 entry 对应 StoryDef.name）。 */
  name?: string;
  /** 指向的剧情入口 id（ActiveStoryEntry.id）。 */
  entryId: string;
  /** 是否允许重阅读（缺省 = entry.replayable）。 */
  replayable?: boolean;
}

export const baseStoryHierarchy: StoryContentTable = {
  categories: [
    {
      id: 'main',
      name: '主线故事',
      parts: [
        {
          id: 'part_1',
          name: '夏莱篇',
          chapters: [
            {
              id: 'ch_1',
              name: '第一章',
              items: [{ id: 'base:story:schale_welcome', entryId: 'base:story:schale_welcome', replayable: true }],
            },
            {
              id: 'ch_2',
              name: '第二章',
              items: [
                { id: 'base:story:schale_flow_show', entryId: 'base:story:schale_flow_show', replayable: true },
              ],
            },
            {
              id: 'ch_2',
              name: '第二章',
              items: [
                { id: 'base:story:millennium_welcome', entryId: 'base:story:millennium_welcome', replayable: true },
                { id: 'base:story:millennium_game_crisis', entryId: 'base:story:millennium_game_crisis', replayable: true },
              ],
            },
          ],
        },
        {
          id: 'part_2',
          name: '阿比多斯篇',
          chapters: [
            {
              id: 'ch_1',
              name: '第一章',
              items: [{ id: 'base:story:abydos_welcome', entryId: 'base:story:abydos_welcome', replayable: true }],
            },
          ],
        },
      ],
    },
    {
      id: 'side',
      name: '小故事',
      parts: [
        {
          id: 'part_1',
          name: '芹香系列',
          items: [
            { id: 'base:story:serika_side_1', entryId: 'base:story:serika_side_1', replayable: true },
            { id: 'base:story:serika_side_2', entryId: 'base:story:serika_side_2', replayable: true },
          ],
        },
        {
          id: 'part_2',
          name: '跑腿系列',
          items: [
            { id: 'base:story:run_chain_1', entryId: 'base:story:run_chain_1', replayable: true },
            { id: 'base:story:run_chain_2', entryId: 'base:story:run_chain_2', replayable: true },
            { id: 'base:story:run_chain_3', entryId: 'base:story:run_chain_3', replayable: true },
          ],
        },
        {
          id: 'part_3',
          name: '星野系列',
          items: [
            { id: 'base:story:hoshino_rooftop_meet', entryId: 'base:story:hoshino_rooftop_meet', replayable: true },
          ],
        },
      ],
    },
    {
      id: 'club',
      name: '社团故事',
      parts: [],
    },
  ],
};
