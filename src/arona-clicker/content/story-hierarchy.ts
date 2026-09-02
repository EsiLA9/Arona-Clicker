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
  items?: StoryContentItem[];
}

export interface StoryContentChapterDef {
  id: string;
  name: string;
  items: StoryContentItem[];
}

export interface StoryContentItem {
  id: string;
  name?: string;
  entryId: string;
  replayable?: boolean;
}

/** AronaClicker 故事栏的内容编排；它是产品内容，不属于基础引擎或测试包。 */
export const baseStoryHierarchy: StoryContentTable = {
  categories: [
    {
      id: 'main', name: '主线故事', parts: [
        {
          id: 'part_1', name: '夏莱篇', chapters: [
            { id: 'ch_1', name: '第一章', items: [{ id: 'base:story:schale_welcome', entryId: 'base:story:schale_welcome', replayable: true }] },
            { id: 'ch_2', name: '第二章', items: [{ id: 'base:story:schale_flow_show', entryId: 'base:story:schale_flow_show', replayable: true }] },
            { id: 'ch_2', name: '第二章', items: [
              { id: 'base:story:millennium_welcome', entryId: 'base:story:millennium_welcome', replayable: true },
              { id: 'base:story:millennium_game_crisis', entryId: 'base:story:millennium_game_crisis', replayable: true },
            ] },
          ],
        },
        {
          id: 'part_2', name: '阿比多斯篇', chapters: [
            { id: 'ch_1', name: '第一章', items: [{ id: 'base:story:abydos_welcome', entryId: 'base:story:abydos_welcome', replayable: true }] },
          ],
        },
      ],
    },
    {
      id: 'side', name: '小故事', parts: [
        { id: 'part_1', name: '芹香系列', items: [
          { id: 'base:story:serika_side_1', entryId: 'base:story:serika_side_1', replayable: true },
          { id: 'base:story:serika_side_2', entryId: 'base:story:serika_side_2', replayable: true },
        ] },
        { id: 'part_2', name: '跑腿系列', items: [
          { id: 'base:story:run_chain_1', entryId: 'base:story:run_chain_1', replayable: true },
          { id: 'base:story:run_chain_2', entryId: 'base:story:run_chain_2', replayable: true },
          { id: 'base:story:run_chain_3', entryId: 'base:story:run_chain_3', replayable: true },
        ] },
        { id: 'part_3', name: '星野系列', items: [
          { id: 'base:story:hoshino_rooftop_meet', entryId: 'base:story:hoshino_rooftop_meet', replayable: true },
        ] },
      ],
    },
    { id: 'club', name: '社团故事', parts: [] },
  ],
};
