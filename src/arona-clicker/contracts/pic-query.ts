import type { PicDef } from '../../data-services/contracts/pic';

export interface PicQueryPort {
  urlOf(ref: string | undefined): string | undefined;
  defOf(ref: string): PicDef | undefined;
  list?(): readonly PicDef[];
}
