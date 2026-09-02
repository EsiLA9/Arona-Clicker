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
