import type { StoryContent, StoryPresentation } from '../contracts/story-node';
import type { EngineTalklet } from '../../engine/contracts/talklet';

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
