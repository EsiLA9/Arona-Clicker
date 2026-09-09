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
            { id: 'ch_1', name: '第一章', items: [{ id: 'base:activestory:schale_welcome', entryId: 'base:activestory:schale_welcome', replayable: true }] },
            { id: 'ch_2', name: '第二章', items: [
              { id: 'base:activestory:schale_flow_show', entryId: 'base:activestory:schale_flow_show', replayable: true },
              { id: 'base:activestory:schale_theme_lite_test', entryId: 'base:activestory:schale_theme_lite_test', replayable: true },
            ] },
            { id: 'ch_3', name: '第三章', items: [
              { id: 'base:activestory:millennium_welcome', entryId: 'base:activestory:millennium_welcome', replayable: true },
              { id: 'base:activestory:millennium_game_crisis', entryId: 'base:activestory:millennium_game_crisis', replayable: true },
            ] },
          ],
        },
        {
          id: 'part_2', name: '阿比多斯篇', chapters: [
          { id: 'ch_1', name: '第一章', items: [{ id: 'base:activestory:abydos_welcome', entryId: 'base:activestory:abydos_welcome', replayable: true }] },
          ],
        },
      ],
    },
    {
      id: 'side', name: '小故事', parts: [
        { id: 'part_1', name: '芹香系列', items: [
          { id: 'base:activestory:serika_side_1', entryId: 'base:activestory:serika_side_1', replayable: true },
          { id: 'base:activestory:serika_side_2', entryId: 'base:activestory:serika_side_2', replayable: true },
        ] },
        { id: 'part_2', name: '跑腿系列', items: [
          { id: 'base:activestory:run_chain_1', entryId: 'base:activestory:run_chain_1', replayable: true },
          { id: 'base:activestory:run_chain_2', entryId: 'base:activestory:run_chain_2', replayable: true },
          { id: 'base:activestory:run_chain_3', entryId: 'base:activestory:run_chain_3', replayable: true },
        ] },
        { id: 'part_3', name: '星野系列', items: [
          { id: 'base:activestory:hoshino_rooftop_meet', entryId: 'base:activestory:hoshino_rooftop_meet', replayable: true },
        ] },
      ],
    },
    { id: 'club', name: '社团故事', parts: [] },
  ],
};
