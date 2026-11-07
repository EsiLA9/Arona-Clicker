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
  "categories": [
    {
      "id": "main",
      "name": "主线故事",
      "parts": [
        {
          "id": "part_1",
          "name": "夏莱篇",
          "chapters": [
            {
              "id": "ch_1",
              "name": "第一章",
              "items": []
            },
            {
              "id": "ch_2",
              "name": "第二章",
              "items": []
            },
            {
              "id": "ch_3",
              "name": "第三章",
              "items": []
            }
          ]
        },
        {
          "id": "part_2",
          "name": "阿比多斯篇",
          "chapters": [
            {
              "id": "ch_1",
              "name": "第一章",
              "items": []
            }
          ]
        }
      ]
    },
    {
      "id": "side",
      "name": "小故事",
      "parts": [
        {
          "id": "part_1",
          "name": "芹香系列",
          "items": []
        },
        {
          "id": "part_2",
          "name": "跑腿系列",
          "items": []
        },
        {
          "id": "part_3",
          "name": "星野系列",
          "items": []
        },
        {
          "id": "part_4",
          "name": "白子系列",
          "items": []
        }
      ]
    },
    {
      "id": "club",
      "name": "社团故事",
      "parts": []
    }
  ]
};
