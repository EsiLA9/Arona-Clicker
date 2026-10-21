import manifest from './area-map-demo/datapack.json';
import content from './area-map-demo/content.json';
import { FolderPackSource, parsePack } from '../../data-services';

/** Uses the same file/fragment parser as imported content, with real JSON authoring sources. */
export async function loadAreaMapDemoPack() {
  const source = new FolderPackSource([
    { path: 'datapack.json', read: async () => new TextEncoder().encode(JSON.stringify(manifest)) },
    { path: 'data/content.json', read: async () => new TextEncoder().encode(JSON.stringify(content)) },
  ]);
  return parsePack(source);
}
