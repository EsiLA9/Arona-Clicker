import type { StoryDef } from '../contracts/story';
import type { StoryDefinitionReferences } from '../authoring/story-definition-projection';
import { projectStoryDefinition } from '../authoring/story-definition-projection';

/** Convert projection issues into the existing Registry write failure contract. */
export function prepareStoryDefinition(value: unknown, refs: StoryDefinitionReferences): StoryDef {
  const result = projectStoryDefinition(value, refs);
  if (!result.ok) {
    const first = result.issues[0];
    throw new Error(first ? `${first.path}：${first.message}` : 'StoryDef 无效');
  }
  return result.story;
}
