import type { Datapack } from '../src/data-services/contracts/datapack';

interface BaseDatapackExportAsset {
  sourceUrl: string;
  sourcePath: string;
  packagePath: string;
}

export function exportBaseDatapackFolder(options: {
  datapack: Datapack;
  assets: readonly BaseDatapackExportAsset[];
  outputDir: string;
  projectRoot: string;
}): Promise<void>;
