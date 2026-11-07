import { parseColor } from '../../engine/core/color';
import type { StoryNodePerformance } from '../../engine/contracts/chat-presentation';

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const namedColor = /^(?:inherit|currentcolor|black|white|red|green|blue|yellow|orange|purple|gray|grey|silver|maroon|olive|lime|aqua|teal|navy|fuchsia|rebeccapurple)$/i;
const size = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|%)$/;

/** Shared author/snapshot boundary; only declared visual properties reach rendering. */
export function storyPerformanceIssues(value: unknown, click = false): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });
  const keys = (v: Record<string, unknown>, allowed: string[], path: string) => {
    for (const key of Object.keys(v)) if (!allowed.includes(key)) issue(`${path}.${key}`, '不支持的演出字段');
  };
  if (!object(value)) return [{ path: '', message: '演出参数必须是对象' }];
  keys(value,click ? ['style','layout'] : ['template','style','layout'],'');
  if (value.template !== undefined && !['message','default','title','badge','note'].includes(String(value.template))) issue('.template','未知正文模板');
  if (value.layout !== undefined) {
    const layout = value.layout;
    if (!object(layout)) issue('.layout','布局必须是对象');
    else {
      keys(layout,layout.mode==='flow'?['mode']:['mode','x','y','align','unit','anchor'],'.layout');
      if (layout.mode !== 'flow' && layout.mode !== 'positioned') issue('.layout.mode','未知展示方式');
      if (layout.mode==='positioned') {
        const pixels = layout.unit === 'px';
        const anchored = layout.anchor !== undefined;
        if (anchored) {
          const anchor = layout.anchor;
          if (!object(anchor)) issue('.layout.anchor','定位基准必须是对象');
          else {
            keys(anchor,['x','y'],'.layout.anchor');
            if (anchor.x !== 'left' && anchor.x !== 'center' && anchor.x !== 'right') issue('.layout.anchor.x','横向基准无效');
            if (anchor.y !== 'bottom' && anchor.y !== 'center' && anchor.y !== 'top') issue('.layout.anchor.y','纵向基准无效');
          }
          if (layout.align !== undefined) issue('.layout.align','定位基准已包含横向锚点');
        }
        if (layout.unit !== undefined && layout.unit !== 'percent' && !pixels) issue('.layout.unit','定位单位必须为 percent 或 px');
        for (const key of ['x','y']) {
          const coordinate = layout[key];
          if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || (!anchored && coordinate < 0) || (!pixels && Math.abs(coordinate) > 1)) {
            issue(`.layout.${key}`,pixels ? (anchored ? '像素偏移必须为有限数值' : '像素坐标必须为有限非负数') : (anchored ? '比例偏移必须在 -1 到 1 之间' : '坐标必须在 0 到 1 之间'));
          }
        }
        if (layout.align !== undefined && !['left','center','right'].includes(String(layout.align))) issue('.layout.align','定位锚点无效');
      }
    }
  }
  if (value.style !== undefined) {
    const style = value.style;
    if (!object(style)) issue('.style','样式必须是对象');
    else {
      keys(style,['font','fontSize','color','background','backgroundColor'],'.style');
      if (style.font !== undefined && !['default','serif','sans','mono','handwritten'].includes(String(style.font))) issue('.style.font','字型无效');
      if (style.fontSize !== undefined && (typeof style.fontSize!=='string'||!size.test(style.fontSize)||!Number.isFinite(Number.parseFloat(style.fontSize)))) issue('.style.fontSize','字号使用有限非负数与 px、em、rem 或 %');
      for (const key of ['color','backgroundColor']) if (style[key]!==undefined && (typeof style[key]!=='string'||(!parseColor(style[key] as string)&&!namedColor.test(style[key] as string)))) issue(`.style.${key}`,'颜色使用十六进制、rgb、hsl 或基本颜色名');
      if (style.background!==undefined && typeof style.background!=='boolean') issue('.style.background','背景显示必须为布尔值');
    }
  }
  return issues;
}

export function isStoryNodePerformance(value: unknown): value is StoryNodePerformance { return storyPerformanceIssues(value).length===0; }
