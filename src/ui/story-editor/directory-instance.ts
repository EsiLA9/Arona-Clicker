import type { BrowseInstanceSeed } from '../workspace/browse-instance-manager';
import type { EditorResourceOpenRequest } from '../workspace/editor-resource-request';
import type { StoryDirectoryManagementState, StoryDirectoryResourceRef } from './directory-management-state';
import { parseStoryExplorerSource, storyExplorerSourceValue } from './pack-source';

export const storyDirectoryBrowseProviderKey = 'story-directory';

export interface StoryDirectoryBrowseState {
  management: StoryDirectoryManagementState;
  unavailable?: { reason: string };
}

export function directoryBrowseStateIsDirty(state: StoryDirectoryManagementState): boolean {
  const working = state.working;
  return Boolean(working.create || working.values.size || working.sorting || working.moving || working.removing);
}

export function storyDirectoryResourceKey(resource: StoryDirectoryResourceRef): string {
  const source = parseStoryExplorerSource(resource.sourceKey);
  return JSON.stringify([source ? storyExplorerSourceValue(source) : null, resource.initId, resource.logicalDirectoryKey]);
}

export function storyDirectoryResourceRefId(resource: StoryDirectoryResourceRef): { kind: 'directory' | 'directory-root'; id: string } {
  return resource.logicalDirectoryKey
    ? { kind: 'directory', id: JSON.stringify([resource.initId, resource.logicalDirectoryKey]) }
    : { kind: 'directory-root', id: resource.initId };
}

export function createStoryDirectoryBrowseSeed(state: StoryDirectoryBrowseState, title: string): BrowseInstanceSeed<StoryDirectoryBrowseState> {
  if (!parseStoryExplorerSource(state.management.resource.sourceKey)) throw new Error('The Story directory resource source is invalid.');
  const resourceKey = storyDirectoryResourceKey(state.management.resource);
  return { providerKey: storyDirectoryBrowseProviderKey, resourceKey, reuseKey: resourceKey, state,
    presentation: { title, kind: 'directory', typeLabel: '目录' } };
}

export function resolveStoryDirectoryResourceRequest(request: EditorResourceOpenRequest): StoryDirectoryResourceRef | undefined {
  const { providerKey, resourceKey, kind, id } = request.resource;
  if (providerKey !== storyDirectoryBrowseProviderKey || !id || request.sourceKey === undefined) return undefined;
  const source = parseStoryExplorerSource(request.sourceKey);
  if (!source) return undefined;
  const sourceKey = storyExplorerSourceValue(source);
  let resource: StoryDirectoryResourceRef;
  if (kind === 'directory-root') resource = { sourceKey, initId: id, logicalDirectoryKey: '', ownerModName: request.resource.ownerModName };
  else if (kind === 'directory') {
    try {
      const identity: unknown = JSON.parse(id);
      if (!Array.isArray(identity) || identity.length !== 2 || typeof identity[0] !== 'string' || typeof identity[1] !== 'string' || !identity[1]) return undefined;
      resource = { sourceKey, initId: identity[0], logicalDirectoryKey: identity[1], ownerModName: request.resource.ownerModName };
    } catch { return undefined; }
  } else return undefined;
  return storyDirectoryResourceKey(resource) === resourceKey ? resource : undefined;
}
