import { resolvePicSrc } from './pic-resolver';
import type { ImageStore, ResolvedImageEntry } from './image-store';
import type { PicDef } from '../contracts/pic';
import type { PicDefinitionMap } from './pic-resolver';

/** 通用图片资产服务：只处理 PicDef 查询、解析与运行时资源登记。 */
export class PicService {
  constructor(
    private readonly pics: PicDefinitionMap,
    private readonly imageStore: ImageStore,
  ) {}

  urlOf(ref: string | undefined): string | undefined {
    return resolvePicSrc(this.pics, this.imageStore, ref);
  }

  defOf(ref: string): PicDef | undefined {
    return this.pics.get(ref);
  }

  list(): readonly PicDef[] {
    return [...this.pics.values()];
  }

  register(mod: string, entries: readonly ResolvedImageEntry[]): void {
    this.imageStore.registerAll(mod, entries);
  }
}
