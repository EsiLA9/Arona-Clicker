import type { StoryContent, StoryPresentation, StoryTalkletNode, StoryClickNode } from '../contracts/story-node';
import type { EngineTalklet } from '../../engine/contracts/talklet';

import type { StoryNodePerformance } from '../../engine/contracts/chat-presentation';

/** Keep the playback output and snapshot format independent of authoring fields. */
export function storyNodeDisplay(node: StoryTalkletNode | StoryClickNode): StoryNodePerformance | undefined {
  const template = node.type === 'talklet' ? node.appearance?.template ?? node.performance?.template : undefined;
  const style = node.appearance?.style ?? node.performance?.style;
  const layout = node.performance?.layout;
  return template === undefined && style === undefined && layout === undefined ? undefined
    : { ...(template === undefined ? {} : { template }), ...(style === undefined ? {} : { style }), ...(layout === undefined ? {} : { layout }) };
}

/** The same identity and presentation mapping serves playback, overlays and editor previews. */
export function projectStoryContent(content: StoryContent, presentation?: StoryPresentation): EngineTalklet {
  return {
    ...content,
    ...(presentation?.side===undefined?{}:{side:presentation.side}),
    ...(presentation?.align===undefined?{}:{align:presentation.align}),
    ...(presentation?.avatar===undefined?{}:{avatar:presentation.avatar}),
    ...(presentation?.avatarMode==='hide'?{noAvatar:true}:{}),
    ...(presentation?.avatarMode==='show'?{showAvatar:true}:{}),
  };
}
