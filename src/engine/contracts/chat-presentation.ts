import type { EngineTalklet } from './talklet';

/** 演出专用文本的视觉格式类别。 */
export type ChatTextKind = 'default' | 'kizuna' | 'title' | 'badge' | 'note';

/** 演出专用文本的字型类别。 */
export type ChatTextFont = 'default' | 'serif' | 'sans' | 'mono' | 'handwritten';

/** 演出专用文本的样式覆写。 */
export interface ChatTextStyle {
  font?: ChatTextFont;
  fontSize?: string;
  color?: string;
  background?: boolean;
  backgroundColor?: string;
}

/** 定位可把内容与聊天窗格的同名基准点相连。旧定义以窗格左下角为原点。 */
export type StoryNodeLayout = { readonly mode: 'flow' } | {
    readonly mode: 'positioned'; readonly x: number; readonly y: number;
    /** 默认 percent，按窗格宽高计算比例。px 使用 CSS 像素。 */
    readonly unit?: 'percent' | 'px';
    /** 九宫格基准。X/Y 是向右、向上为正的偏移。 */
    readonly anchor?: { readonly x: 'left' | 'center' | 'right'; readonly y: 'bottom' | 'center' | 'top' };
    /** 旧式定位的横向锚点，只在缺省 anchor 时使用。 */
    readonly align?: 'left' | 'center' | 'right';
  };

/** 运行时聊天输出中的视觉参数。 */
export type StoryNodeTemplate = 'message' | 'default' | 'title' | 'badge' | 'note';

export interface StoryNodePerformance {
  /** 正文模板；message 保留角色、图片和气泡，其他模板显示正文文字。 */
  readonly template?: StoryNodeTemplate;
  /** 流内与定位展示均可使用的有限样式。 */
  readonly style?: ChatTextStyle;
  readonly layout?: StoryNodeLayout;
}

/** 当前剧情运行内的展示目标；同一节点重复到达的可见实例统一清除。 */
export interface StoryDisplayTarget {
  readonly storyId: string;
  readonly nodeId: string;
}

/** 引擎向演出服务传递的最小定位文本声明。 */
export interface ChatTextEffectValue {
  text?: string;
  talklet?: EngineTalklet;
  x?: number;
  y?: number;
  align?: 'left' | 'center' | 'right';
  kind?: ChatTextKind;
  style?: ChatTextStyle;
  title?: string;
  buttonText?: string;
  targetStoryId?: string;
}
